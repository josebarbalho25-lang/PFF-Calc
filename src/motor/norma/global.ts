// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/global.ts — flambagem global elástica: Ne (9.7.2.1 a 9.7.2.3)
//  e o Me da flambagem lateral com torção (9.8.2.2 e Anexo E)
// ---------------------------------------------------------------------------
//  A norma escreve tudo nos EIXOS PRINCIPAIS. Aqui as propriedades da seção
//  (que estão nos eixos x e y do desenho) são giradas para os principais
//  antes de tudo; no U, no Ue e na cartola os dois coincidem, no Z e na
//  cantoneira não.
//
//  QUAL FÓRMULA DE Ne: decide a posição do centro de torção nos eixos
//  principais — nos dois zeros, dupla simetria ou ponto (9.7.2.1); num zero
//  só, monossimétrica (9.7.2.2), com o eixo de simetria sendo o que passa
//  pelo centro de torção; fora dos dois, assimétrica (9.7.2.3, a cúbica).
// ═══════════════════════════════════════════════════════════════════════════

import type { PropriedadesDaSecao } from '../secao/propriedades';

export interface Principais {
  A: number;
  /** I1 ≥ I2, cm⁴; α = ângulo do eixo 1 com o x do desenho, rad. */
  I1: number;
  I2: number;
  alfa: number;
  /** Centro de torção em relação ao centroide, nos eixos principais, cm. */
  x0: number;
  y0: number;
  r0: number;
  J: number;
  Cw: number;
}

const QUASE_ZERO = 1e-9;

export function principais(pr: PropriedadesDaSecao): Principais {
  const c = Math.cos(pr.alfa);
  const s = Math.sin(pr.alfa);
  return {
    A: pr.A,
    I1: pr.I1,
    I2: pr.I2,
    alfa: pr.alfa,
    x0: pr.x0 * c + pr.y0 * s,
    y0: -pr.x0 * s + pr.y0 * c,
    r0: pr.r0,
    J: pr.J,
    Cw: pr.Cw,
  };
}

/** A forma da seção para a flambagem global, pelo centro de torção. */
export type Simetria = 'dupla' | 'mono1' | 'mono2' | 'assimetrica';

export function simetria(p: Principais): Simetria {
  const escala = Math.sqrt((p.I1 + p.I2) / p.A);
  const z1 = Math.abs(p.x0) < QUASE_ZERO * escala;
  const z2 = Math.abs(p.y0) < QUASE_ZERO * escala;
  if (z1 && z2) return 'dupla';
  // Centro de torção sobre o eixo 1 (y0 = 0): o eixo 1 é o de simetria.
  if (z2) return 'mono1';
  if (z1) return 'mono2';
  return 'assimetrica';
}

export interface ForcaGlobal {
  Ne1: number;
  Ne2: number;
  Nez: number;
  /** Nexz da monossimétrica (acoplada ao eixo de simetria), quando houver. */
  Neacoplada?: number;
  Ne: number;
  simetria: Simetria;
  /** O modo que governou: flexão em 1, em 2, torção, flexo-torção. */
  modo: 'flexao1' | 'flexao2' | 'torcao' | 'flexotorcao';
}

/** Euler: π²EI/(KL)². Comprimento zero = travada: não flamba. */
export function euler(E: number, I: number, KL: number): number {
  return KL > 0 ? (Math.PI ** 2 * E * I) / KL ** 2 : Infinity;
}

/** 9.7.2.1 c): Nez = [π²E·Cw/(KzLz)² + G·J] / r0². */
export function torcao(p: Principais, E: number, G: number, KzLz: number): number {
  if (!(KzLz > 0)) return Infinity;
  return ((Math.PI ** 2 * E * p.Cw) / KzLz ** 2 + G * p.J) / p.r0 ** 2;
}

/** 9.7.2.2 b): flexo-torção da monossimétrica, com o eixo de simetria "x" e x0. */
export function flexoTorcao(Nex: number, Nez: number, x0: number, r0: number): number {
  if (!Number.isFinite(Nex)) return Nez;
  if (!Number.isFinite(Nez)) return Nex;
  const b = 1 - (x0 / r0) ** 2;
  return ((Nex + Nez) / (2 * b)) * (1 - Math.sqrt(1 - (4 * Nex * Nez * b) / (Nex + Nez) ** 2));
}

/**
 * 9.7.2.3: a menor raiz positiva de
 * r0²(N − Nex)(N − Ney)(N − Nez) − N²(N − Ney)x0² − N²(N − Nex)y0² = 0.
 * Ela fica entre 0 e o menor dos três (f(0) < 0 e f(min) ≥ 0): bisseção.
 */
export function cubica(Nex: number, Ney: number, Nez: number, x0: number, y0: number, r0: number): number {
  const f = (N: number) => r0 ** 2 * (N - Nex) * (N - Ney) * (N - Nez) - N ** 2 * (N - Ney) * x0 ** 2 - N ** 2 * (N - Nex) * y0 ** 2;
  let lo = 0;
  let hi = Math.min(Nex, Ney, Nez);
  if (!Number.isFinite(hi)) return Infinity;
  for (let i = 0; i < 200 && hi - lo > 1e-12 * hi; i++) {
    const m = 0.5 * (lo + hi);
    if (f(m) < 0) lo = m;
    else hi = m;
  }
  return 0.5 * (lo + hi);
}

/**
 * 9.8.2.2: Me = Cb·r0·(Ney·Nez)^0,5 — dupla simetria, ou monossimétrica
 * fletida em torno do eixo de simetria. `fator` = 0,5 no Z ponto-simétrico
 * com carga no plano da alma. Ney é a flexão em torno do eixo perpendicular
 * ao do momento (o "y" da norma).
 */
export function momentoFLT(Cb: number, r0: number, Ney: number, Nez: number, fator = 1): number {
  if (!Number.isFinite(Ney) || !Number.isFinite(Nez)) return Infinity;
  return fator * Cb * r0 * Math.sqrt(Ney * Nez);
}

/**
 * Anexo E: monossimétrica fletida em torno do eixo perpendicular ao de
 * simetria. Na notação do anexo, x é o eixo de simetria, orientado para o
 * centro de torção ficar do lado negativo; x0 entra positivo.
 *
 *   Me = (Cs·Nex/Cm)·[j + Cs·(j² + r0²·Nez/Nex)^0,5]
 *   j = [∫x³ dA + ∫x·y² dA]/(2·Iy) + x0
 *
 * Cs = +1 quando o momento comprime o lado do centro de torção (x < 0).
 * Cm = 0,6 − 0,4·(M1/M2), ou 1,0 se algum momento intermediário passar de M2.
 */
export function momentoAnexoE(Cs: 1 | -1, Cm: number, Nex: number, Nez: number, j: number, r0: number): number {
  if (!Number.isFinite(Nex) || !Number.isFinite(Nez)) return Infinity;
  return ((Cs * Nex) / Cm) * (j + Cs * Math.sqrt(j ** 2 + (r0 ** 2 * Nez) / Nex));
}

/** O j do Anexo E (E.2.1), com as integrais já na notação do anexo. */
export function parametroJ(intX3: number, intXY2: number, Iy: number, x0abs: number): number {
  return (intX3 + intXY2) / (2 * Iy) + x0abs;
}

/**
 * Ne da barra. KL1 e KL2 são os comprimentos de flambagem por flexão em torno
 * dos eixos principais 1 e 2; KzLz, o de torção.
 */
export function forcaGlobal(p: Principais, E: number, G: number, KL1: number, KL2: number, KzLz: number): ForcaGlobal {
  const Ne1 = euler(E, p.I1, KL1);
  const Ne2 = euler(E, p.I2, KL2);
  const Nez = torcao(p, E, G, KzLz);
  const sim = simetria(p);
  if (sim === 'dupla') {
    const Ne = Math.min(Ne1, Ne2, Nez);
    return { Ne1, Ne2, Nez, Ne, simetria: sim, modo: Ne === Ne1 ? 'flexao1' : Ne === Ne2 ? 'flexao2' : 'torcao' };
  }
  if (sim === 'mono1' || sim === 'mono2') {
    // 9.7.2.2: a flexão em torno do eixo de simetria acopla com a torção; a
    // outra fica solta.
    const acoplada = sim === 'mono1' ? flexoTorcao(Ne1, Nez, p.x0, p.r0) : flexoTorcao(Ne2, Nez, p.y0, p.r0);
    const solta = sim === 'mono1' ? Ne2 : Ne1;
    const Ne = Math.min(solta, acoplada);
    return {
      Ne1,
      Ne2,
      Nez,
      Neacoplada: acoplada,
      Ne,
      simetria: sim,
      modo: Ne === acoplada ? 'flexotorcao' : sim === 'mono1' ? 'flexao2' : 'flexao1',
    };
  }
  const Ne = cubica(Ne1, Ne2, Nez, p.x0, p.y0, p.r0);
  return { Ne1, Ne2, Nez, Ne, simetria: sim, modo: 'flexotorcao' };
}
