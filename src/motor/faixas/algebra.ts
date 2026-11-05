// ═══════════════════════════════════════════════════════════════════════════
//  motor/faixas/algebra.ts — a álgebra que o motor de faixas finitas precisa
// ---------------------------------------------------------------------------
//  Matriz cheia, simétrica, em Float64Array por linhas. Três peças só:
//  Cholesky (K = L·Lᵀ), solução triangular e autovalores/autovetores de
//  matriz simétrica (Householder até tridiagonal, depois QL com deslocamento
//  implícito). É a mesma conta que o numpy faz no protótipo (LAPACK), escrita
//  aqui porque a calculadora roda no navegador sem biblioteca nenhuma.
//
//  Referência dos algoritmos: Golub & Van Loan, "Matrix Computations", caps. 4
//  (Cholesky) e 8 (tridiagonalização de Householder); o QL implícito é o
//  clássico de Bowdler, Martin, Reinsch e Wilkinson (1968), o tql2 do EISPACK.
//  O selo `algebra.test.ts` confere contra matrizes de autovalor conhecido.
// ═══════════════════════════════════════════════════════════════════════════

/** Matriz quadrada n×n, por linhas: a[i·n + j]. */
export interface Matriz {
  n: number;
  a: Float64Array;
}

export function matriz(n: number): Matriz {
  return { n, a: new Float64Array(n * n) };
}

/** A matriz não é positiva definida: seção desconexa, espessura nula, vinculação faltando. */
export class NaoPositivaDefinida extends Error {}

/**
 * Cholesky: devolve L (triangular inferior, na mesma forma de matriz cheia)
 * com K = L·Lᵀ. Falha se aparecer pivô ≤ 0.
 */
export function cholesky(K: Matriz): Matriz {
  const { n, a } = K;
  const L = matriz(n);
  const l = L.a;
  for (let j = 0; j < n; j++) {
    let s = a[j * n + j];
    for (let k = 0; k < j; k++) s -= l[j * n + k] * l[j * n + k];
    if (!(s > 0)) throw new NaoPositivaDefinida(`pivô ${j} = ${s}`);
    const d = Math.sqrt(s);
    l[j * n + j] = d;
    for (let i = j + 1; i < n; i++) {
      let t = a[i * n + j];
      for (let k = 0; k < j; k++) t -= l[i * n + k] * l[j * n + k];
      l[i * n + j] = t / d;
    }
  }
  return L;
}

/**
 * C = L⁻¹·G·L⁻ᵀ, simétrica, para G simétrica. Duas substituições para a
 * frente: M = L⁻¹·G e depois C = L⁻¹·Mᵀ (Mᵀ = G·L⁻ᵀ, porque G = Gᵀ).
 */
export function congruenciaInversa(L: Matriz, G: Matriz): Matriz {
  const n = L.n;
  const l = L.a;
  const M = new Float64Array(G.a); // será sobrescrita por L⁻¹·G
  const resolver = (B: Float64Array) => {
    // L·X = B, coluna a coluna, guardado por linhas: linha i depende das anteriores.
    for (let i = 0; i < n; i++) {
      const lii = l[i * n + i];
      for (let k = 0; k < i; k++) {
        const lik = l[i * n + k];
        if (lik === 0) continue;
        for (let c = 0; c < n; c++) B[i * n + c] -= lik * B[k * n + c];
      }
      for (let c = 0; c < n; c++) B[i * n + c] /= lii;
    }
  };
  resolver(M);
  // Mᵀ
  const T = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) T[j * n + i] = M[i * n + j];
  resolver(T);
  // Simetriza: o arredondamento das duas substituições deixa C quase simétrica.
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const m = 0.5 * (T[i * n + j] + T[j * n + i]);
      T[i * n + j] = m;
      T[j * n + i] = m;
    }
  }
  return { n, a: T };
}

/** x = L⁻ᵀ·y (substituição para trás com a transposta de L). */
export function resolverTransposta(L: Matriz, y: Float64Array): Float64Array {
  const n = L.n;
  const l = L.a;
  const x = new Float64Array(y);
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let k = i + 1; k < n; k++) s -= l[k * n + i] * x[k];
    x[i] = s / l[i * n + i];
  }
  return x;
}

/**
 * Tridiagonalização de Householder de A simétrica: A = Q·T·Qᵀ. Devolve a
 * diagonal d, a subdiagonal e (e[0] = 0, e[i] liga i−1 a i) e, se pedido, Q.
 */
function tridiagonalizar(A: Matriz, comQ: boolean): { d: Float64Array; e: Float64Array; Q: Float64Array | null } {
  const n = A.n;
  const a = new Float64Array(A.a); // trabalho
  const d = new Float64Array(n);
  const e = new Float64Array(n);
  // Reflexões guardadas para montar Q no fim: v_k, com β_k.
  const vs: Float64Array[] = [];
  const betas: number[] = [];
  const p = new Float64Array(n);
  for (let k = 0; k < n - 2; k++) {
    // Vetor x = A[k+1..n-1, k]
    let alfa = 0;
    for (let i = k + 1; i < n; i++) alfa += a[i * n + k] * a[i * n + k];
    alfa = Math.sqrt(alfa);
    const x0 = a[(k + 1) * n + k];
    let resto = 0;
    for (let i = k + 2; i < n; i++) resto += a[i * n + k] * a[i * n + k];
    if (resto === 0) {
      // Coluna já tridiagonal: nada a refletir.
      vs.push(new Float64Array(0));
      betas.push(0);
      continue;
    }
    const s = x0 >= 0 ? -alfa : alfa; // novo valor da subdiagonal
    const v = new Float64Array(n);
    v[k + 1] = x0 - s;
    for (let i = k + 2; i < n; i++) v[i] = a[i * n + k];
    let vv = 0;
    for (let i = k + 1; i < n; i++) vv += v[i] * v[i];
    const beta = 2 / vv;
    // A ← H·A·H com H = I − β v vᵀ, só no bloco k+1..n−1 e na coluna/linha k.
    // p = β·A·v ; K = β/2 · vᵀp ; w = p − K·v ; A ← A − v wᵀ − w vᵀ
    for (let i = k + 1; i < n; i++) {
      let s2 = 0;
      for (let j = k + 1; j < n; j++) s2 += a[i * n + j] * v[j];
      p[i] = beta * s2;
    }
    let vp = 0;
    for (let i = k + 1; i < n; i++) vp += v[i] * p[i];
    const Kc = 0.5 * beta * vp;
    for (let i = k + 1; i < n; i++) p[i] -= Kc * v[i];
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j <= i; j++) {
        const novo = a[i * n + j] - v[i] * p[j] - p[i] * v[j];
        a[i * n + j] = novo;
        a[j * n + i] = novo;
      }
    }
    a[(k + 1) * n + k] = s;
    a[k * n + k + 1] = s;
    for (let i = k + 2; i < n; i++) {
      a[i * n + k] = 0;
      a[k * n + i] = 0;
    }
    vs.push(v);
    betas.push(beta);
  }
  for (let i = 0; i < n; i++) d[i] = a[i * n + i];
  for (let i = 1; i < n; i++) e[i] = a[i * n + i - 1];

  let Q: Float64Array | null = null;
  if (comQ) {
    // Q = H_0·H_1·…·H_{n−3}, montada de trás para a frente sobre a identidade.
    Q = new Float64Array(n * n);
    for (let i = 0; i < n; i++) Q[i * n + i] = 1;
    for (let k = vs.length - 1; k >= 0; k--) {
      const v = vs[k];
      if (v.length === 0) continue;
      const beta = betas[k];
      for (let c = 0; c < n; c++) {
        let s2 = 0;
        for (let i = k + 1; i < n; i++) s2 += v[i] * Q[i * n + c];
        s2 *= beta;
        if (s2 === 0) continue;
        for (let i = k + 1; i < n; i++) Q[i * n + c] -= s2 * v[i];
      }
    }
  }
  return { d, e, Q };
}

/**
 * QL com deslocamento implícito na tridiagonal (d, e). Os autovalores voltam
 * em d; se Z vier, as rotações são acumuladas nas colunas dele (Z·rotações),
 * e as colunas viram os autovetores.
 */
function qlImplicito(d: Float64Array, eSub: Float64Array, Z: Float64Array | null): void {
  const n = d.length;
  // e[i] passa a ligar i a i+1.
  const e = new Float64Array(n);
  for (let i = 1; i < n; i++) e[i - 1] = eSub[i];
  e[n - 1] = 0;
  // ⚠️ DESPREZÍVEL TAMBÉM PERANTE A MATRIZ INTEIRA, não só os vizinhos. Com o
  // teste só relativo (|e| ≤ ε·(|d_m| + |d_m+1|)), um bloco de autovalores
  // nulos — G com linhas zeradas, na flexão restrita de alguns perfis — exige
  // e = 0 exato, e o QL girava sem fim (achado no lote, 01/11/2026). É o
  // critério do LAPACK: abaixo de ε·‖T‖ é zero.
  let norma = 0;
  for (let i = 0; i < n; i++) norma = Math.max(norma, Math.abs(d[i]) + Math.abs(e[i]));
  const piso = Number.EPSILON * norma;
  for (let l = 0; l < n; l++) {
    let iter = 0;
    for (;;) {
      let m = l;
      for (; m < n - 1; m++) {
        const dd = Math.abs(d[m]) + Math.abs(d[m + 1]);
        if (Math.abs(e[m]) <= Number.EPSILON * dd || Math.abs(e[m]) <= piso) break;
      }
      if (m === l) break;
      if (++iter > 100) throw new Error('autovalor: QL não convergiu');
      let g = (d[l + 1] - d[l]) / (2 * e[l]);
      let r = Math.hypot(g, 1);
      g = d[m] - d[l] + e[l] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
      let s = 1;
      let c = 1;
      let p = 0;
      let i = m - 1;
      for (; i >= l; i--) {
        let f = s * e[i];
        const b = c * e[i];
        r = Math.hypot(f, g);
        e[i + 1] = r;
        if (r === 0) {
          d[i + 1] -= p;
          e[m] = 0;
          break;
        }
        s = f / r;
        c = g / r;
        g = d[i + 1] - p;
        r = (d[i] - g) * s + 2 * c * b;
        p = s * r;
        d[i + 1] = g + p;
        g = c * r - b;
        if (Z) {
          for (let k = 0; k < n; k++) {
            f = Z[k * n + i + 1];
            Z[k * n + i + 1] = s * Z[k * n + i] + c * f;
            Z[k * n + i] = c * Z[k * n + i] - s * f;
          }
        }
      }
      if (r === 0 && i >= l) continue;
      d[l] -= p;
      e[l] = g;
      e[m] = 0;
    }
  }
}

/** Autovalores de A simétrica, em ordem crescente. */
export function autovalores(A: Matriz): Float64Array {
  const { d, e } = tridiagonalizar(A, false);
  qlImplicito(d, e, null);
  return d.sort();
}

/** Autovalores (crescentes) e autovetores (colunas de `vetores`, mesma ordem). */
export function autoSistema(A: Matriz): { valores: Float64Array; vetores: Matriz } {
  const n = A.n;
  const { d, e, Q } = tridiagonalizar(A, true);
  qlImplicito(d, e, Q);
  const ordem = Array.from(d.keys()).sort((i, j) => d[i] - d[j]);
  const valores = new Float64Array(ordem.map((i) => d[i]));
  const V = matriz(n);
  ordem.forEach((col, novo) => {
    for (let k = 0; k < n; k++) V.a[k * n + novo] = Q![k * n + col];
  });
  return { valores, vetores: V };
}
