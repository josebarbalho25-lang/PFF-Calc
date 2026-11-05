// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/larguraEfetiva.ts — a largura efetiva de um elemento plano
//  (NBR 14762:2010, 9.2.2.1 com as Tabelas 5 e 6, e 9.2.3.1)
// ---------------------------------------------------------------------------
//  Conta pura de UM elemento: entra a largura plana b, a espessura e as
//  tensões nas duas bordas (compressão positiva); sai o k, o λp, a largura
//  efetiva e QUAIS trechos do elemento ficam — medidos a partir da borda "a"
//  do trecho reto. Quem monta a seção efetiva tira o resto.
//
//  ⚠️ As tensões vêm com COMPRESSÃO POSITIVA, como no motor de faixas. A
//  norma desenha a compressão com sinal (−); aqui não.
// ═══════════════════════════════════════════════════════════════════════════

/** Trecho efetivo [início, fim], cm, medido da borda "a" do elemento. */
export type Trecho = [number, number];

export interface LarguraEfetiva {
  /** O caso da tabela da norma que valeu — vai para a memória. */
  caso: string;
  /** Coeficiente de flambagem local do elemento. */
  k: number;
  /** ψ = σ2/σ1 (σ1 a maior compressão). */
  psi: number;
  /** Tensão de cálculo do λp (σ1), kN/cm². */
  sigma: number;
  lambdaP: number;
  /** Largura efetiva bef da norma (ou bc·ρ nos casos com tração). */
  bef: number;
  /** Largura da parte comprimida, quando há tração. */
  bc?: number;
  /** Os trechos que ficam (efetivos), da borda "a". */
  efetivos: Trecho[];
}

const ZERO = 1e-12;

/** λp de 9.2.2.1: (b/t) / [0,95·(k·E/σ)^0,5]. */
export function lambdaP(b: number, t: number, k: number, E: number, sigma: number): number {
  return b / t / (0.95 * Math.sqrt((k * E) / sigma));
}

/** Fator ρ = bef/b de 9.2.2.1: 1 até 0,673; (1 − 0,22/λp)/λp acima. */
export function fatorDeLargura(lp: number): number {
  return lp <= 0.673 ? 1 : (1 - 0.22 / lp) / lp;
}

function inteiro(b: number, caso: string, s1: number, s2: number): LarguraEfetiva {
  return { caso, k: NaN, psi: s1 > 0 ? s2 / s1 : NaN, sigma: Math.max(s1, s2, 0), lambdaP: 0, bef: b, efetivos: [[0, b]] };
}

/**
 * Elemento AA (Tabela 5). `sa` e `sb` são as tensões nas bordas a e b.
 * A borda de σ1 é a mais comprimida.
 */
export function elementoAA(b: number, t: number, sa: number, sb: number, E: number): LarguraEfetiva {
  if (sa <= ZERO && sb <= ZERO) return inteiro(b, 'tracionado', sa, sb);
  // Orienta: σ1 na borda "1". Se for a borda b, o resultado é espelhado no fim.
  const espelha = sb > sa;
  const s1 = espelha ? sb : sa;
  const s2 = espelha ? sa : sb;
  const psi = s2 / s1;
  let caso: string;
  let k: number;
  if (psi >= 1 - 1e-9) {
    caso = 'Tabela 5, caso a';
    k = 4;
  } else {
    caso = psi >= 0 ? 'Tabela 5, caso b' : psi > -0.236 ? 'Tabela 5, caso c' : 'Tabela 5, caso d';
    k = 4 + 2 * (1 - psi) + 2 * (1 - psi) ** 3;
  }
  const lp = lambdaP(b, t, k, E, s1);
  const bef = b * fatorDeLargura(lp);
  let efetivos: Trecho[];
  let bc: number | undefined;
  if (psi >= 1 - 1e-9) {
    // caso a: metade junto a cada borda
    efetivos = bef >= b - ZERO ? [[0, b]] : [[0, bef / 2], [b - bef / 2, b]];
  } else if (psi >= 0) {
    // caso b: bef,1 junto a σ1, bef,2 junto a σ2
    const b1 = bef / (3 - psi);
    const b2 = bef - b1;
    efetivos = bef >= b - ZERO ? [[0, b]] : [[0, b1], [b - b2, b]];
  } else {
    // casos c e d: a parte tracionada é toda efetiva; na comprimida (bc),
    // bef,1 junto a σ1 e bef,2 encostado na linha neutra
    bc = b / (1 - psi);
    const b1 = bef / (3 - psi);
    const b2 = psi > -0.236 ? bef - b1 : 0.5 * bef;
    efetivos = b1 + b2 >= bc - ZERO ? [[0, b]] : [[0, b1], [bc - b2, b]];
  }
  if (espelha) efetivos = efetivos.map(([i, f]) => [b - f, b - i] as Trecho).reverse();
  return { caso, k, psi, sigma: s1, lambdaP: lp, bef: Math.min(bef, b), bc, efetivos };
}

/**
 * Elemento AL (Tabela 6). `apoio` diz qual borda é a vinculada; `sApoio` e
 * `sLivre` são as tensões na borda vinculada e na livre.
 *
 * ⚠️ 9.2.2.1 manda os AL com ψ < 0 para a "Tabela 5" — erro de impressão: é
 * a Tabela 6, a dos AL (ESTADO.md §4). Com ψ < 0, bef = bc·ρ, com λp ainda
 * pela largura b do elemento (a fórmula de λp de 9.2.2.1 é uma só).
 *
 * ⚠️ CASO d COM TRAÇÃO NO APOIO (ψ < 0, ponta livre comprimida): a Figura
 * mede bef a partir da borda vinculada e a parte tracionada é toda efetiva.
 * Leitura adotada: o que sai é a ponta comprimida, (1 − ρ)·bc a partir da
 * borda livre. Conferir na revisão adversarial.
 */
export function elementoAL(b: number, t: number, sApoio: number, sLivre: number, E: number, apoio: 'a' | 'b'): LarguraEfetiva {
  if (sApoio <= ZERO && sLivre <= ZERO) return inteiro(b, 'tracionado', sApoio, sLivre);
  let caso: string;
  let k: number;
  let s1: number;
  let psi: number;
  let bc: number | undefined;
  let semApoio: number; // comprimento que sai, contado a partir da borda livre
  if (sApoio >= sLivre) {
    s1 = sApoio;
    psi = sLivre / sApoio;
    if (psi >= 1 - 1e-9) {
      caso = 'Tabela 6, caso a';
      k = 0.43;
    } else if (psi >= 0) {
      caso = 'Tabela 6, caso b';
      k = 0.578 / (psi + 0.34);
    } else {
      caso = 'Tabela 6, caso c';
      k = 1.7 - 5 * psi + 17.1 * psi ** 2;
    }
  } else {
    s1 = sLivre;
    psi = sApoio / sLivre;
    caso = 'Tabela 6, caso d';
    k = 0.57 - 0.21 * psi + 0.07 * psi ** 2;
  }
  const lp = lambdaP(b, t, k, E, s1);
  const rho = fatorDeLargura(lp);
  let bef: number;
  if (psi >= 0) {
    bef = b * rho;
    semApoio = b - bef; // sai junto da borda livre
  } else if (caso.endsWith('c')) {
    // comprimido no apoio, tracionado na ponta: bef = ρ·bc a partir do apoio,
    // sai o resto da parte comprimida
    bc = b / (1 - psi);
    bef = bc * rho;
    semApoio = 0;
    const trechos: Trecho[] = bef >= bc - ZERO ? [[0, b]] : [[0, bef], [bc, b]];
    return { caso, k, psi, sigma: s1, lambdaP: lp, bef, bc, efetivos: apoio === 'a' ? trechos : trechos.map(([i, f]) => [b - f, b - i] as Trecho).reverse() };
  } else {
    bc = b / (1 - psi);
    bef = bc * rho;
    semApoio = bc - bef;
  }
  const fica = b - semApoio;
  const trechos: Trecho[] = semApoio <= ZERO ? [[0, b]] : [[0, fica]];
  return { caso, k, psi, sigma: s1, lambdaP: lp, bef, bc, efetivos: apoio === 'a' ? trechos : trechos.map(([i, f]) => [b - f, b - i] as Trecho) };
}

export interface EnrijecedorDeBorda {
  /** O que valeu em 9.2.3.1. */
  lambdaP0: number;
  Is: number;
  Ia: number;
  n: number;
  k: number;
  /** A mesa (elemento enrijecido). */
  mesa: LarguraEfetiva;
  /** bef,1 (junto ao enrijecedor) e bef,2 (junto à alma). */
  bef1: number;
  bef2: number;
  /** def do enrijecedor (9.2.2.1) e ds reduzido. */
  def: number;
  ds: number;
  /** Fora do campo de 9.2.3.1 (θ, D/b): a verificação vai para o MRD. */
  avisos: string[];
  foraDoCampo: string[];
}

/**
 * Mesa uniformemente comprimida com enrijecedor de borda simples (9.2.3.1).
 * b = largura plana da mesa; d = largura plana do enrijecedor; D = dimensão
 * nominal do enrijecedor; θ em graus; σ a tensão de 9.2.2.1; `defEnrijecedor`
 * a largura efetiva do enrijecedor já calculada como AL (9.2.2.1).
 */
export function mesaComEnrijecedor(
  b: number,
  d: number,
  D: number,
  t: number,
  thetaGraus: number,
  sigma: number,
  E: number,
  defEnrijecedor: number,
): EnrijecedorDeBorda {
  const avisos: string[] = [];
  // ⚠️ FORA DE 40° ≤ θ ≤ 140° OU COM D/b > 0,8 a expressão de 9.2.3.1 sai do
  // campo dela: com D/b acima de ~0,96 o k fica negativo, o λp vira NaN e a
  // mesa inteira sumia da seção efetiva, calada (achado B6 da revisão de
  // 01/11/2026). Agora vai para o MRD, como a mesa com tensão variando.
  const foraDoCampo: string[] = [];
  if (thetaGraus < 40 || thetaGraus > 140) foraDoCampo.push(`θ = ${thetaGraus}° fora de 40° a 140° (9.2.3.1)`);
  const lp0 = b / t / (0.623 * Math.sqrt(E / sigma));
  const th = (thetaGraus * Math.PI) / 180;
  const Is = (t * d ** 3 * Math.sin(th) ** 2) / 12;
  if (lp0 <= 0.673) {
    // Enrijecedor não é necessário: mesa inteira, enrijecedor com a sua def.
    const mesa: LarguraEfetiva = { caso: '9.2.3.1, λp0 ≤ 0,673', k: NaN, psi: 1, sigma, lambdaP: lp0, bef: b, efetivos: [[0, b]] };
    return { lambdaP0: lp0, Is, Ia: NaN, n: NaN, k: NaN, mesa, bef1: b / 2, bef2: b / 2, def: defEnrijecedor, ds: defEnrijecedor, avisos, foraDoCampo };
  }
  const Ia = Math.min(399 * t ** 4 * (0.487 * lp0 - 0.328) ** 3, t ** 4 * (56 * lp0 + 5));
  const n = Math.max(0.582 - 0.122 * lp0, 1 / 3);
  // Ia sai negativo para λp0 entre 0,673 e 0,67351 (o cubo de 0,487λp0 −
  // 0,328): aí o enrijecedor é folgado, Is/Ia = 1. Antes o k virava NaN e a
  // mesa sumia (achado A10).
  const razao = Ia > 0 ? Math.min(Is / Ia, 1) : 1;
  const Db = D / b;
  let k: number;
  if (Db <= 0.25) k = Math.min(3.57 * razao ** n + 0.43, 4);
  else {
    if (Db > 0.8) foraDoCampo.push(`D/b = ${Db.toFixed(2)} acima de 0,8 (9.2.3.1)`);
    // nunca abaixo do 0,43 de uma borda livre: guarda contra o k negativo
    k = Math.max(Math.min((4.82 - 5 * Db) * razao ** n + 0.43, 4), 0.43);
  }
  const lp = lambdaP(b, t, k, E, sigma);
  const bef = b * fatorDeLargura(lp);
  const bef1 = Math.min(razao * (bef / 2), bef / 2);
  const bef2 = bef - bef1;
  const ds = Math.min(razao * defEnrijecedor, defEnrijecedor);
  const mesa: LarguraEfetiva = { caso: '9.2.3.1', k, psi: 1, sigma, lambdaP: lp, bef, efetivos: [] };
  return { lambdaP0: lp0, Is, Ia, n, k, mesa, bef1, bef2, def: defEnrijecedor, ds, avisos, foraDoCampo };
}
