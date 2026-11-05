// ═══════════════════════════════════════════════════════════════════════════
//  ui/desenho/edicao.ts — as operações do desenho: nó, trecho, polilinha
// ---------------------------------------------------------------------------
//  Conta pura sobre `SecaoDesenhada` (mm): cada operação devolve um desenho
//  NOVO e nunca mexe no que recebeu — é o que deixa o desfazer guardar só
//  fotografias.
//
//  ⚠️ O PONTO QUE CAI EM CIMA DE UM TRECHO PARTE O TRECHO. É assim que se
//  faz o ramo em T: clica-se no meio da alma e sai a mesa dali. Sem partir,
//  o nó novo ficaria encostado na alma sem estar ligado a ela, e o motor
//  diria "não está ligado ao resto" — o projetista veria o T desenhado e o
//  erro, sem entender a briga.
//  Pelo mesmo motivo, o trecho novo que passa por cima de um nó existente é
//  ligado em pedaços, nó a nó.
//
//  ⚠️ O PRIMEIRO PONTO DA POLILINHA NÃO VIRA NÓ SOZINHO. Fica pendurado na
//  polilinha até o segundo ponto: um nó sem trecho é recusado pelo motor, e
//  a barra de estado acenderia em vermelho a cada polilinha começada.
// ═══════════════════════════════════════════════════════════════════════════

import type { NoDesenhado, SecaoDesenhada, TrechoDesenhado } from '../../motor/secao/tipos';
import { distanciaAoSegmento } from './encaixe';

/** Dois pontos a menos disto (mm) são o mesmo nó. */
export const TOL = 1e-3;

export const DESENHO_VAZIO: SecaoDesenhada = { nos: [], trechos: [] };

/** A ponta da polilinha em curso: um nó, ou o primeiro ponto ainda sem trecho. */
export type Ponta = { tipo: 'no'; k: number } | { tipo: 'ponto'; p: NoDesenhado };

export interface Polilinha {
  ponta: Ponta | null;
  /** O primeiro nó da polilinha (para o Fechar). */
  inicio: number | null;
}

export const SEM_POLILINHA: Polilinha = { ponta: null, inicio: null };

/** O alvo de um ponto: nó existente, ou um lugar do plano. */
export type Alvo = { tipo: 'no'; k: number } | { tipo: 'ponto'; p: NoDesenhado };

export interface Resultado {
  desenho: SecaoDesenhada;
  polilinha: Polilinha;
  aviso?: string;
}

const mesmoPar = (tr: TrechoDesenhado, a: number, b: number) => (tr.i === a && tr.j === b) || (tr.i === b && tr.j === a);

export function existeTrecho(d: SecaoDesenhada, a: number, b: number): boolean {
  return d.trechos.some((tr) => mesmoPar(tr, a, b));
}

/** O nó que está neste lugar, ou −1. */
export function indiceDoNo(d: SecaoDesenhada, p: NoDesenhado): number {
  return d.nos.findIndex((n) => Math.hypot(n.x - p.x, n.y - p.y) < TOL);
}

/** Interior do segmento: perto da reta e longe das duas pontas. */
function noMeio(p: NoDesenhado, a: NoDesenhado, b: NoDesenhado): number | null {
  const { d, s } = distanciaAoSegmento(p, a, b);
  if (d >= TOL) return null;
  if (Math.hypot(p.x - a.x, p.y - a.y) < TOL || Math.hypot(p.x - b.x, p.y - b.y) < TOL) return null;
  return s;
}

/**
 * O nó deste lugar: o existente, ou um novo no fim da lista. O nó novo que
 * cai no meio de trechos parte cada um deles em dois (mesma espessura) — o
 * cruzamento de dois trechos vira junção de quatro.
 */
export function noNoPonto(d: SecaoDesenhada, p: NoDesenhado): { desenho: SecaoDesenhada; k: number } {
  const existente = indiceDoNo(d, p);
  if (existente >= 0) return { desenho: d, k: existente };
  const k = d.nos.length;
  const nos = [...d.nos, { x: p.x, y: p.y }];
  const trechos: TrechoDesenhado[] = [];
  for (const tr of d.trechos) {
    if (noMeio(p, d.nos[tr.i], d.nos[tr.j]) === null) {
      trechos.push(tr);
      continue;
    }
    const t = tr.t !== undefined ? { t: tr.t } : {};
    trechos.push({ i: tr.i, j: k, ...t }, { i: k, j: tr.j, ...t });
  }
  return { desenho: { nos, trechos }, k };
}

/**
 * Liga o nó a ao nó b. Os nós existentes que ficam no caminho entram na
 * ligação (a–n1–n2–b); o pedaço que já existe não se repete.
 */
export function ligar(d: SecaoDesenhada, a: number, b: number, t?: number): { desenho: SecaoDesenhada; aviso?: string } {
  if (a === b) return { desenho: d, aviso: 'mesmo nó' };
  const A = d.nos[a];
  const B = d.nos[b];
  const meio = d.nos
    .map((n, k) => ({ k, s: k === a || k === b ? null : noMeio(n, A, B) }))
    .filter((m): m is { k: number; s: number } => m.s !== null)
    .sort((m, n) => m.s - n.s)
    .map((m) => m.k);
  const cadeia = [a, ...meio, b];
  const novos: TrechoDesenhado[] = [];
  for (let q = 0; q + 1 < cadeia.length; q++) {
    const [i, j] = [cadeia[q], cadeia[q + 1]];
    if (!existeTrecho(d, i, j)) novos.push(t !== undefined ? { i, j, t } : { i, j });
  }
  if (!novos.length) return { desenho: d, aviso: 'trecho já existe' };
  return { desenho: { nos: d.nos, trechos: [...d.trechos, ...novos] } };
}

/** O lugar da ponta da polilinha, mm. */
export function lugarDaPonta(d: SecaoDesenhada, pl: Polilinha): NoDesenhado | null {
  if (!pl.ponta) return null;
  return pl.ponta.tipo === 'ponto' ? pl.ponta.p : (d.nos[pl.ponta.k] ?? null);
}

/** A polilinha que ainda vale para este desenho (o pai pode ter trocado o desenho por fora). */
export function polilinhaValida(d: SecaoDesenhada, pl: Polilinha): Polilinha {
  const n = d.nos.length;
  if (pl.ponta?.tipo === 'no' && pl.ponta.k >= n) return SEM_POLILINHA;
  if (pl.inicio !== null && pl.inicio >= n) return { ...pl, inicio: null };
  return pl;
}

/**
 * Um ponto da polilinha (clique ou digitado). Sem ponta, começa: num nó
 * existente, ou num ponto que espera o segundo. Com ponta, liga a ponta ao
 * alvo e anda a ponta até ele.
 */
export function aplicarPonto(d: SecaoDesenhada, pl: Polilinha, alvo: Alvo): Resultado {
  // ponto que cai num nó existente é o nó
  if (alvo.tipo === 'ponto') {
    const k = indiceDoNo(d, alvo.p);
    if (k >= 0) alvo = { tipo: 'no', k };
  }
  const ponta = pl.ponta;
  if (!ponta) {
    if (alvo.tipo === 'no') return { desenho: d, polilinha: { ponta: alvo, inicio: alvo.k } };
    return { desenho: d, polilinha: { ponta: alvo, inicio: null } };
  }

  let desenho = d;
  let a: number;
  if (ponta.tipo === 'no') a = ponta.k;
  else {
    if (alvo.tipo === 'ponto' && Math.hypot(alvo.p.x - ponta.p.x, alvo.p.y - ponta.p.y) < TOL) return { desenho: d, polilinha: pl, aviso: 'mesmo ponto' };
    ({ desenho, k: a } = noNoPonto(desenho, ponta.p));
  }
  let b: number;
  if (alvo.tipo === 'no') b = alvo.k;
  else ({ desenho, k: b } = noNoPonto(desenho, alvo.p));

  if (a === b) return { desenho: d, polilinha: pl, aviso: 'mesmo nó' };
  const r = ligar(desenho, a, b);
  return { desenho: r.desenho, polilinha: { ponta: { tipo: 'no', k: b }, inicio: pl.inicio ?? a }, aviso: r.aviso };
}

/** Pode fechar: a ponta é um nó diferente do início e os dois não estão ligados. */
export function podeFechar(d: SecaoDesenhada, pl: Polilinha): boolean {
  return pl.ponta?.tipo === 'no' && pl.inicio !== null && pl.ponta.k !== pl.inicio && !existeTrecho(d, pl.ponta.k, pl.inicio);
}

/** Fechar: liga a ponta ao primeiro nó e termina a polilinha (o "C" do LINE). */
export function fecharPolilinha(d: SecaoDesenhada, pl: Polilinha): Resultado {
  if (!podeFechar(d, pl) || pl.ponta?.tipo !== 'no' || pl.inicio === null) return { desenho: d, polilinha: pl, aviso: 'nada a fechar' };
  const r = ligar(d, pl.ponta.k, pl.inicio);
  return { desenho: r.desenho, polilinha: SEM_POLILINHA, aviso: r.aviso };
}

/** Apaga o nó e os trechos dele; os nós de depois descem um número. */
export function apagarNo(d: SecaoDesenhada, k: number): SecaoDesenhada {
  if (k < 0 || k >= d.nos.length) return d;
  const novo = (v: number) => (v > k ? v - 1 : v);
  return {
    nos: d.nos.filter((_, q) => q !== k),
    trechos: d.trechos.filter((tr) => tr.i !== k && tr.j !== k).map((tr) => ({ ...tr, i: novo(tr.i), j: novo(tr.j) })),
  };
}

/** Apaga só o trecho; os nós ficam (a tabela). */
export function apagarTrecho(d: SecaoDesenhada, k: number): SecaoDesenhada {
  if (k < 0 || k >= d.trechos.length) return d;
  return { nos: d.nos, trechos: d.trechos.filter((_, q) => q !== k) };
}

/**
 * Tira os nós sem trecho, renumerando. É o apagar do quadro: apagar a linha
 * no CAD leva junto as pontas que só existiam por ela.
 */
export function tirarSoltos(d: SecaoDesenhada): SecaoDesenhada {
  const usado = d.nos.map((_, k) => d.trechos.some((tr) => tr.i === k || tr.j === k));
  if (usado.every(Boolean)) return d;
  const novoIndice: number[] = [];
  let n = 0;
  for (const u of usado) novoIndice.push(u ? n++ : -1);
  return {
    nos: d.nos.filter((_, k) => usado[k]),
    trechos: d.trechos.map((tr) => ({ ...tr, i: novoIndice[tr.i], j: novoIndice[tr.j] })),
  };
}

export function moverNo(d: SecaoDesenhada, k: number, p: NoDesenhado): SecaoDesenhada {
  return { nos: d.nos.map((n, q) => (q === k ? { x: p.x, y: p.y } : n)), trechos: d.trechos };
}

/** Muda nó i, nó j ou espessura de um trecho; `t: undefined` volta à espessura da seção. */
export function mudarTrecho(d: SecaoDesenhada, k: number, mudanca: Partial<TrechoDesenhado>): SecaoDesenhada {
  return {
    nos: d.nos,
    trechos: d.trechos.map((tr, q) => {
      if (q !== k) return tr;
      const novo = { ...tr, ...mudanca };
      if (novo.t === undefined) delete novo.t;
      return novo;
    }),
  };
}

/** Linha nova na tabela de nós: um passo à direita do último, num lugar livre. */
export function novoNo(d: SecaoDesenhada, passo: number): SecaoDesenhada {
  const dx = passo > 0 ? passo : 1;
  const base = d.nos.length ? d.nos[d.nos.length - 1] : { x: -dx, y: 0 };
  let p = { x: base.x + dx, y: base.y };
  while (indiceDoNo(d, p) >= 0) p = { x: p.x + dx, y: p.y };
  return { nos: [...d.nos, p], trechos: d.trechos };
}

/**
 * Linha nova na tabela de trechos: o primeiro par ainda sem trecho, a partir
 * dos últimos nós (é onde se está desenhando). Sem par livre, nada.
 */
export function novoTrecho(d: SecaoDesenhada): SecaoDesenhada | null {
  const n = d.nos.length;
  for (let j = n - 1; j >= 1; j--)
    for (let i = j - 1; i >= 0; i--) if (!existeTrecho(d, i, j)) return { nos: d.nos, trechos: [...d.trechos, { i, j }] };
  return null;
}
