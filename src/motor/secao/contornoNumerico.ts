// ═══════════════════════════════════════════════════════════════════════════
//  motor/secao/contornoNumerico.ts — a segunda conta das propriedades (selo)
// ---------------------------------------------------------------------------
//  Só existe para conferir `propriedades.ts`. Escrita à parte, sem reaproveitar
//  nada de lá: o canto vira uma poligonal de muitas cordas, e tudo é feito com
//  as fórmulas fechadas de segmento reto (função linear ao longo dele), do
//  jeito do protótipo Python do José. Se as duas contas batem, nenhuma das
//  duas tem erro de fórmula — erro igual nas duas exigiria o mesmo engano em
//  caminhos diferentes.
//
//  O que sobra de diferença é a corda mais curta que o arco: com 400 cordas
//  por canto, fica na casa de 1e-7.
// ═══════════════════════════════════════════════════════════════════════════

import type { SecaoGeometrica } from './tipos';

const CORDAS_POR_ARCO = 400;

export interface PropriedadesConferidas {
  A: number;
  xG: number;
  yG: number;
  Ix: number;
  Iy: number;
  Ixy: number;
  x0: number;
  y0: number;
  J: number;
  Cw: number;
  x3: number;
  x2y: number;
  xy2: number;
  y3: number;
}

/** A linha média como lista de nós de uma cadeia aberta. */
function nosDaCadeia(sec: SecaoGeometrica, cordas: number): [number, number][] {
  const nos: [number, number][] = [];
  const empurra = (x: number, y: number) => {
    const ult = nos[nos.length - 1];
    if (!ult || Math.hypot(ult[0] - x, ult[1] - y) > 1e-12) nos.push([x, y]);
  };
  for (const tr of sec.trechos) {
    if (tr.tipo === 'reta') {
      empurra(tr.a.x, tr.a.y);
      empurra(tr.b.x, tr.b.y);
    } else {
      for (let k = 0; k <= cordas; k++) {
        const f = tr.ang0 + ((tr.ang1 - tr.ang0) * k) / cordas;
        empurra(tr.centro.x + tr.raio * Math.cos(f), tr.centro.y + tr.raio * Math.sin(f));
      }
    }
  }
  return nos;
}

/**
 * `cordas` por canto: 400 no selo; poucas imitam o programa que pica o canto
 * em poucas cordas (o DimPerfil usa 2 — CONFERENCIA.md §1).
 */
export function propriedadesPorPoligonal(sec: SecaoGeometrica, cordas = CORDAS_POR_ARCO): PropriedadesConferidas {
  const t = sec.t;
  const nos = nosDaCadeia(sec, cordas);
  const m = nos.length - 1; // segmentos

  // ∫ f·g ao longo de um segmento de comprimento b, f e g lineares.
  const fg = (b: number, fi: number, fj: number, gi: number, gj: number) => (b * (2 * fi * gi + fi * gj + fj * gi + 2 * fj * gj)) / 6;
  // ∫ f²·g, idem.
  const ffg = (b: number, fi: number, fj: number, gi: number, gj: number) =>
    (b * (3 * fi * fi * gi + fi * fi * gj + 2 * fi * fj * gi + 2 * fi * fj * gj + fj * fj * gi + 3 * fj * fj * gj)) / 12;

  const comp: number[] = [];
  let A = 0, Sx = 0, Sy = 0;
  for (let s = 0; s < m; s++) {
    const [xi, yi] = nos[s];
    const [xj, yj] = nos[s + 1];
    const b = Math.hypot(xj - xi, yj - yi);
    comp.push(b);
    A += b * t;
    Sx += (b * t * (xi + xj)) / 2;
    Sy += (b * t * (yi + yj)) / 2;
  }
  const xG = Sx / A;
  const yG = Sy / A;
  const X = nos.map(([x]) => x - xG);
  const Y = nos.map(([, y]) => y - yG);

  let Ix = 0, Iy = 0, Ixy = 0, x3 = 0, x2y = 0, xy2 = 0, y3 = 0;
  for (let s = 0; s < m; s++) {
    const b = comp[s] * t;
    const [xi, xj, yi, yj] = [X[s], X[s + 1], Y[s], Y[s + 1]];
    Ix += fg(b, yi, yj, yi, yj);
    Iy += fg(b, xi, xj, xi, xj);
    Ixy += fg(b, xi, xj, yi, yj);
    x3 += ffg(b, xi, xj, xi, xj);
    x2y += ffg(b, xi, xj, yi, yj);
    xy2 += ffg(b, yi, yj, xi, xj);
    y3 += ffg(b, yi, yj, yi, yj);
  }

  // Coordenada setorial com polo no centroide, nó a nó.
  const w = new Array<number>(nos.length).fill(0);
  for (let s = 0; s < m; s++) w[s + 1] = w[s] + (X[s] * Y[s + 1] - X[s + 1] * Y[s]);

  let Iwx = 0, Iwy = 0;
  for (let s = 0; s < m; s++) {
    Iwx += fg(comp[s] * t, w[s], w[s + 1], X[s], X[s + 1]);
    Iwy += fg(comp[s] * t, w[s], w[s + 1], Y[s], Y[s + 1]);
  }
  // [Ixy −Iy; Ix −Ixy]·[x0; y0] = [Iωx; Iωy], resolvido por Cramer.
  const det = -Ixy * Ixy + Iy * Ix;
  const x0 = (Iwx * -Ixy - -Iy * Iwy) / det;
  const y0 = (Ixy * Iwy - Ix * Iwx) / det;

  const wS = w.map((wi, k) => wi - x0 * Y[k] + y0 * X[k]);
  let mediaW = 0;
  for (let s = 0; s < m; s++) mediaW += (comp[s] * t * (wS[s] + wS[s + 1])) / 2;
  mediaW /= A;
  const wn = wS.map((wi) => wi - mediaW);
  let Cw = 0;
  for (let s = 0; s < m; s++) Cw += fg(comp[s] * t, wn[s], wn[s + 1], wn[s], wn[s + 1]);

  const J = comp.reduce((soma, b) => soma + (b * t ** 3) / 3, 0);
  return { A, xG, yG, Ix, Iy, Ixy, x0, y0, J, Cw, x3, x2y, xy2, y3 };
}
