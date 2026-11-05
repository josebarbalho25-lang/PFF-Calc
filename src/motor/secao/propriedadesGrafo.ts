// ═══════════════════════════════════════════════════════════════════════════
//  motor/secao/propriedadesGrafo.ts — as propriedades da seção em GRAFO
//  (ramo em T, célula fechada, espessuras diferentes)
// ---------------------------------------------------------------------------
//  A mesma integração exata de `propriedades.ts`, trecho a trecho, mas a
//  coordenada setorial ω anda numa árvore geradora do grafo em vez de numa
//  cadeia. Cada trecho tem a sua espessura.
//
//  ⚠️ CÉLULA FECHADA: o ω de seção aberta não fecha a volta. Na torção de
//  Saint-Venant de parede fina, cada célula c tem um fluxo de cisalhamento q_c
//  que acerta a compatibilidade — Σ_d F_cd·q_d = 2·A_c, com F_cd = Σ (L/t) dos
//  trechos comuns às células c e d (com sinal) e A_c a área da célula.
//  Daí: J = Σ 2·A_c·q_c + Σ L·t³/3, e a coordenada setorial corrigida
//  dω = (r⊥ − q/t)·ds, que fecha a volta (Vlasov/Benscoter). Com ela, o
//  centro de torção e o Cw saem pelas MESMAS fórmulas da seção aberta.
//  Selo: o tubo retangular em fórmula fechada (`propriedadesGrafo.test.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import { gauss } from '../quadratura';
import type { PropriedadesDaSecao } from './propriedades';
import type { GrafoDaSecao, Ponto, SecaoGeometrica, Trecho } from './tipos';

const G3 = gauss(3);
const G12 = gauss(12);

interface PontoDeIntegracao {
  x: number;
  y: number;
  ds: number;
  omega: number;
}

/** Comprimento do trecho. */
function comprimento(tr: Trecho): number {
  return tr.tipo === 'reta' ? Math.hypot(tr.b.x - tr.a.x, tr.b.y - tr.a.y) : tr.raio * Math.abs(tr.ang1 - tr.ang0);
}

/** ∫(x dy − y dx) ao longo do trecho, polo dado (o dω geométrico). */
function dOmega(tr: Trecho, polo: Ponto): number {
  if (tr.tipo === 'reta') {
    const ax = tr.a.x - polo.x, ay = tr.a.y - polo.y, bx = tr.b.x - polo.x, by = tr.b.y - polo.y;
    return ax * by - ay * bx;
  }
  const cx = tr.centro.x - polo.x, cy = tr.centro.y - polo.y, r = tr.raio, f0 = tr.ang0, f1 = tr.ang1;
  return r * (cx * (Math.sin(f1) - Math.sin(f0)) - cy * (Math.cos(f1) - Math.cos(f0)) + r * (f1 - f0));
}

/**
 * Pontos de integração do trecho, com ω = w0 + ω_geom(s) − corr·s (s = o
 * comprimento andado desde o início do trecho; corr = q/t).
 */
function pontosDoTrecho(tr: Trecho, polo: Ponto, w0: number, corr: number): PontoDeIntegracao[] {
  const pts: PontoDeIntegracao[] = [];
  if (tr.tipo === 'reta') {
    const ax = tr.a.x - polo.x, ay = tr.a.y - polo.y, bx = tr.b.x - polo.x, by = tr.b.y - polo.y;
    const L = Math.hypot(bx - ax, by - ay);
    const dw = ax * by - ay * bx;
    G3.xi.forEach((s, k) => pts.push({ x: ax + s * (bx - ax), y: ay + s * (by - ay), ds: G3.w[k] * L, omega: w0 + s * dw - corr * s * L }));
  } else {
    const cx = tr.centro.x - polo.x, cy = tr.centro.y - polo.y, r = tr.raio, f0 = tr.ang0, df = tr.ang1 - tr.ang0;
    G12.xi.forEach((s, k) => {
      const f = f0 + s * df;
      const geo = r * (cx * (Math.sin(f) - Math.sin(f0)) - cy * (Math.cos(f) - Math.cos(f0)) + r * (f - f0));
      pts.push({ x: cx + r * Math.cos(f), y: cy + r * Math.sin(f), ds: G12.w[k] * r * Math.abs(df), omega: w0 + geo - corr * s * r * Math.abs(df) });
    });
  }
  return pts;
}

/** Resolve o sistema linear pequeno (eliminação de Gauss com pivô). */
function resolver(F: number[][], b: number[]): number[] {
  const n = b.length;
  const a = F.map((l, i) => [...l, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let l = c + 1; l < n; l++) if (Math.abs(a[l][c]) > Math.abs(a[p][c])) p = l;
    [a[c], a[p]] = [a[p], a[c]];
    for (let l = c + 1; l < n; l++) {
      const f = a[l][c] / a[c][c];
      for (let k = c; k <= n; k++) a[l][k] -= f * a[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let l = n - 1; l >= 0; l--) {
    let s = a[l][n];
    for (let k = l + 1; k < n; k++) s -= a[l][k] * x[k];
    x[l] = s / a[l][l];
  }
  return x;
}

/** Árvore geradora (a partir do nó 0) e as células: os ciclos fundamentais com sinal por trecho. */
function arvoreECelulas(g: GrafoDaSecao) {
  const n = g.nos.length;
  const m = g.extremos.length;
  const adj: { k: number; outro: number; sentido: 1 | -1 }[][] = Array.from({ length: n }, () => []);
  g.extremos.forEach(([a, b], k) => {
    adj[a].push({ k, outro: b, sentido: 1 });
    adj[b].push({ k, outro: a, sentido: -1 });
  });
  // caminho da raiz até cada nó: trecho → sinal (sentido em que é percorrido saindo da raiz)
  const caminho: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  const pai: { k: number; sentido: 1 | -1; de: number }[] = new Array(n);
  const ordem = [0];
  const visto = new Array<boolean>(n).fill(false);
  visto[0] = true;
  const naArvore = new Array<boolean>(m).fill(false);
  for (let q = 0; q < ordem.length; q++) {
    const v = ordem[q];
    for (const { k, outro, sentido } of adj[v]) {
      if (visto[outro]) continue;
      visto[outro] = true;
      naArvore[k] = true;
      pai[outro] = { k, sentido, de: v };
      caminho[outro] = new Map(caminho[v]);
      caminho[outro].set(k, sentido);
      ordem.push(outro);
    }
  }
  if (ordem.length !== n) throw new Error('seção desligada');
  const celulas: number[][] = [];
  g.extremos.forEach(([u, v], k) => {
    if (naArvore[k]) return;
    // u → v pelo trecho k, v → raiz (ao contrário do caminho de v), raiz → u
    const a = new Array<number>(m).fill(0);
    a[k] += 1;
    for (const [kk, s] of caminho[v]) a[kk] -= s;
    for (const [kk, s] of caminho[u]) a[kk] += s;
    celulas.push(a);
  });
  return { ordem, pai, celulas };
}

export function propriedadesDoGrafo(sec: SecaoGeometrica): PropriedadesDaSecao {
  const g = sec.grafo!;
  const { trechos } = sec;
  const t = g.espessuras;
  const L = trechos.map(comprimento);
  const { ordem, pai, celulas } = arvoreECelulas(g);

  // Torção de Saint-Venant: fluxos das células e o q de cada trecho.
  const nc = celulas.length;
  const origem = { x: 0, y: 0 };
  const dw0 = trechos.map((tr) => dOmega(tr, origem));
  const duasA = celulas.map((a) => a.reduce((s, c, k) => s + c * dw0[k], 0));
  const F = celulas.map((a) => celulas.map((b) => a.reduce((s, c, k) => s + c * b[k] * (L[k] / t[k]), 0)));
  const qc = nc ? resolver(F, duasA) : [];
  const q = trechos.map((_, k) => celulas.reduce((s, a, c) => s + a[k] * qc[c], 0));
  const J = qc.reduce((s, qq, c) => s + duasA[c] * qq, 0) + trechos.reduce((s, _, k) => s + (L[k] * t[k] ** 3) / 3, 0);

  /** ω nos nós (árvore), polo dado, com a correção do fluxo. */
  const omegaNosNos = (polo: Ponto) => {
    const delta = trechos.map((tr, k) => dOmega(tr, polo) - (q[k] / t[k]) * L[k]);
    const w = new Array<number>(g.nos.length).fill(0);
    for (const v of ordem.slice(1)) {
      const { k, sentido, de } = pai[v];
      w[v] = w[de] + sentido * delta[k];
    }
    return w;
  };
  const pontos = (polo: Ponto) => {
    const w = omegaNosNos(polo);
    return trechos.flatMap((tr, k) => pontosDoTrecho(tr, polo, w[g.extremos[k][0]], q[k] / t[k]).map((p) => ({ ...p, t: t[k] })));
  };

  // 1ª passada: área e centroide.
  let A = 0, sx = 0, sy = 0, comp = 0;
  for (const p of pontos(origem)) {
    const dA = p.ds * p.t;
    A += dA;
    sx += p.x * dA;
    sy += p.y * dA;
    comp += p.ds;
  }
  const G = { x: sx / A, y: sy / A };

  // 2ª passada: em relação ao centroide, ω com polo no centroide.
  let Ix = 0, Iy = 0, Ixy = 0, Sw = 0, Iwx = 0, Iwy = 0, Iww = 0, x3 = 0, x2y = 0, xy2 = 0, y3 = 0;
  for (const { x, y, ds, omega, t: tp } of pontos(G)) {
    const dA = ds * tp;
    Ix += y * y * dA;
    Iy += x * x * dA;
    Ixy += x * y * dA;
    Sw += omega * dA;
    Iwx += omega * x * dA;
    Iwy += omega * y * dA;
    Iww += omega * omega * dA;
    x3 += x * x * x * dA;
    x2y += x * x * y * dA;
    xy2 += x * y * y * dA;
    y3 += y * y * y * dA;
  }
  const det = Ix * Iy - Ixy * Ixy;
  const x0 = (Iy * Iwy - Ixy * Iwx) / det;
  const y0 = (Ixy * Iwy - Ix * Iwx) / det;
  const Cw = Iww + x0 * x0 * Ix + y0 * y0 * Iy - 2 * x0 * Iwy + 2 * y0 * Iwx - 2 * x0 * y0 * Ixy - (Sw * Sw) / A;

  // Caixa da chapa grossa, cada trecho com a sua espessura.
  const xs: number[] = [];
  const ys: number[] = [];
  trechos.forEach((tr, k) => {
    const h = t[k] / 2;
    if (tr.tipo === 'reta') {
      const l = L[k];
      const nx = (-(tr.b.y - tr.a.y) / l) * h, ny = ((tr.b.x - tr.a.x) / l) * h;
      for (const p of [tr.a, tr.b]) for (const s of [1, -1]) (xs.push(p.x + s * nx), ys.push(p.y + s * ny));
    } else {
      const lo = Math.min(tr.ang0, tr.ang1), hi = Math.max(tr.ang0, tr.ang1);
      const angs = [tr.ang0, tr.ang1];
      for (let j = Math.ceil(lo / (Math.PI / 2)); j * (Math.PI / 2) <= hi; j++) angs.push(j * (Math.PI / 2));
      for (const f of angs) for (const r of [tr.raio - h, tr.raio + h]) (xs.push(tr.centro.x + r * Math.cos(f)), ys.push(tr.centro.y + r * Math.sin(f)));
    }
  });
  const caixa = { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) };
  const meio = (Ix + Iy) / 2;
  const raio = Math.hypot((Ix - Iy) / 2, Ixy);
  return {
    A,
    G,
    Ix,
    Iy,
    Ixy,
    rx: Math.sqrt(Ix / A),
    ry: Math.sqrt(Iy / A),
    I1: meio + raio,
    I2: meio - raio,
    alfa: 0.5 * Math.atan2(-2 * Ixy, Ix - Iy),
    x0,
    y0,
    S: { x: G.x + x0, y: G.y + y0 },
    J,
    Cw: Math.max(Cw, 0),
    r0: Math.sqrt((Ix + Iy) / A + x0 * x0 + y0 * y0),
    Wx: { sup: Ix / (caixa.ymax - G.y), inf: Ix / (G.y - caixa.ymin) },
    Wy: { esq: Iy / (G.x - caixa.xmin), dir: Iy / (caixa.xmax - G.x) },
    caixa,
    cubicas: { x3, x2y, xy2, y3 },
    comprimento: comp,
  };
}

/** Quantas células fechadas a seção tem. */
export function celulasFechadas(sec: SecaoGeometrica): number {
  if (!sec.grafo) return 0;
  return sec.grafo.extremos.length - sec.grafo.nos.length + 1;
}
