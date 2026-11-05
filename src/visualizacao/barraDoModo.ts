// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/barraDoModo.ts — a barra inteira deformada por um modo das
//  faixas finitas, para o 3D da janela da flambagem local e distorcional
// ---------------------------------------------------------------------------
//  Conta pura. A forma é a do NOSSO modo, no comprimento escolhido na curva:
//  no plano da seção, U e W (e Θ, pela cúbica da faixa) vezes sen(πz/L); ao
//  longo da barra, V vezes cos(πz/L) — as funções da faixa finita (F2).
//  Dentro de cada faixa, as mesmas funções de forma do desenho 2D
//  (`linhaDeformada`), para a chapa ondular entre as dobras.
//
//  ⚠️ A COR É O DESLOCAMENTO DE CADA PONTO ÷ O MAIOR DA BARRA (0 a 1). O modo
//  não tem amplitude: a escala do desenho é só para ver.
// ═══════════════════════════════════════════════════════════════════════════

import type { Malha } from '../motor/faixas/malha';
import { escalaDoModo, linhaDeformada } from './desenhoDoModo';

export interface BarraDoModo {
  /** Posição indeformada e o deslocamento por unidade de amplitude, por vértice (x, y, z em cm). */
  base: Float32Array;
  delta: Float32Array;
  /** Deslocamento normalizado (0 a 1), por vértice. */
  intensidade: Float32Array;
  indices: Uint32Array;
  /** A seção indeformada em cada fim de meia-onda: pares de pontos (segmentos). */
  aneis: Float32Array;
  comprimento: number;
  meiasOndas: number;
  /** Fator que leva o maior deslocamento a ~18 % do tamanho da seção. */
  escala: number;
  tamanho: number;
}

/** Quantas meias-ondas mostrar: a barra com umas 2,5 vezes o tamanho da seção, de 1 a 10. */
export function meiasOndasParaVer(L: number, tamanho: number): number {
  return Math.max(1, Math.min(10, Math.round((2.5 * tamanho) / L)));
}

/** O mapa "jet": 0 azul-escuro, 0,5 verde-amarelado, 1 vermelho-escuro. */
export function jet(v: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, v));
  const f = (c: number) => Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - c)));
  return [f(3), f(2), f(1)];
}

export function barraDoModo(m: Malha, d: Float64Array, L: number, op: { porFaixa?: number; porMeiaOnda?: number; meiasOndas?: number } = {}): BarraDoModo {
  const porFaixa = op.porFaixa ?? 6;
  const xs = m.nos.map((p) => p.x);
  const ys = m.nos.map((p) => p.y);
  const tamanho = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const meiasOndas = op.meiasOndas ?? meiasOndasParaVer(L, tamanho);
  const comprimento = meiasOndas * L;
  const nz = meiasOndas * (op.porMeiaOnda ?? 18) + 1;
  const zero = linhaDeformada(m, d, 0, porFaixa);
  const um = linhaDeformada(m, d, 1, porFaixa);
  const nf = m.faixas.length;
  const np = porFaixa + 1;
  const nv = nf * np * nz;
  const base = new Float32Array(3 * nv);
  const delta = new Float32Array(3 * nv);
  const mag = new Float32Array(nv);
  let maior = 0;
  m.faixas.forEach(({ i, j }, f) => {
    for (let k = 0; k < np; k++) {
      const p0 = zero[f][k];
      const dx = um[f][k].x - p0.x;
      const dy = um[f][k].y - p0.y;
      const xi = k / porFaixa;
      const V = (1 - xi) * d[4 * i + 1] + xi * d[4 * j + 1];
      for (let q = 0; q < nz; q++) {
        const z = (comprimento * q) / (nz - 1);
        const s = Math.sin((Math.PI * z) / L);
        const c = Math.cos((Math.PI * z) / L);
        const v = (f * np + k) * nz + q;
        base.set([p0.x, p0.y, z], 3 * v);
        delta.set([dx * s, dy * s, V * c], 3 * v);
        mag[v] = Math.hypot(dx * s, dy * s, V * c);
        maior = Math.max(maior, mag[v]);
      }
    }
  });
  const intensidade = mag.map((x) => (maior > 0 ? x / maior : 0));
  const idx: number[] = [];
  for (let f = 0; f < nf; f++)
    for (let k = 0; k < porFaixa; k++)
      for (let q = 0; q < nz - 1; q++) {
        const a = (f * np + k) * nz + q;
        const b = (f * np + k + 1) * nz + q;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
  const aneis: number[] = [];
  for (let o = 0; o <= meiasOndas; o++)
    m.faixas.forEach(({ i, j }) => aneis.push(m.nos[i].x, m.nos[i].y, o * L, m.nos[j].x, m.nos[j].y, o * L));
  return { base, delta, intensidade, indices: Uint32Array.from(idx), aneis: Float32Array.from(aneis), comprimento, meiasOndas, escala: escalaDoModo(m, d), tamanho };
}
