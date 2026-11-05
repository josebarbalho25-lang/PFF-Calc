// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/limites.ts — os valores máximos da relação largura-espessura
//  (NBR 14762:2010, 9.1.2 e Tabela 4)
// ---------------------------------------------------------------------------
//  ⚠️ A NORMA DIZ "NÃO DEVE ULTRAPASSAR": perfil fora da Tabela 4 está fora
//  do campo da norma, e sai "não atende" (recomendação do juiz da revisão de
//  01/11/2026; pergunta 5 ao José). Antes não era conferido: o Ue
//  300x40x12x0,95 do catálogo (alma b/t 312) saía "atende" sem aviso.
//
//  Cada elemento leva o menor limite dos casos que o alcançam:
//  - borda livre (AL), e AA preso a um enrijecedor de borda simples: 60;
//  - AA preso só a elementos AA: 500;
//  - alma de U simples sob compressão (N > 0): 90;
//  - alma de viga (paralela a y, com Mx): 200; 300 com enrijecedores
//    transversais que valem (9.5); o 260 (enrijecedor só nos apoios) não tem
//    entrada na tela — fica o 200, a favor.
//  Os casos "comprimido" valem sempre, a favor da segurança: perfil com
//  b/t acima disso não é de catálogo.
// ═══════════════════════════════════════════════════════════════════════════

import type { ElementoPlano, SecaoGeometrica, TrechoReto } from '../secao/tipos';
import { fr, n, v, x, situacaoPelaRazao, type Conta, type Verificacao } from './memoria';
import type { Esforcos } from './tipos';

interface Limite {
  valor: number;
  caso: string;
}

/**
 * A alma de U simples: entre duas mesas de borda livre que saem para o MESMO
 * lado dela (no Z saem para lados opostos, e o 90 da Tabela 4 é só do U). Vale
 * para a família U e para o U desenhado.
 */
function almaDeUSimples(sec: SecaoGeometrica, el: ElementoPlano): boolean {
  if (el.papel !== 'alma') return false;
  const mesas = el.bordas.map((b) => (b.tipo === 'elemento' ? sec.elementos[b.indice] : undefined));
  if (!mesas.every((m) => m && m.papel === 'mesa' && m.bordas.some((b) => b.tipo === 'livre'))) return false;
  const a = sec.trechos[el.trecho] as TrechoReto;
  const u = { x: a.b.x - a.a.x, y: a.b.y - a.a.y };
  // de que lado da linha da alma fica o meio de cada mesa
  const lado = (m: ElementoPlano) => {
    const r = sec.trechos[m.trecho] as TrechoReto;
    const c = { x: (r.a.x + r.b.x) / 2 - a.a.x, y: (r.a.y + r.b.y) / 2 - a.a.y };
    return Math.sign(u.x * c.y - u.y * c.x);
  };
  return lado(mesas[0]!) === lado(mesas[1]!);
}

function limitesDoElemento(sec: SecaoGeometrica, i: number, f: Esforcos, almaEnrijecida: boolean): Limite[] {
  const el = sec.elementos[i];
  const lim: Limite[] = [];
  const livre = el.bordas.some((b) => b.tipo === 'livre');
  if (livre) lim.push({ valor: 60, caso: 'elemento AL' });
  else {
    const vizinhos = el.bordas.map((b) => (b.tipo === 'elemento' ? sec.elementos[b.indice] : undefined));
    const comEnrijecedorSimples = vizinhos.some((vz) => vz?.papel === 'enrijecedor');
    const vizinhosAA = vizinhos.every((vz) => vz && !vz.bordas.some((b) => b.tipo === 'livre'));
    if (comEnrijecedorSimples) lim.push({ valor: 60, caso: 'AA com enrijecedor de borda simples' });
    else if (vizinhosAA) lim.push({ valor: 500, caso: 'AA preso a elementos AA' });
    if (almaDeUSimples(sec, el) && f.N > 0) lim.push({ valor: 90, caso: 'alma de U simples comprimida' });
  }
  const r = sec.trechos[el.trecho] as TrechoReto;
  const vertical = Math.abs((r.b.y - r.a.y) / el.b) > 0.999;
  if (el.papel === 'alma' && vertical && !livre && f.Mx !== 0) {
    lim.push(almaEnrijecida ? { valor: 300, caso: 'alma de viga com enrijecedores transversais' } : { valor: 200, caso: 'alma de viga sem enrijecedores transversais' });
  }
  return lim;
}

export function verificarLarguraEspessura(sec: SecaoGeometrica, f: Esforcos, almaEnrijecida: boolean): Verificacao {
  const contas: Conta[] = [];
  let pior = 0;
  let piorBt = 0;
  let piorLim = Infinity;
  sec.elementos.forEach((el, i) => {
    const lims = limitesDoElemento(sec, i, f, almaEnrijecida);
    if (!lims.length) return;
    const m = lims.reduce((a, b) => (b.valor < a.valor ? b : a));
    const te = el.t ?? sec.t; // a nervura de 2t do tubo tem a espessura dela
    const bt = el.b / te;
    contas.push({ simbolo: x(fr(v('b'), v('t')), ` ${el.papel}`), numeros: fr(n(el.b), n(te)), valor: bt, casas: 1, rotulo: `≤ ${m.valor} (${m.caso})` });
    if (bt / m.valor > pior) {
      pior = bt / m.valor;
      piorBt = bt;
      piorLim = m.valor;
    }
  });
  return {
    chave: 'larguraEspessura',
    titulo: 'Largura-espessura',
    item: '9.1.2',
    sd: piorBt,
    rd: piorLim,
    unidade: '',
    razao: pior,
    situacao: situacaoPelaRazao(pior),
    governa: pior > 1 ? 'fora da Tabela 4' : undefined,
    passos: [{ ref: '9.1.2; Tabela 4', titulo: 'Valores máximos da relação largura-espessura', contas }],
    avisos: [],
  };
}
