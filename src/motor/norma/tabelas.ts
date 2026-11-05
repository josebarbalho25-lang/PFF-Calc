// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/tabelas.ts — as tabelas da NBR 14762:2010 que a conta lê
// ---------------------------------------------------------------------------
//  Transcritas da página renderizada (PDF p. 47, 49, 53 e 56) e conferidas
//  célula a célula em recorte ampliado. "Para valores intermediários,
//  interpolar linearmente" (notas das tabelas).
//
//  ⚠️ AS DIMENSÕES DAS TABELAS SÃO AS NOMINAIS (externas), como nas figuras
//  da Tabela 9 — bf, bw e D do perfil, não a linha média.
// ═══════════════════════════════════════════════════════════════════════════

/** Interpolação linear numa lista (x crescente). Fora da faixa: undefined. */
export function interpolar(xs: number[], ys: number[], x: number): number | undefined {
  if (x < xs[0] - 1e-12 || x > xs[xs.length - 1] + 1e-12) return undefined;
  for (let i = 0; i < xs.length - 1; i++) {
    if (x <= xs[i + 1] + 1e-12) {
      const f = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + Math.min(Math.max(f, 0), 1) * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}

/** Bilinear numa grade (linhas em x crescente, colunas em y crescente). */
function bilinear(xs: number[], ys: number[], grade: number[][], x: number, y: number): number | undefined {
  const porColuna = ys.map((_, j) => interpolar(xs, grade.map((linha) => linha[j]), x));
  if (porColuna.some((v) => v === undefined)) return undefined;
  return interpolar(ys, porColuna as number[], y);
}

// ── Tabela 10 — kℓ, compressão centrada ────────────────────────────────────
const ETA_10 = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
/** Caso a — U simples e Z simples. */
const KL10_A = [4.25, 4.52, 4.33, 3.71, 2.88, 2.17, 1.67, 1.32, 1.06, 0.88];
/** Caso b — U enrijecido, Z enrijecido e cartola (0,1 ≤ D/bw ≤ 0,3); começa em η = 0,2. */
const KL10_B = [NaN, 6.04, 5.73, 5.55, 5.4, 5.26, 5.11, 4.89, 4.56, 4.1];

/** Caso d: seção tubular retangular com solda de costura contínua (dois U ou Ue). */
const KL10_D = [NaN, 5.67, 5.44, 5.29, 5.16, 5.03, 4.87, 4.66, 4.37, 4.0];

export function klCompressao(caso: 'a' | 'b' | 'd', eta: number): number | undefined {
  if (caso === 'a') return interpolar(ETA_10, KL10_A, eta);
  return interpolar(ETA_10.slice(1), (caso === 'b' ? KL10_B : KL10_D).slice(1), eta);
}

// ── Tabela 13 — kℓ, flexão em torno do eixo de maior inércia ───────────────
const ETA_13 = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const KL13_A = [18.4, 9.6, 5.6, 3.6, 2.6, 1.9, 1.5, 1.2, 1.0];
/** Caso b por μ = D/bw: até 0,2; 0,25; 0,3. */
const MU_13 = [0.2, 0.25, 0.3];
const KL13_B = [
  [32.0, 25.8, 21.2],
  [29.3, 23.8, 19.7],
  [24.8, 20.7, 18.2],
  [18.7, 17.6, 16.0],
  [13.6, 13.3, 13.0],
  [10.2, 10.1, 10.1],
  [7.9, 7.9, 7.9],
  [6.2, 6.3, 6.3],
  [5.1, 5.1, 5.1],
];

/** Caso c: seção tubular retangular com solda de costura contínua. */
const KL13_C = [31.0, 28.9, 25.6, 19.5, 14.2, 10.6, 8.2, 6.6, 5.3];

export function klFlexao(caso: 'a' | 'b' | 'c', eta: number, mu = 0): number | undefined {
  if (caso === 'a') return interpolar(ETA_13, KL13_A, eta);
  if (caso === 'c') return interpolar(ETA_13, KL13_C, eta);
  if (mu < 0.1 - 1e-12 || mu > 0.3 + 1e-12) return undefined;
  return bilinear(ETA_13, MU_13, KL13_B, eta, Math.max(mu, 0.2));
}

// ── Tabelas 11 e 14 — D/bw mínimo para dispensar o distorcional ────────────
const BF_BW = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0];
/** Colunas em bw/t CRESCENTE: 50, 100, 125, 200, 250 (a norma imprime de 250 a 50). */
const BW_T = [50, 100, 125, 200, 250];
const T11 = [
  [0.08, 0.04, 0.04, 0.03, 0.02],
  [0.15, 0.06, 0.06, 0.04, 0.03],
  [0.22, 0.1, 0.08, 0.06, 0.05],
  [0.27, 0.12, 0.1, 0.07, 0.06],
  [0.27, 0.15, 0.12, 0.07, 0.06],
  [0.27, 0.15, 0.12, 0.08, 0.06],
  [0.27, 0.15, 0.12, 0.08, 0.07],
  [0.27, 0.15, 0.12, 0.08, 0.07],
  [0.27, 0.15, 0.12, 0.08, 0.07],
];
const T14 = [
  [0.25, 0.12, 0.1, 0.06, 0.05],
  [0.25, 0.12, 0.1, 0.06, 0.05],
  [0.22, 0.12, 0.09, 0.06, 0.05],
  [0.22, 0.11, 0.09, 0.06, 0.05],
  [0.2, 0.11, 0.09, 0.06, 0.05],
  [0.2, 0.1, 0.09, 0.06, 0.05],
  [0.2, 0.1, 0.09, 0.06, 0.05],
  [0.19, 0.1, 0.09, 0.06, 0.05],
  [0.19, 0.1, 0.09, 0.06, 0.05],
];

/** O D/bw mínimo da Tabela 11 (compressão) ou 14 (flexão); undefined fora da tabela. */
export function dispensaDistorcional(tabela: 11 | 14, bfbw: number, bwt: number): number | undefined {
  return bilinear(BF_BW, BW_T, tabela === 11 ? T11 : T14, bfbw, bwt);
}
