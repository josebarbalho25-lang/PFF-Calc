// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/desenhoDaCurva.ts — a curva de assinatura em escala, com os
//  mínimos marcados
// ---------------------------------------------------------------------------
//  Conta pura: devolve os caminhos e os rótulos já na coordenada da caixa do
//  SVG. Eixo x em escala logarítmica (comprimento de meia-onda, cm), eixo y
//  linear (esforço crítico). O teto do y fica a 2,2 vezes o maior mínimo:
//  a curva sobe ao infinito nas meias-ondas curtas, e sem teto os vales — que
//  são o que importa — virariam uma linha reta no pé do desenho.
// ═══════════════════════════════════════════════════════════════════════════

import { num } from '../relatorio/formatos';

export type ModoDoMinimo = 'local' | 'distorcional' | 'global';

export interface MinimoDesenhado {
  L: number;
  lam: number;
  modo: ModoDoMinimo;
  /** Ponto do ombro (sem vale distorcional), não mínimo. */
  ombro?: boolean;
}

export interface DesenhoDaCurva {
  largura: number;
  altura: number;
  caminho: string;
  caminhoInverso?: string;
  eixoX: { x: number; rotulo: string }[];
  eixoY: { y: number; rotulo: string }[];
  minimos: (MinimoDesenhado & { x: number; y: number })[];
  /** Cada ponto da curva na tela, na ordem dos L (o clique acha o mais perto). */
  pontos: { x: number; y: number }[];
  area: { x0: number; y0: number; x1: number; y1: number };
}

/** Passo "redondo" (1, 2 ou 5 × 10ⁿ) para umas 4 a 6 divisões. */
function passoRedondo(max: number): number {
  const bruto = max / 5;
  const p = 10 ** Math.floor(Math.log10(bruto));
  return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= bruto) ?? 10 * p;
}

export function desenhoDaCurva(
  L: number[],
  lam: number[],
  minimos: MinimoDesenhado[],
  op: { lamInverso?: number[]; largura?: number; altura?: number } = {},
): DesenhoDaCurva {
  const largura = op.largura ?? 520;
  const altura = op.altura ?? 260;
  const area = { x0: 64, y0: 14, x1: largura - 16, y1: altura - 34 };
  const lx0 = Math.log10(L[0]);
  const lx1 = Math.log10(L[L.length - 1]);
  const referencia = minimos.length ? Math.max(...minimos.map((m) => m.lam)) : Math.min(...lam.filter(Number.isFinite));
  const passo = passoRedondo(2.2 * referencia);
  const ymax = passo * Math.ceil((2.2 * referencia) / passo);
  const X = (l: number) => area.x0 + ((Math.log10(l) - lx0) / (lx1 - lx0)) * (area.x1 - area.x0);
  const Y = (v: number) => area.y1 - (Math.min(v, ymax) / ymax) * (area.y1 - area.y0);

  const caminhoDe = (vals: number[]) =>
    vals
      .map((v, k) => (Number.isFinite(v) ? `${X(L[k]).toFixed(1)} ${Y(v).toFixed(1)}` : null))
      .filter((p): p is string => p !== null)
      .map((p, k) => `${k ? 'L' : 'M'} ${p}`)
      .join(' ');

  const eixoX: DesenhoDaCurva['eixoX'] = [];
  // Abaixo de 1 cm a marca leva as casas da década (0,1; 0,01) — com zero
  // casas saía "0" (achado B9).
  for (let e = Math.ceil(lx0); e <= Math.floor(lx1); e++) eixoX.push({ x: X(10 ** e), rotulo: num(10 ** e, Math.max(0, -e)) });
  const eixoY: DesenhoDaCurva['eixoY'] = [];
  for (let v = 0; v <= ymax + 1e-9; v += passo) eixoY.push({ y: Y(v), rotulo: num(v, 0) });

  return {
    largura,
    altura,
    caminho: caminhoDe(lam),
    caminhoInverso: op.lamInverso ? caminhoDe(op.lamInverso) : undefined,
    eixoX,
    eixoY,
    minimos: minimos.map((m) => ({ ...m, x: X(m.L), y: Y(m.lam) })),
    pontos: L.map((l, k) => ({ x: X(l), y: Number.isFinite(lam[k]) ? Y(lam[k]) : NaN })),
    area,
  };
}
