// ═══════════════════════════════════════════════════════════════════════════
//  motor/faixas/malha.ts — da linha média da seção à malha de faixas
// ---------------------------------------------------------------------------
//  F1: cada trecho reto vira n faixas iguais (padrão 4); o canto em arco vira
//  m faixas ao longo do arco (cordas com os nós sobre o arco). Com o canto
//  vivo, a seção já vem sem arcos (`montarSecao(…, { cantoVivo: true })`).
//
//  As tensões de referência (F6) saem das propriedades DESTA malha, não das
//  da seção exata: o autovalor tem de ver a mesma área e a mesma inércia que
//  a malha tem, senão a compressão "pura" fica com um resto de flexão.
// ═══════════════════════════════════════════════════════════════════════════

import { E_ACO, G_ACO, NU_ACO } from '../catalogos/acos';
import type { PapelDoElemento, Ponto, SecaoGeometrica } from '../secao/tipos';

export interface Faixa {
  i: number;
  j: number;
  t: number;
}

/** Grau de liberdade do nó: 0 = U (x), 1 = V (longitudinal), 2 = W (y), 3 = Θ. */
export type GrauDeLiberdade = 0 | 1 | 2 | 3;

export interface Malha {
  nos: Ponto[];
  faixas: Faixa[];
  E: number;
  nu: number;
  G: number;
  /** Graus de liberdade vinculados: [nó, gl]. */
  vinculos: [number, GrauDeLiberdade][];
  /** Molas distribuídas: rigidez por unidade de comprimento. */
  molas: { no: number; gl: GrauDeLiberdade; k: number }[];
}

export interface OpcoesDaMalha {
  faixasPorTrecho?: number;
  faixasPorCanto?: number;
  /** Faixas por trecho conforme o papel do elemento (vence `faixasPorTrecho`). */
  porPapel?: Partial<Record<PapelDoElemento, number>>;
}

/**
 * A malha da seção em grafo (ramo, célula fechada): cada trecho picado entre
 * os seus dois nós, que são compartilhados — o ramo em T e a célula fechada
 * saem da própria montagem, que soma a rigidez nos graus de liberdade do nó.
 * Cada faixa leva a espessura do seu trecho.
 */
function malhaDoGrafo(sec: SecaoGeometrica, op: OpcoesDaMalha): Malha {
  const g = sec.grafo!;
  const m = op.faixasPorCanto ?? 2;
  const papelDoTrecho = new Map(sec.elementos.map((el) => [el.trecho, el.papel]));
  const nos: Ponto[] = [...g.nos];
  const faixas: Faixa[] = [];
  sec.trechos.forEach((tr, k) => {
    const [na, nb] = g.extremos[k];
    const papel = papelDoTrecho.get(k);
    const n = tr.tipo === 'reta' ? ((papel && op.porPapel?.[papel]) ?? op.faixasPorTrecho ?? 4) : m;
    const ponto = (s: number): Ponto =>
      tr.tipo === 'reta'
        ? { x: tr.a.x + (tr.b.x - tr.a.x) * s, y: tr.a.y + (tr.b.y - tr.a.y) * s }
        : { x: tr.centro.x + tr.raio * Math.cos(tr.ang0 + (tr.ang1 - tr.ang0) * s), y: tr.centro.y + tr.raio * Math.sin(tr.ang0 + (tr.ang1 - tr.ang0) * s) };
    let anterior = na;
    for (let q = 1; q <= n; q++) {
      const atual = q === n ? nb : nos.push(ponto(q / n)) - 1;
      faixas.push({ i: anterior, j: atual, t: g.espessuras[k] });
      anterior = atual;
    }
  });
  return { nos, faixas, E: E_ACO, nu: NU_ACO, G: G_ACO, vinculos: [], molas: [] };
}

/** A malha da seção, na ordem da cadeia (ou do grafo, quando houver). */
export function malhaDaSecao(sec: SecaoGeometrica, op: OpcoesDaMalha = {}): Malha {
  if (sec.grafo) return malhaDoGrafo(sec, op);
  const m = op.faixasPorCanto ?? 2;
  const papelDoTrecho = new Map(sec.elementos.map((el) => [el.trecho, el.papel]));
  const nos: Ponto[] = [];
  const empurra = (p: Ponto) => {
    const u = nos[nos.length - 1];
    if (!u || Math.hypot(u.x - p.x, u.y - p.y) > 1e-12) nos.push(p);
  };
  for (const [indice, tr] of sec.trechos.entries()) {
    if (tr.tipo === 'reta') {
      const papel = papelDoTrecho.get(indice);
      const n = (papel && op.porPapel?.[papel]) ?? op.faixasPorTrecho ?? 4;
      for (let k = 0; k <= n; k++) empurra({ x: tr.a.x + ((tr.b.x - tr.a.x) * k) / n, y: tr.a.y + ((tr.b.y - tr.a.y) * k) / n });
    } else {
      for (let k = 0; k <= m; k++) {
        const f = tr.ang0 + ((tr.ang1 - tr.ang0) * k) / m;
        empurra({ x: tr.centro.x + tr.raio * Math.cos(f), y: tr.centro.y + tr.raio * Math.sin(f) });
      }
    }
  }
  const faixas = nos.slice(1).map((_, k) => ({ i: k, j: k + 1, t: sec.t }));
  return { nos, faixas, E: E_ACO, nu: NU_ACO, G: G_ACO, vinculos: [], molas: [] };
}

/** Propriedades pela malha (F6): A, centroide, Ixx = ∫y² dA, Iyy = ∫x² dA, Ixy = ∫xy dA. */
export function propriedadesDaMalha(m: Malha) {
  let A = 0, Sx = 0, Sy = 0;
  for (const { i, j, t } of m.faixas) {
    const a = m.nos[i];
    const b = m.nos[j];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    A += L * t;
    Sx += (L * t * (a.x + b.x)) / 2;
    Sy += (L * t * (a.y + b.y)) / 2;
  }
  const xc = Sx / A;
  const yc = Sy / A;
  let Ixx = 0, Iyy = 0, Ixy = 0;
  for (const { i, j, t } of m.faixas) {
    const xi = m.nos[i].x - xc, yi = m.nos[i].y - yc;
    const xj = m.nos[j].x - xc, yj = m.nos[j].y - yc;
    const L = Math.hypot(xj - xi, yj - yi);
    Ixx += (t * L * (yi * yi + yi * yj + yj * yj)) / 3;
    Iyy += (t * L * (xi * xi + xi * xj + xj * xj)) / 3;
    Ixy += (t * L * (2 * xi * yi + xi * yj + xj * yi + 2 * xj * yj)) / 6;
  }
  return { A, xc, yc, Ixx, Iyy, Ixy };
}

/** O esforço de referência, nas definições de F6. */
export interface EsforcoDeReferencia {
  /** Compressão positiva, kN. */
  P?: number;
  /** Mx = ∫σ·y dA, com TRAÇÃO positiva (F6), kN·cm. */
  Mx?: number;
  /** My = ∫σ·x dA, com tração positiva, kN·cm. */
  My?: number;
}

/**
 * Tensão em cada nó, COMPRESSÃO POSITIVA (F6). Flexão livre por padrão: a
 * linha neutra se inclina se a seção não é simétrica (Z, cantoneira). Com
 * `restrita`, cada momento age só no próprio eixo.
 */
export function tensoesDeReferencia(m: Malha, f: EsforcoDeReferencia, restrita = false): Float64Array {
  const p = propriedadesDaMalha(m);
  const P = f.P ?? 0;
  const Mx = f.Mx ?? 0;
  const My = f.My ?? 0;
  let bx: number;
  let cy: number;
  if (restrita) {
    bx = My / p.Iyy;
    cy = Mx / p.Ixx;
  } else {
    const det = p.Ixx * p.Iyy - p.Ixy ** 2;
    bx = (My * p.Ixx - Mx * p.Ixy) / det;
    cy = (Mx * p.Iyy - My * p.Ixy) / det;
  }
  return Float64Array.from(m.nos, (no) => -(-P / p.A + bx * (no.x - p.xc) + cy * (no.y - p.yc)));
}
