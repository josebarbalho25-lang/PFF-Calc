// ═══════════════════════════════════════════════════════════════════════════
//  ui/desenho/vista.ts — zoom, deslocamento e a grade do quadro
// ---------------------------------------------------------------------------
//  A vista é o centro (mm) e a escala (pixel por mm). O y do plano sobe e o
//  da tela desce: a troca de sinal mora aqui e em mais nenhum lugar.
//
//  ⚠️ O ZOOM É EM TORNO DO CURSOR, não do centro: o ponto debaixo do mouse
//  fica parado (o costume do AutoCAD e do Revit). Zoom pelo centro faz o
//  detalhe que se queria ver fugir da tela.
// ═══════════════════════════════════════════════════════════════════════════

import type { NoDesenhado } from '../../motor/secao/tipos';

export interface Vista {
  cx: number;
  cy: number;
  /** pixel por mm */
  esc: number;
}

export interface Tamanho {
  w: number;
  h: number;
}

export const ESC_MIN = 0.02;
export const ESC_MAX = 400;

export function paraTela(v: Vista, tam: Tamanho, p: NoDesenhado): { x: number; y: number } {
  return { x: tam.w / 2 + (p.x - v.cx) * v.esc, y: tam.h / 2 - (p.y - v.cy) * v.esc };
}

export function paraMundo(v: Vista, tam: Tamanho, s: { x: number; y: number }): NoDesenhado {
  return { x: v.cx + (s.x - tam.w / 2) / v.esc, y: v.cy - (s.y - tam.h / 2) / v.esc };
}

/** Zoom de `fator` com o ponto de tela `s` parado. */
export function zoomEm(v: Vista, tam: Tamanho, s: { x: number; y: number }, fator: number): Vista {
  const esc = Math.min(ESC_MAX, Math.max(ESC_MIN, v.esc * fator));
  const p = paraMundo(v, tam, s);
  return { cx: p.x - (s.x - tam.w / 2) / esc, cy: p.y + (s.y - tam.h / 2) / esc, esc };
}

/** Desloca a vista pelo arrasto de (dx, dy) pixels. */
export function deslocar(v: Vista, dx: number, dy: number): Vista {
  return { ...v, cx: v.cx - dx / v.esc, cy: v.cy + dy / v.esc };
}

/**
 * Ajustar à seção: a caixa dos nós com `margem` pixels de folga. Sem nó,
 * a origem com 250 mm na menor dimensão da tela (um perfil de catálogo cabe).
 */
export function ajustar(nos: NoDesenhado[], tam: Tamanho, margem = 48): Vista {
  if (!nos.length) return { cx: 0, cy: 0, esc: Math.max(ESC_MIN, Math.min(tam.w, tam.h) / 250) };
  const xs = nos.map((n) => n.x);
  const ys = nos.map((n) => n.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // caixa de pelo menos 10 mm: um nó só (ou dois alinhados) não vira zoom de 400 px/mm
  const larg = Math.max(x1 - x0, 10);
  const alt = Math.max(y1 - y0, 10);
  const esc = Math.min((tam.w - 2 * margem) / larg, (tam.h - 2 * margem) / alt);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, esc: Math.min(ESC_MAX, Math.max(ESC_MIN, esc)) };
}

export interface LinhaDaGrade {
  /** posição na tela, px */
  s: number;
  principal: boolean;
}

/** Menor distância entre linhas da grade na tela; abaixo disto a grade engrossa. */
const PX_MINIMO = 7;
const MULTIPLOS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

/**
 * As linhas da grade visíveis. O passo desenhado é o passo de encaixe ou um
 * múltiplo dele (×2, ×5, ×10…) quando o zoom afasta — a grade nunca vira um
 * borrão. Linha principal a cada 5 passos desenhados.
 */
export function linhasDaGrade(v: Vista, tam: Tamanho, passo: number): { passo: number; xs: LinhaDaGrade[]; ys: LinhaDaGrade[] } {
  if (!(passo > 0)) return { passo: 0, xs: [], ys: [] };
  const m = MULTIPLOS.find((k) => passo * k * v.esc >= PX_MINIMO) ?? MULTIPLOS[MULTIPLOS.length - 1];
  const p = passo * m;
  const canto0 = paraMundo(v, tam, { x: 0, y: tam.h });
  const canto1 = paraMundo(v, tam, { x: tam.w, y: 0 });
  const linhas = (de: number, ate: number, tela: (c: number) => number) => {
    const out: LinhaDaGrade[] = [];
    for (let q = Math.ceil(de / p); q * p <= ate && out.length < 2000; q++) out.push({ s: tela(q * p), principal: q % 5 === 0 });
    return out;
  };
  return {
    passo: p,
    xs: linhas(canto0.x, canto1.x, (x) => paraTela(v, tam, { x, y: 0 }).x),
    ys: linhas(canto0.y, canto1.y, (y) => paraTela(v, tam, { x: 0, y }).y),
  };
}
