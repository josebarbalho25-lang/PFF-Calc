// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/secaoEfetiva.ts — a seção efetiva do método da largura efetiva
//  (MLE): os elementos comprimidos perdem os trechos que não colaboram
// ---------------------------------------------------------------------------
//  Para uma distribuição de tensões dada (compressão positiva, linear no
//  plano da seção: σ = σ0 + gx·x + gy·y), cada elemento plano recebe o
//  tratamento da norma:
//   · mesa com enrijecedor de borda, uniformemente comprimida → 9.2.3.1
//     (Is, Ia, k; e o enrijecedor reduzido a ds);
//   · elemento com as duas bordas presas → Tabela 5 (AA);
//   · elemento com uma borda livre → Tabela 6 (AL).
//  Os cantos (arcos) ficam inteiros. As propriedades efetivas saem do MESMO
//  integrador das brutas (`propriedades.ts`), sobre os trechos que ficaram.
//
//  ⚠️ FORA DO CAMPO DO MLE: a mesa com enrijecedor de borda e tensão VARIANDO
//  (o Ue fletido em y, a cartola fletida em x). O 9.2.3 é só para elemento
//  "uniformemente comprimido" e a norma não diz como tratar o resto. Aqui
//  isso volta como `foraDoCampo`, e a verificação vai para o MRD (decisão
//  mandada a ele em 01/11/2026, pergunta 2).
// ═══════════════════════════════════════════════════════════════════════════

import { propriedades, type PropriedadesDaSecao } from '../secao/propriedades';
import type { ElementoPlano, Ponto, SecaoGeometrica, Trecho as TrechoDaLinha, TrechoReto } from '../secao/tipos';
import { elementoAA, elementoAL, mesaComEnrijecedor, type LarguraEfetiva, type Trecho } from './larguraEfetiva';

/** σ(x, y) = σ0 + gx·x + gy·y, compressão positiva, kN/cm², coordenadas do desenho. */
export interface CampoDeTensao {
  s0: number;
  gx: number;
  gy: number;
}

export const tensaoEm = (c: CampoDeTensao, p: Ponto) => c.s0 + c.gx * p.x + c.gy * p.y;

/** O que aconteceu com um elemento — vai para a memória. */
export interface ElementoEfetivo {
  indice: number;
  papel: ElementoPlano['papel'];
  b: number;
  /** Tensões nas bordas a e b do trecho reto. */
  sa: number;
  sb: number;
  largura?: LarguraEfetiva;
  /** Quando o elemento é mesa com enrijecedor (9.2.3.1). */
  enrijecedor?: ReturnType<typeof mesaComEnrijecedor>;
  efetivos: Trecho[];
}

export interface SecaoEfetiva {
  elementos: ElementoEfetivo[];
  props: PropriedadesDaSecao;
  /** Trechos da linha média que ficaram (para o desenho da seção efetiva). */
  trechos: TrechoDaLinha[];
  foraDoCampo: string[];
  avisos: string[];
}

const QUASE_UNIFORME = 1e-6;

function retaDoElemento(sec: SecaoGeometrica, el: ElementoPlano): TrechoReto {
  return sec.trechos[el.trecho] as TrechoReto;
}

/** Corta o trecho reto nos pedaços efetivos (medidos da borda "a"). */
function pedacos(r: TrechoReto, efetivos: Trecho[]): TrechoReto[] {
  const L = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
  const u = { x: (r.b.x - r.a.x) / L, y: (r.b.y - r.a.y) / L };
  const em = (s: number): Ponto => ({ x: r.a.x + u.x * s, y: r.a.y + u.y * s });
  return efetivos.filter(([i, f]) => f - i > 1e-9).map(([i, f]) => ({ tipo: 'reta', a: em(i), b: em(f) }));
}

/** O elemento vizinho pela borda (a = 0, b = 1), se houver. */
function vizinho(sec: SecaoGeometrica, el: ElementoPlano, borda: 0 | 1): ElementoPlano | undefined {
  const bd = el.bordas[borda];
  return bd.tipo === 'elemento' ? sec.elementos[bd.indice] : undefined;
}

/** Ângulo entre a mesa e o enrijecedor, graus (90 = perpendicular), pelo produto escalar das direções. */
function anguloEntre(r1: TrechoReto, r2: TrechoReto): number {
  const d1 = { x: r1.b.x - r1.a.x, y: r1.b.y - r1.a.y };
  const d2 = { x: r2.b.x - r2.a.x, y: r2.b.y - r2.a.y };
  const c = Math.abs(d1.x * d2.x + d1.y * d2.y) / (Math.hypot(d1.x, d1.y) * Math.hypot(d2.x, d2.y));
  return (Math.acos(Math.min(1, c)) * 180) / Math.PI;
}

/**
 * A seção efetiva para o campo de tensões dado. E: módulo de elasticidade.
 * `D` (dimensão nominal do enrijecedor, cm) vem das dimensões do perfil.
 */
export function secaoEfetiva(sec: SecaoGeometrica, campo: CampoDeTensao, E: number): SecaoEfetiva {
  const t = sec.t;
  const Dnom = sec.dimensoes.D / 10;
  const foraDoCampo: string[] = [];
  const avisos: string[] = [];
  // ⚠️ A TENSÃO DO ELEMENTO É A DA FACE MAIS COMPRIMIDA DA CHAPA, não a da
  // linha média: 9.2.2.1 a) fala da "máxima tensão de compressão" quando a
  // seção atinge o início do escoamento, e na mesa comprimida ela é fy na
  // face externa. Pela linha média a mesa ficava com fy·7,4/7,5 no Ue 150 e
  // o Wef saía 0,25 % maior — achado da conferência independente às cegas
  // (01/11/2026, CONFERENCIA.md). Na compressão uniforme não muda nada.
  const naFace = (r: TrechoReto, p: Ponto) => {
    const L = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
    const nx = (-(r.b.y - r.a.y) / L) * (t / 2);
    const ny = ((r.b.x - r.a.x) / L) * (t / 2);
    return Math.max(tensaoEm(campo, { x: p.x + nx, y: p.y + ny }), tensaoEm(campo, { x: p.x - nx, y: p.y - ny }));
  };
  const resultado: ElementoEfetivo[] = sec.elementos.map((el, indice) => {
    const r = retaDoElemento(sec, el);
    return { indice, papel: el.papel, b: el.b, sa: naFace(r, r.a), sb: naFace(r, r.b), efetivos: [[0, el.b]] };
  });

  // 1. Mesas com enrijecedor de borda (e o enrijecedor junto).
  const tratados = new Set<number>();
  sec.elementos.forEach((el, i) => {
    const lados = [0, 1] as const;
    for (const lado of lados) {
      const viz = vizinho(sec, el, lado);
      if (!viz || viz.papel !== 'enrijecedor') continue;
      if (el.papel === 'enrijecedor') continue;
      // o enrijecedor tem de ter a outra borda livre: é o "de borda simples"
      const jEnr = (el.bordas[lado] as { indice: number }).indice;
      const enr = sec.elementos[jEnr];
      if (!enr.bordas.some((b) => b.tipo === 'livre')) continue;
      const me = resultado[i];
      const comprimida = Math.max(me.sa, me.sb);
      if (comprimida <= 0) continue; // mesa tracionada: inteira, e o enrijecedor também
      if (Math.abs(me.sa - me.sb) > QUASE_UNIFORME * Math.max(Math.abs(me.sa), Math.abs(me.sb))) {
        foraDoCampo.push(`${el.papel} com enrijecedor de borda e tensão variando: 9.2.3 é só para elemento uniformemente comprimido`);
        continue;
      }
      const sigma = comprimida;
      // enrijecedor como AL (9.2.2.1): apoio na borda ligada à mesa
      const re = resultado[jEnr];
      const apoioEnr: 'a' | 'b' = enr.bordas[0].tipo === 'elemento' && enr.bordas[0].indice === i ? 'a' : 'b';
      const sApoio = apoioEnr === 'a' ? re.sa : re.sb;
      const sLivre = apoioEnr === 'a' ? re.sb : re.sa;
      const larguraEnr = elementoAL(enr.b, t, sApoio, sLivre, E, apoioEnr);
      const def = Math.min(...[larguraEnr.efetivos.reduce((s, [a, b]) => s + (b - a), 0), enr.b]);
      const theta = anguloEntre(retaDoElemento(sec, el), retaDoElemento(sec, enr));
      const ms = mesaComEnrijecedor(el.b, enr.b, Dnom, t, theta, sigma, E, def);
      avisos.push(...ms.avisos);
      foraDoCampo.push(...ms.foraDoCampo);
      // mesa: bef,2 junto da outra borda (a alma), bef,1 junto do enrijecedor
      const b = el.b;
      let efetivosMesa: Trecho[];
      if (ms.mesa.bef >= b - 1e-12) efetivosMesa = [[0, b]];
      else efetivosMesa = lado === 1 ? [[0, ms.bef2], [b - ms.bef1, b]] : [[0, ms.bef1], [b - ms.bef2, b]];
      me.enrijecedor = ms;
      me.largura = ms.mesa;
      me.efetivos = efetivosMesa;
      // enrijecedor: fica ds a partir da mesa
      re.largura = larguraEnr;
      re.efetivos = apoioEnr === 'a' ? [[0, ms.ds]] : [[enr.b - ms.ds, enr.b]];
      tratados.add(i);
      tratados.add(jEnr);
    }
  });

  // 2. Os demais: AA (duas bordas presas) ou AL (uma livre).
  sec.elementos.forEach((el, i) => {
    if (tratados.has(i)) return;
    const re = resultado[i];
    const livreA = el.bordas[0].tipo === 'livre';
    const livreB = el.bordas[1].tipo === 'livre';
    if (livreA && livreB) {
      re.efetivos = [[0, el.b]];
      return;
    }
    const lw = livreA || livreB
      ? elementoAL(el.b, t, livreA ? re.sb : re.sa, livreA ? re.sa : re.sb, E, livreA ? 'b' : 'a')
      : elementoAA(el.b, t, re.sa, re.sb, E);
    re.largura = lw;
    re.efetivos = lw.efetivos;
  });

  // 3. A linha média efetiva e as propriedades.
  const trechos: TrechoDaLinha[] = [];
  const porTrecho = new Map(sec.elementos.map((el, i) => [el.trecho, i]));
  sec.trechos.forEach((tr, k) => {
    const i = porTrecho.get(k);
    if (i === undefined) trechos.push(tr); // canto: inteiro
    else trechos.push(...pedacos(tr as TrechoReto, resultado[i].efetivos));
  });
  const props = propriedades({ ...sec, trechos });
  return { elementos: resultado, props, trechos, foraDoCampo: [...new Set(foraDoCampo)], avisos: [...new Set(avisos)] };
}
