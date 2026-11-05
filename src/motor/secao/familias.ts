// ═══════════════════════════════════════════════════════════════════════════
//  motor/secao/familias.ts — das dimensões digitadas à linha média
// ---------------------------------------------------------------------------
//  Cada família vira, primeiro, a linha média em CANTO VIVO (a poligonal que
//  liga as interseções das linhas médias), a partir das dimensões externas da
//  NBR 6355. Depois cada vértice interno é arredondado com o raio médio
//  rm = ri + t/2, concêntrico com as faces interna e externa da dobra.
//
//  Por que assim: com o arco concêntrico, a parte reta da linha média tem o
//  mesmo comprimento da parte plana nas duas faces — é a largura b que a
//  norma manda usar na largura efetiva, sem os cantos. E a mesma poligonal
//  em canto vivo é o que o protótipo de faixas finitas do José usa, então dá
//  para conferir um contra o outro com `cantoVivo`.
// ═══════════════════════════════════════════════════════════════════════════

import { desenhoDoUe2, montarUe2 } from './composta';
import { montarDoDesenho } from './grafo';
import type { Borda, DimensoesDoPerfil, ElementoPlano, PapelDoElemento, Ponto, SecaoDesenhada, SecaoGeometrica, Trecho } from './tipos';

/** A geometria pedida não fecha (dobra maior que o trecho, dimensão negativa). */
export class GeometriaInvalida extends Error {}

export const MM = 0.1; // mm → cm

export interface Poligonal {
  vertices: Ponto[];
  /** Papel de cada lado da poligonal, na ordem. */
  papeis: PapelDoElemento[];
}

/**
 * A linha média em canto vivo, em cm. Origem e orientação escolhidas para o
 * desenho e para o sinal das coisas (ver os comentários de cada família):
 * NÃO é o centroide — quem precisa dele calcula.
 */
function poligonal(d: DimensoesDoPerfil): Poligonal {
  const t = d.t * MM;
  const bw = d.bw * MM;
  const bf = d.bf * MM;
  const D = d.D * MM;
  const h = bw - t; // alma, de linha média a linha média das mesas

  switch (d.familia) {
    // Alma vertical em x = 0, mesas para +x: o "[" dos desenhos de projeto.
    // A abertura fica do lado +x; o centro de torção cai atrás da alma (x < 0).
    case 'U':
      return {
        vertices: [
          { x: bf - t / 2, y: h / 2 },
          { x: 0, y: h / 2 },
          { x: 0, y: -h / 2 },
          { x: bf - t / 2, y: -h / 2 },
        ],
        papeis: ['mesa', 'alma', 'mesa'],
      };
    case 'Ue': {
      // bf vai da face externa da alma à face externa do enrijecedor; D, da
      // face externa da mesa à ponta do enrijecedor.
      const a = bf - t;
      const c = D - t / 2;
      return {
        vertices: [
          { x: a, y: h / 2 - c },
          { x: a, y: h / 2 },
          { x: 0, y: h / 2 },
          { x: 0, y: -h / 2 },
          { x: a, y: -h / 2 },
          { x: a, y: -h / 2 + c },
        ],
        papeis: ['enrijecedor', 'mesa', 'alma', 'mesa', 'enrijecedor'],
      };
    }
    // Mesa de cima para +x, a de baixo para −x: simétrico em relação ao ponto.
    case 'Z':
      return {
        vertices: [
          { x: bf - t / 2, y: h / 2 },
          { x: 0, y: h / 2 },
          { x: 0, y: -h / 2 },
          { x: -(bf - t / 2), y: -h / 2 },
        ],
        papeis: ['mesa', 'alma', 'mesa'],
      };
    case 'Ze': {
      // O ângulo θ é entre o enrijecedor e o plano da mesa; abaixo de 90° o
      // enrijecedor se abre para fora (o Z a 45° do DimPerfil).
      //
      // ⚠️ D É MEDIDO AO LONGO DO ENRIJECEDOR, "desde o prolongamento da face
      // externa da mesa até a ponta" (NBR 14762, 9.2.3.1, Figura 2), e bf vai
      // até o canto externo (encontro das faces externas da mesa e do
      // enrijecedor). Com o enrijecedor inclinado de θ, esse canto fica a
      // (t/2)·tg(θ/2) além do vértice da linha média, medido nas duas
      // direções — a 90° dá t/2, as medidas do Ue. A convenção de bf do Z 45°
      // na NBR 6355 ainda vai ser conferida na tabela dela (pergunta 4).
      const th = ((d.anguloEnrijecedor ?? 90) * Math.PI) / 180;
      const recuo = (t / 2) * Math.tan(th / 2);
      const a = bf - t / 2 - recuo;
      const c = D - recuo;
      const dx = c * Math.cos(th);
      const dy = c * Math.sin(th);
      return {
        vertices: [
          { x: a + dx, y: h / 2 - dy },
          { x: a, y: h / 2 },
          { x: 0, y: h / 2 },
          { x: 0, y: -h / 2 },
          { x: -a, y: -h / 2 },
          { x: -a - dx, y: -h / 2 + dy },
        ],
        papeis: ['enrijecedor', 'mesa', 'alma', 'mesa', 'enrijecedor'],
      };
    }
    // Cartola, como a figura da Tabela 9 da norma: as duas ALMAS são as chapas
    // verticais (bw = altura externa), a MESA é a de cima (bf = largura
    // externa) e os enrijecedores saem para fora, embaixo, com D medido "a
    // partir da face externa da alma" até a ponta — a linha média do
    // enrijecedor tem D + t/2. Simétrica em relação ao eixo y.
    //
    // ⚠️ A designação "Cr 100 x 50 x 20" é bw × bf × D: 100 é a altura das
    // paredes (resposta do José, 01/11/2026, pelo DimPerfil). A tabela de
    // críticos de Pierin foi calculada com a leitura oposta — só o gabarito
    // dela guarda essa geometria (`gerarCatalogoPerfis.py`, CONFERENCIA §1).
    case 'Cr': {
      const meia = (bf - t) / 2;
      const alto = (bw - t) / 2;
      const c = D + t / 2;
      return {
        vertices: [
          { x: -meia - c, y: -alto },
          { x: -meia, y: -alto },
          { x: -meia, y: alto },
          { x: meia, y: alto },
          { x: meia, y: -alto },
          { x: meia + c, y: -alto },
        ],
        papeis: ['enrijecedor', 'alma', 'mesa', 'alma', 'enrijecedor'],
      };
    }
    // Cantoneira: o vértice das linhas médias na origem, uma aba em y e a
    // outra em x. bw e bf são as abas, de face externa à ponta.
    case 'L':
      return {
        vertices: [
          { x: 0, y: bw - t / 2 },
          { x: 0, y: 0 },
          { x: bf - t / 2, y: 0 },
        ],
        papeis: ['aba', 'aba'],
      };
    // Cantoneira enrijecida: os enrijecedores voltados para dentro do ângulo.
    case 'Le': {
      const c = D - t / 2;
      return {
        vertices: [
          { x: c, y: bw - t },
          { x: 0, y: bw - t },
          { x: 0, y: 0 },
          { x: bf - t, y: 0 },
          { x: bf - t, y: c },
        ],
        papeis: ['enrijecedor', 'aba', 'aba', 'enrijecedor'],
      };
    }
    // As seções em grafo não passam por aqui (`montarSecao` desvia antes).
    case 'Desenho':
    case 'Ue2':
      throw new GeometriaInvalida(`a família ${d.familia} não tem poligonal fixa`);
  }
}

function validarDimensoes(d: DimensoesDoPerfil): void {
  const precisa = (nome: string, v: number, minimo: number) => {
    if (!Number.isFinite(v) || v < minimo) throw new GeometriaInvalida(`${nome} = ${v} mm: tem de ser um número ≥ ${minimo}`);
  };
  precisa('t', d.t, 1e-6);
  precisa('ri', d.ri, 0);
  precisa('bw', d.bw, 2 * d.t);
  precisa('bf', d.bf, 2 * d.t);
  const temEnrijecedor = d.familia === 'Ue' || d.familia === 'Ze' || d.familia === 'Cr' || d.familia === 'Le';
  if (temEnrijecedor) precisa('D', d.D, d.t);
  if (d.familia === 'Ze') {
    const th = d.anguloEnrijecedor ?? 90;
    if (!(th > 0 && th <= 90)) throw new GeometriaInvalida(`ângulo do enrijecedor = ${th}°: tem de estar entre 0° e 90°`);
  }
}

const sub = (a: Ponto, b: Ponto): Ponto => ({ x: a.x - b.x, y: a.y - b.y });
const soma = (a: Ponto, b: Ponto, k = 1): Ponto => ({ x: a.x + k * b.x, y: a.y + k * b.y });
const norma = (a: Ponto) => Math.hypot(a.x, a.y);
const unit = (a: Ponto): Ponto => {
  const n = norma(a);
  return { x: a.x / n, y: a.y / n };
};

/**
 * Arredonda os vértices internos da poligonal com o raio médio `rm`.
 *
 * Em cada vértice, as tangentes ficam a d = rm·tan(φ/2) do vértice (φ = o
 * quanto a linha vira ali). Se dois arredondamentos vizinhos comerem mais que
 * o lado entre eles, a seção não existe com esse raio — erro, não conta.
 */
export function arredondar(p: Poligonal, rm: number): { trechos: Trecho[]; retos: number[] } {
  const v = p.vertices;
  const n = v.length;
  const recuo = new Array<number>(n).fill(0);
  const arcos: (Trecho | null)[] = new Array(n).fill(null);
  for (let i = 1; i < n - 1; i++) {
    const u1 = unit(sub(v[i], v[i - 1]));
    const u2 = unit(sub(v[i + 1], v[i]));
    const cruz = u1.x * u2.y - u1.y * u2.x;
    const phi = Math.atan2(Math.abs(cruz), u1.x * u2.x + u1.y * u2.y);
    if (rm === 0 || phi < 1e-12) continue;
    const d = rm * Math.tan(phi / 2);
    recuo[i] = d;
    const t1 = soma(v[i], u1, -d);
    const lado = cruz > 0 ? 1 : -1; // vira à esquerda → centro à esquerda
    const normal = { x: -u1.y * lado, y: u1.x * lado };
    const centro = soma(t1, normal, rm);
    const ang0 = Math.atan2(t1.y - centro.y, t1.x - centro.x);
    arcos[i] = { tipo: 'arco', centro, raio: rm, ang0, ang1: ang0 + lado * phi };
  }

  const trechos: Trecho[] = [];
  const retos: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const u = unit(sub(v[i + 1], v[i]));
    const lado = norma(sub(v[i + 1], v[i]));
    const sobra = lado - recuo[i] - recuo[i + 1];
    // ⚠️ PARTE PLANA NULA TAMBÉM É RECUSADA (achado B5 da revisão de
    // 01/11/2026): com sobra zero, a faixa sem largura travava as faixas
    // finitas com uma mensagem que não dizia o que estava errado.
    if (sobra <= 1e-9 && rm > 0) {
      throw new GeometriaInvalida(`${p.papeis[i]}: a parte plana some na dobra — curto demais para o raio de dobramento`);
    }
    if (arcos[i]) trechos.push(arcos[i]!);
    retos.push(trechos.length);
    trechos.push({ tipo: 'reta', a: soma(v[i], u, recuo[i]), b: soma(v[i + 1], u, -recuo[i + 1]) });
  }
  return { trechos, retos };
}

/**
 * A seção pronta para a conta.
 *
 * `cantoVivo` monta a linha média sem os arcos — o modelo do protótipo de
 * faixas finitas e o padrão da especificação do motor. As propriedades da
 * calculadora usam o canto arredondado.
 */
/**
 * O perfil da família como desenho (nós e trechos na linha média, mm): ao
 * trocar para "seção desenhada", o editor abre com o perfil que estava na
 * tela, e não em branco.
 */
export function desenhoDaFamilia(d: DimensoesDoPerfil): SecaoDesenhada {
  if (d.familia === 'Desenho') return d.desenho ?? { nos: [], trechos: [] };
  if (d.familia === 'Ue2') return desenhoDoUe2(d);
  const redondo = (v: number) => Math.round(v * 10000) / 1000; // cm → mm, no milésimo (t = 2,65 tem meia espessura 1,325)
  const nos = poligonal(d).vertices.map((p) => ({ x: redondo(p.x), y: redondo(p.y) }));
  return { nos, trechos: nos.slice(1).map((_, i) => ({ i, j: i + 1 })) };
}

export function montarSecao(d: DimensoesDoPerfil, opcoes: { cantoVivo?: boolean } = {}): SecaoGeometrica {
  if (d.familia === 'Desenho') return montarDoDesenho(opcoes.cantoVivo ? { ...d, ri: 0 } : d);
  if (d.familia === 'Ue2') {
    validarDimensoes({ ...d, familia: 'Ue' });
    return montarUe2(d);
  }
  validarDimensoes(d);
  const t = d.t * MM;
  const rm = opcoes.cantoVivo ? 0 : d.ri * MM + t / 2;
  const p = poligonal(d);
  const { trechos, retos } = arredondar(p, rm);

  const ultimo = retos.length - 1;
  const elementos: ElementoPlano[] = retos.map((k, i) => {
    const r = trechos[k] as Extract<Trecho, { tipo: 'reta' }>;
    const borda = (vizinho: number): Borda => (vizinho < 0 || vizinho > ultimo ? { tipo: 'livre' } : { tipo: 'elemento', indice: vizinho });
    return { papel: p.papeis[i], trecho: k, b: norma(sub(r.b, r.a)), bordas: [borda(i - 1), borda(i + 1)] };
  });

  return { dimensoes: d, t, rm, trechos, elementos };
}
