// ═══════════════════════════════════════════════════════════════════════════
//  motor/faixas/motor.ts — a seção montada uma vez, resolvida em qualquer
//  lista de comprimentos de meia-onda
// ---------------------------------------------------------------------------
//  F5 e F7 da especificação. K(k) = Σ k^p·Kp é positiva definida; KG = k²·G
//  não é na flexão (parte da seção está tracionada). Por isso resolve-se o
//  problema invertido: G·φ = μ·K·φ, μ = 1/(λ·k²). O maior μ positivo é o
//  crítico do esforço aplicado; o menor μ negativo, o do esforço invertido —
//  uma rodada dá os dois sentidos do momento.
//
//  É o `Engine` do protótipo Python do José, que é o gabarito: o selo
//  `motor.test.ts` confere os dois na mesma malha.
// ═══════════════════════════════════════════════════════════════════════════

import { autoSistema, autovalores, cholesky, congruenciaInversa, matriz, NaoPositivaDefinida, resolverTransposta, type Matriz } from './algebra';
import { coeficientesDaFaixa, girar, transformacao } from './faixa';
import type { Malha } from './malha';

/** A seção não forma um problema de autovalor: desconexa, t = 0, vinculação insuficiente. */
export class SecaoInstavel extends Error {}

export interface Solucao {
  L: number[];
  /** Crítico para o esforço aplicado (Infinity: não flamba nesse sentido). */
  lamPos: number[];
  /** Crítico para o esforço invertido. */
  lamNeg: number[];
}

export interface Modo {
  L: number;
  lam: number;
  /** Deslocamentos nodais [U V W Θ] por nó, normalizados pelo maior = 1. */
  deslocamentos: Float64Array;
}

export class MotorDeFaixas {
  readonly malha: Malha;
  readonly tensoes: Float64Array;
  private readonly livres: number[];
  private readonly Kp: (Matriz | null)[];
  private readonly G: Matriz;
  private readonly nTotal: number;

  constructor(malha: Malha, tensoes: Float64Array) {
    this.malha = malha;
    this.tensoes = tensoes;
    const n = 4 * malha.nos.length;
    this.nTotal = n;
    const Kp = [0, 1, 2, 3, 4].map(() => new Float64Array(n * n));
    const G = new Float64Array(n * n);
    for (const { i, j, t } of malha.faixas) {
      const a = malha.nos[i];
      const b = malha.nos[j];
      const bLarg = Math.hypot(b.x - a.x, b.y - a.y);
      if (!(bLarg > 0 && t > 0)) throw new SecaoInstavel(`faixa ${i}–${j} sem largura ou sem espessura`);
      const c = (b.x - a.x) / bLarg;
      const s = (b.y - a.y) / bLarg;
      const { Kp: kl, Kg } = coeficientesDaFaixa(bLarg, t, malha.E, malha.nu, malha.G, tensoes[i], tensoes[j]);
      const T = transformacao(c, s);
      const idx = [4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3, 4 * j, 4 * j + 1, 4 * j + 2, 4 * j + 3];
      const soma = (alvo: Float64Array, k8: Float64Array) => {
        for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) alvo[idx[r] * n + idx[q]] += k8[r * 8 + q];
      };
      kl.forEach((k8, p) => soma(Kp[p], girar(k8, T)));
      soma(G, girar(Kg, T));
    }
    for (const { no, gl, k } of malha.molas) Kp[0][(4 * no + gl) * n + 4 * no + gl] += k;

    const presos = new Set(malha.vinculos.map(([no, gl]) => 4 * no + gl));
    this.livres = Array.from({ length: n }, (_, d) => d).filter((d) => !presos.has(d));
    const recortar = (M: Float64Array): Matriz => {
      const m = this.livres.length;
      const R = matriz(m);
      this.livres.forEach((di, a) => this.livres.forEach((dj, b) => (R.a[a * m + b] = M[di * n + dj])));
      return R;
    };
    this.Kp = Kp.map((M) => (M.some((v) => v !== 0) ? recortar(M) : null));
    this.G = recortar(G);
  }

  private rigidez(k: number): Matriz {
    const m = this.livres.length;
    const K = matriz(m);
    this.Kp.forEach((M, p) => {
      if (!M) return;
      const f = k ** p;
      for (let q = 0; q < m * m; q++) K.a[q] += f * M.a[q];
    });
    return K;
  }

  /**
   * ⚠️ A PRECISÃO CAI COM L⁴. Em k pequeno a rigidez dos modos moles vem só
   * das parcelas k³ e k⁴, pequenas diante de K0, e o arredondamento cresce
   * com o condicionamento de K. Medido (01/11/2026): o mesmo λ com a seção
   * girada e espelhada difere 2e−11 no distorcional, 1,5e−9 em 5 m e 1e−6 em
   * 20 m. Equilibrar a escala de K antes do Cholesky não melhorou (testado e
   * desfeito). Na faixa longa a calculadora usa as fórmulas da norma.
   */
  private fatorar(L: number) {
    const k = Math.PI / L;
    try {
      const Lc = cholesky(this.rigidez(k));
      return { k, Lc, C: congruenciaInversa(Lc, this.G) };
    } catch (err) {
      if (err instanceof NaoPositivaDefinida) {
        throw new SecaoInstavel('K não é positiva definida: seção desconexa, espessura nula ou vinculação insuficiente');
      }
      throw err;
    }
  }

  /** Os críticos nos dois sentidos, para cada comprimento de meia-onda (cm). */
  resolver(comprimentos: number[]): Solucao {
    const lamPos: number[] = [];
    const lamNeg: number[] = [];
    for (const L of comprimentos) {
      const { k, C } = this.fatorar(L);
      const mu = autovalores(C);
      const { pos, neg } = criticos(mu, k);
      lamPos.push(pos);
      lamNeg.push(neg);
    }
    return { L: [...comprimentos], lamPos, lamNeg };
  }

  critico(L: number, sentido: 1 | -1 = 1): number {
    const r = this.resolver([L]);
    return sentido > 0 ? r.lamPos[0] : r.lamNeg[0];
  }

  /**
   * Os `quantos` primeiros modos de um sentido, num comprimento: para o
   * desenho da seção deformada (F7: "guardar os 3 primeiros modos").
   */
  modos(L: number, sentido: 1 | -1 = 1, quantos = 3): Modo[] {
    const { k, Lc, C } = this.fatorar(L);
    const { valores, vetores } = autoSistema(C);
    const m = this.livres.length;
    const tol = 1e-10 * Math.max(Math.abs(valores[0]), Math.abs(valores[m - 1]));
    const out: Modo[] = [];
    for (let q = 0; q < quantos; q++) {
      const col = sentido > 0 ? m - 1 - q : q;
      const mu = valores[col];
      if (!(sentido * mu > tol)) break;
      const psi = new Float64Array(m);
      for (let r = 0; r < m; r++) psi[r] = vetores.a[r * m + col];
      const phi = resolverTransposta(Lc, psi);
      const cheio = new Float64Array(this.nTotal);
      this.livres.forEach((d, r) => (cheio[d] = phi[r]));
      let pico = 0;
      for (const v of cheio) pico = Math.max(pico, Math.abs(v));
      if (pico > 0) for (let d = 0; d < cheio.length; d++) cheio[d] /= pico;
      out.push({ L, lam: 1 / (Math.abs(mu) * k * k), deslocamentos: cheio });
    }
    return out;
  }
}

/** μ desprezível (abaixo de 1e−10 do maior) é descartado: não há flambagem naquele sentido. */
function criticos(mu: Float64Array, k: number): { pos: number; neg: number } {
  const m = mu.length;
  const escala = Math.max(Math.abs(mu[0]), Math.abs(mu[m - 1]));
  const tol = 1e-10 * escala;
  const muMax = mu[m - 1];
  const muMin = mu[0];
  return {
    pos: muMax > tol ? 1 / (muMax * k * k) : Infinity,
    neg: muMin < -tol ? 1 / (-muMin * k * k) : Infinity,
  };
}
