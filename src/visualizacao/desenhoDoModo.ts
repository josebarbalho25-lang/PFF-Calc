// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/desenhoDoModo.ts — a seção deformada de um modo de flambagem
// ---------------------------------------------------------------------------
//  Conta pura. Dentro de cada faixa, o deslocamento no plano da seção sai das
//  MESMAS funções de forma do motor (F2): u linear entre as bordas e a flecha
//  w pela cúbica de Hermite com w e θ dos dois nós. Assim o desenho mostra a
//  chapa ondulando entre as dobras no modo local, e não uma poligonal reta
//  ligando os nós.
//
//  O deslocamento é o da seção a meio comprimento da meia-onda (sen = 1); a
//  animação multiplica por sen(ωt).
// ═══════════════════════════════════════════════════════════════════════════

import type { Malha } from '../motor/faixas/malha';
import type { Ponto } from '../motor/secao/tipos';

/** Pontos da linha média deformada, faixa a faixa (cada faixa é uma polilinha). */
export function linhaDeformada(m: Malha, deslocamentos: Float64Array, escala: number, passos = 8): Ponto[][] {
  const d = deslocamentos;
  return m.faixas.map(({ i, j }) => {
    const a = m.nos[i];
    const b = m.nos[j];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const c = (b.x - a.x) / L;
    const s = (b.y - a.y) / L;
    // Global [U, W, Θ] → local da faixa (F5): u = c·U + s·W, w = −s·U + c·W.
    const u1 = c * d[4 * i] + s * d[4 * i + 2];
    const w1 = -s * d[4 * i] + c * d[4 * i + 2];
    const u2 = c * d[4 * j] + s * d[4 * j + 2];
    const w2 = -s * d[4 * j] + c * d[4 * j + 2];
    const t1 = d[4 * i + 3];
    const t2 = d[4 * j + 3];
    const pts: Ponto[] = [];
    for (let k = 0; k <= passos; k++) {
      const xi = k / passos;
      const u = (1 - xi) * u1 + xi * u2;
      const w = (1 - 3 * xi ** 2 + 2 * xi ** 3) * w1 + L * (xi - 2 * xi ** 2 + xi ** 3) * t1 + (3 * xi ** 2 - 2 * xi ** 3) * w2 + L * (xi ** 3 - xi ** 2) * t2;
      const x0 = a.x + xi * (b.x - a.x);
      const y0 = a.y + xi * (b.y - a.y);
      pts.push({ x: x0 + escala * (c * u - s * w), y: y0 + escala * (s * u + c * w) });
    }
    return pts;
  });
}

/**
 * Escala que leva o maior deslocamento desenhado a `fracao` da maior
 * dimensão da seção. O modo vem normalizado pelo maior grau de liberdade,
 * que pode ser uma rotação: por isso a escala mede o deslocamento de fato.
 */
export function escalaDoModo(m: Malha, deslocamentos: Float64Array, fracao = 0.18): number {
  const xs = m.nos.map((p) => p.x);
  const ys = m.nos.map((p) => p.y);
  const tamanho = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  let desl = 0;
  const base = linhaDeformada(m, deslocamentos, 0);
  linhaDeformada(m, deslocamentos, 1).forEach((linha, f) =>
    linha.forEach((p, k) => {
      desl = Math.max(desl, Math.hypot(p.x - base[f][k].x, p.y - base[f][k].y));
    }),
  );
  return desl > 0 ? (fracao * tamanho) / desl : 0;
}
