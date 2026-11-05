// ═══════════════════════════════════════════════════════════════════════════
//  motor/catalogos/acos.ts — os aços da NBR 14762:2010
// ---------------------------------------------------------------------------
//  A Tabela 1 (4.1.2) inteira, com o valor de chapa a frio e a quente
//  separados onde a norma separa ("260/260" é a frio/a quente), mais o aço
//  sem qualificação estrutural (4.2). Aço fora da lista entra pelo campo
//  "outro" da tela (4.1.3 permite, atendido o 4.1.1).
//
//  Tensões em kN/cm² (a tabela da norma está em MPa: 1 kN/cm² = 10 MPa).
//  Proposta mandada a ele em 01/11/2026 (ESTADO.md, pergunta 3).
// ═══════════════════════════════════════════════════════════════════════════

/** Um aço da lista. */
export interface Aco {
  nome: string;
  /** Resistência ao escoamento, kN/cm². */
  fy: number;
  /** Resistência à ruptura, kN/cm². */
  fu: number;
  /** A norma de onde ele vem, como a Tabela 1 escreve. */
  norma: string;
}

/** 4.6 — propriedades mecânicas para todos os aços desta norma, kN/cm². */
export const E_ACO = 20000;
export const G_ACO = 7700;
export const NU_ACO = 0.3;

const NBR6649 = 'ABNT NBR 6649 / NBR 6650 — chapas finas de aço-carbono';
const NBR5004 = 'ABNT NBR 5004 — chapas finas de baixa liga e alta resistência mecânica';
const NBR5920 = 'ABNT NBR 5920 / NBR 5921 — resistentes à corrosão atmosférica';
const NBR7008 = 'ABNT NBR 7008 / NBR 7013 / NBR 14964 — com revestimento metálico';

/** Tabela 1 (4.1.2) e 4.2. A ordem é a da tabela. */
export const ACOS: readonly Aco[] = [
  { nome: 'CF-26 (a frio)', fy: 26, fu: 40, norma: NBR6649 },
  { nome: 'CF-26 (a quente)', fy: 26, fu: 41, norma: NBR6649 },
  { nome: 'CF-28', fy: 28, fu: 44, norma: NBR6649 },
  { nome: 'CF-30 (a quente)', fy: 30, fu: 49, norma: NBR6649 },
  { nome: 'F-32/Q-32', fy: 31, fu: 41, norma: NBR5004 },
  { nome: 'F-35/Q-35', fy: 34, fu: 45, norma: NBR5004 },
  { nome: 'Q-40', fy: 38, fu: 48, norma: NBR5004 },
  { nome: 'Q-42', fy: 41, fu: 52, norma: NBR5004 },
  { nome: 'Q-45', fy: 45, fu: 55, norma: NBR5004 },
  { nome: 'CFR 400 (a quente)', fy: 25, fu: 38, norma: NBR5920 },
  { nome: 'CFR 500 (a frio)', fy: 31, fu: 45, norma: NBR5920 },
  { nome: 'CFR 500 (a quente)', fy: 37, fu: 49, norma: NBR5920 },
  { nome: 'ZAR 250', fy: 25, fu: 36, norma: NBR7008 },
  { nome: 'ZAR 280', fy: 28, fu: 38, norma: NBR7008 },
  { nome: 'ZAR 320', fy: 32, fu: 39, norma: NBR7008 },
  { nome: 'ZAR 345', fy: 34.5, fu: 43, norma: NBR7008 },
  { nome: 'ZAR 400', fy: 40, fu: 45, norma: NBR7008 },
  // 4.2: o projeto não pode adotar mais que 180 e 300 MPa.
  { nome: 'Sem qualificação estrutural', fy: 18, fu: 30, norma: 'ABNT NBR 14762, 4.2' },
];

export function acoPeloNome(nome: string): Aco | undefined {
  return ACOS.find((a) => a.nome === nome);
}
