// ═══════════════════════════════════════════════════════════════════════════
//  motor/faixas/faixa.ts — a faixa isolada: rigidez elástica e geométrica
// ---------------------------------------------------------------------------
//  Especificação da fase 1, F2 a F5 (Cheung 1976; Schafer 1997). A faixa é
//  uma placa plana entre duas linhas nodais: membrana em estado plano de
//  tensão e flexão de Kirchhoff, desacopladas no sistema local. Um termo
//  longitudinal, extremidades simplesmente apoiadas.
//
//  ⚠️ A RIGIDEZ SAI SEPARADA POR POTÊNCIA DE k = π/a: K(k) = Σ k^p·Kp, p = 0..4,
//  e a geométrica é k²·G. É a otimização do protótipo: a seção é montada UMA
//  vez e cada comprimento de meia-onda só combina as parcelas.
//
//  O fator a/2 (integral de sen² ou cos² ao longo de a) é comum às duas
//  matrizes e cancela no autovalor; fica de fora, e as molas seguem a mesma
//  regra (F5).
//
//  Graus de liberdade locais: [u1 v1 u2 v2 w1 θ1 w2 θ2], θ = ∂w/∂x'.
// ═══════════════════════════════════════════════════════════════════════════

import { gauss } from '../quadratura';

/** Matriz 8×8 por linhas. */
export type M8 = Float64Array;

/** Integral em x' exata: o integrando tem grau ≤ 7 (F3). */
const G4 = gauss(4);

/** Funções de Hermite e derivadas em x' (não em ξ). */
function hermite(xi: number, b: number) {
  const N = [1 - 3 * xi ** 2 + 2 * xi ** 3, b * (xi - 2 * xi ** 2 + xi ** 3), 3 * xi ** 2 - 2 * xi ** 3, b * (xi ** 3 - xi ** 2)];
  const dN = [(-6 * xi + 6 * xi ** 2) / b, 1 - 4 * xi + 3 * xi ** 2, (6 * xi - 6 * xi ** 2) / b, 3 * xi ** 2 - 2 * xi];
  const d2N = [(-6 + 12 * xi) / b ** 2, (-4 + 6 * xi) / b, (6 - 12 * xi) / b ** 2, (6 * xi - 2) / b];
  return { N, dN, d2N };
}

/** acc[lin0+i, col0+j] += f · (Bᵢ)ᵀ D (Bⱼ), B com 3 linhas e 4 colunas. */
function somaBtDB(acc: M8, base: number, Bi: number[][], D: number[][], Bj: number[][], f: number): void {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let a = 0; a < 3; a++) {
        const bra = Bi[a][r];
        if (bra === 0) continue;
        for (let b = 0; b < 3; b++) s += bra * D[a][b] * Bj[b][c];
      }
      acc[(base + r) * 8 + base + c] += f * s;
    }
  }
}

/**
 * As matrizes locais da faixa (F3, F4). `Kp[p]` multiplica k^p; `Kg`
 * multiplica k². s1 e s2: tensões nas bordas i e j, compressão positiva.
 */
export function coeficientesDaFaixa(
  b: number,
  t: number,
  E: number,
  nu: number,
  G: number,
  s1: number,
  s2: number,
): { Kp: M8[]; Kg: M8 } {
  const c = E / (1 - nu * nu);
  const D = [
    [c, nu * c, 0],
    [nu * c, c, 0],
    [0, 0, G],
  ];
  const Dm = D.map((l) => l.map((v) => v * t));
  const Db = D.map((l) => l.map((v) => (v * t ** 3) / 12));
  const Kp = [0, 1, 2, 3, 4].map(() => new Float64Array(64));
  const Kg = new Float64Array(64);
  const zero = [0, 0, 0, 0];

  G4.xi.forEach((xi, q) => {
    const wx = G4.w[q] * b;
    // Membrana: Bm = B0 + k·B1 (linhas εx, εy, γxy).
    const Bm = [
      [
        [-1 / b, 0, 1 / b, 0],
        [0, 0, 0, 0],
        [0, -1 / b, 0, 1 / b],
      ],
      [
        [0, 0, 0, 0],
        [0, -(1 - xi), 0, -xi],
        [1 - xi, 0, xi, 0],
      ],
    ];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) somaBtDB(Kp[i + j], 0, Bm[i], Dm, Bm[j], wx);

    // Flexão: Bb = Bb0 + k·Bb1 + k²·Bb2 (linhas κx, κy, κxy).
    const { N, dN, d2N } = hermite(xi, b);
    const Bb = [
      [d2N.map((v) => -v), zero, zero],
      [zero, zero, dN.map((v) => -2 * v)],
      [zero, N, zero],
    ];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) somaBtDB(Kp[i + j], 4, Bb[i], Db, Bb[j], wx);

    // Geométrica (coeficiente de k²): tensão linear na largura.
    const sig = s1 + (s2 - s1) * xi;
    const gu = [1 - xi, 0, xi, 0];
    const gv = [0, 1 - xi, 0, xi];
    const f = wx * t * sig;
    for (let r = 0; r < 4; r++) {
      for (let s = 0; s < 4; s++) {
        Kg[r * 8 + s] += f * (gu[r] * gu[s] + gv[r] * gv[s]);
        Kg[(4 + r) * 8 + 4 + s] += f * N[r] * N[s];
      }
    }
  });
  return { Kp, Kg };
}

/**
 * T leva [U1 V1 W1 Θ1 U2 V2 W2 Θ2] (global) para [u1 v1 u2 v2 w1 θ1 w2 θ2]
 * (local), com c = cos α e s = sen α da faixa (F5):
 * u = c·U + s·W, w = −s·U + c·W, v = V, θ = Θ.
 */
export function transformacao(c: number, s: number): M8 {
  const T = new Float64Array(64);
  const p = (l: number, col: number, v: number) => (T[l * 8 + col] = v);
  p(0, 0, c), p(0, 2, s);
  p(1, 1, 1);
  p(2, 4, c), p(2, 6, s);
  p(3, 5, 1);
  p(4, 0, -s), p(4, 2, c);
  p(5, 3, 1);
  p(6, 4, -s), p(6, 6, c);
  p(7, 7, 1);
  return T;
}

/** Tᵀ·k·T. */
export function girar(k: M8, T: M8): M8 {
  const kt = new Float64Array(64);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      let s = 0;
      for (let m = 0; m < 8; m++) s += k[i * 8 + m] * T[m * 8 + j];
      kt[i * 8 + j] = s;
    }
  const out = new Float64Array(64);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      let s = 0;
      for (let m = 0; m < 8; m++) s += T[m * 8 + i] * kt[m * 8 + j];
      out[i * 8 + j] = s;
    }
  return out;
}
