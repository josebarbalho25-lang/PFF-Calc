// ═══════════════════════════════════════════════════════════════════════════
//  ui/desenho/encaixe.ts — onde o clique cai: no nó, na grade, no trecho
// ---------------------------------------------------------------------------
//  Conta pura em milímetro. O raio de captura chega já em mm: quem chama
//  converte os pixels da tela pela escala da vista — a captura tem de ter o
//  mesmo tamanho NA TELA em qualquer zoom, como no CAD.
//
//  ⚠️ O NÓ GANHA DA GRADE. Um nó fora da grade (ponta do enrijecedor a 45°,
//  nó digitado com 12,37) só se pega com o mouse porque o nó tem prioridade
//  dentro do raio; se fosse a grade primeiro, o clique cairia ao lado dele e
//  nasceria um nó solto colado ao outro.
//
//  ⚠️ ALINHAMENTO ANTES DA GRADE (o rastreamento do AutoCAD). Os nós do perfil
//  de catálogo caem fora da grade: a linha média do Ue 150 está em y = 74.
//  Saindo dali para desenhar uma aba, a grade puxava o clique para y = 75 e a
//  aba saía torta. Agora, perto do x ou do y de um nó (ou do primeiro ponto
//  ainda solto), a coordenada trava nele, e o quadro mostra a guia.
// ═══════════════════════════════════════════════════════════════════════════

import type { NoDesenhado, SecaoDesenhada } from '../../motor/secao/tipos';
import { limpar } from './comando';

export type Encaixe =
  | { tipo: 'no'; k: number; p: NoDesenhado }
  /** `guias`: os pontos de onde saiu o alinhamento (x, y ou os dois). */
  | { tipo: 'grade'; p: NoDesenhado; guias: NoDesenhado[] };

/** O que está sob o cursor, para apagar ou realçar. */
export type AlvoSobCursor = { tipo: 'no'; k: number } | { tipo: 'trecho'; k: number };

/** A coordenada na grade mais próxima; passo ≤ 0 desliga a grade. */
export function naGrade(v: number, passo: number): number {
  if (!(passo > 0)) return limpar(v);
  return limpar(Math.round(v / passo) * passo);
}

/** O nó mais próximo dentro do raio, ou −1. */
export function noProximo(nos: NoDesenhado[], p: NoDesenhado, raio: number): number {
  let melhor = -1;
  let dMelhor = raio;
  nos.forEach((n, k) => {
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    if (d <= dMelhor) {
      melhor = k;
      dMelhor = d;
    }
  });
  return melhor;
}

/** Distância do ponto ao segmento a–b e o parâmetro do pé (0 em a, 1 em b). */
export function distanciaAoSegmento(p: NoDesenhado, a: NoDesenhado, b: NoDesenhado): { d: number; s: number } {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const L2 = ux * ux + uy * uy;
  if (L2 === 0) return { d: Math.hypot(p.x - a.x, p.y - a.y), s: 0 };
  const s = Math.max(0, Math.min(1, ((p.x - a.x) * ux + (p.y - a.y) * uy) / L2));
  return { d: Math.hypot(p.x - (a.x + s * ux), p.y - (a.y + s * uy)), s };
}

/** O trecho mais próximo dentro do raio, ou −1. */
export function trechoProximo(d: SecaoDesenhada, p: NoDesenhado, raio: number): number {
  let melhor = -1;
  let dMelhor = raio;
  d.trechos.forEach((tr, k) => {
    const a = d.nos[tr.i];
    const b = d.nos[tr.j];
    if (!a || !b) return;
    const { d: dist } = distanciaAoSegmento(p, a, b);
    if (dist <= dMelhor) {
      melhor = k;
      dMelhor = dist;
    }
  });
  return melhor;
}

/** O ponto cuja coordenada (x ou y) está mais perto, dentro do raio. */
function alinhado(pontos: NoDesenhado[], v: number, eixo: 'x' | 'y', raio: number): NoDesenhado | null {
  let melhor: NoDesenhado | null = null;
  let dMelhor = raio;
  for (const q of pontos) {
    const d = Math.abs(q[eixo] - v);
    if (d <= dMelhor) {
      melhor = q;
      dMelhor = d;
    }
  }
  return melhor;
}

/**
 * Onde o clique cai no modo de desenhar: nó dentro do raio; senão, cada
 * coordenada alinhada a um nó (ou a um dos `extras`, o primeiro ponto ainda
 * sem nó) dentro do raio; senão, a grade.
 */
export function encaixar(p: NoDesenhado, nos: NoDesenhado[], passo: number, raio: number, extras: NoDesenhado[] = []): Encaixe {
  const k = noProximo(nos, p, raio);
  if (k >= 0) return { tipo: 'no', k, p: nos[k] };
  const pontos = [...extras, ...nos];
  const ax = alinhado(pontos, p.x, 'x', raio);
  const ay = alinhado(pontos, p.y, 'y', raio);
  const guias = [ax, ay].filter((g): g is NoDesenhado => g !== null);
  return { tipo: 'grade', p: { x: ax ? ax.x : naGrade(p.x, passo), y: ay ? ay.y : naGrade(p.y, passo) }, guias };
}

/** O que está sob o cursor no modo de apagar: o nó primeiro, depois o trecho. */
export function alvoSobCursor(d: SecaoDesenhada, p: NoDesenhado, raio: number): AlvoSobCursor | null {
  const k = noProximo(d.nos, p, raio);
  if (k >= 0) return { tipo: 'no', k };
  const t = trechoProximo(d, p, raio);
  return t >= 0 ? { tipo: 'trecho', k: t } : null;
}
