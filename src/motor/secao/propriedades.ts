// ═══════════════════════════════════════════════════════════════════════════
//  motor/secao/propriedades.ts — as propriedades geométricas pela linha média
// ---------------------------------------------------------------------------
//  Integração exata ao longo da linha média, trecho a trecho: no reto, tudo é
//  polinômio de grau ≤ 3 na posição, e Gauss de 3 pontos é exato; no arco de
//  canto, a coordenada setorial tem forma fechada e as integrais saem por
//  Gauss de 12 pontos no ângulo (erro de arredondamento, não de modelo).
//
//  Modelo de parede fina: a chapa é a linha média vezes t. É o esquema da
//  NBR 6355 e o mesmo das faixas finitas. A única coisa que olha a chapa
//  grossa é a distância à fibra extrema, que vai à face externa (W).
//
//  ⚠️ O SELO DISTO é `contornoNumerico.ts`: outra conta, por poligonal picada
//  fina, escrita sem olhar esta. Mudou uma fórmula aqui, o selo tem de pegar.
// ═══════════════════════════════════════════════════════════════════════════

import { gauss } from '../quadratura';
import { propriedadesDaComposta } from './composta';
import { propriedadesDoGrafo } from './propriedadesGrafo';
import type { Ponto, SecaoGeometrica, Trecho } from './tipos';

/** As propriedades da seção bruta. Comprimentos em cm. */
export interface PropriedadesDaSecao {
  /** Área, cm². */
  A: number;
  /** Centroide, nas coordenadas do desenho (`familias.ts`). */
  G: Ponto;
  /** Inércias em torno dos eixos x e y que passam pelo centroide, cm⁴. Ixy = ∫xy dA. */
  Ix: number;
  Iy: number;
  Ixy: number;
  rx: number;
  ry: number;
  /** Inércias principais (I1 ≥ I2), cm⁴, e o ângulo do eixo 1 com x, rad. */
  I1: number;
  I2: number;
  alfa: number;
  /** Centro de torção em relação ao centroide, eixos x e y, cm (o x0, y0 da norma). */
  x0: number;
  y0: number;
  /** Centro de torção nas coordenadas do desenho. */
  S: Ponto;
  /** Constante de torção (It), cm⁴. */
  J: number;
  /** Constante de empenamento, cm⁶. */
  Cw: number;
  /** Raio de giração polar em relação ao centro de torção, cm. */
  r0: number;
  /** Módulos resistentes elásticos até a face externa, cm³. */
  Wx: { sup: number; inf: number };
  Wy: { esq: number; dir: number };
  /** Extremos da chapa (faces externas), coordenadas do desenho. */
  caixa: { xmin: number; xmax: number; ymin: number; ymax: number };
  /** ∫x³ dA, ∫x²y dA, ∫xy² dA, ∫y³ dA, eixos centroidais x e y, cm⁵ (para o j do Anexo E). */
  cubicas: { x3: number; x2y: number; xy2: number; y3: number };
  /** Comprimento total da linha média, cm. */
  comprimento: number;
}

const G3 = gauss(3);
const G12 = gauss(12);

/** Um ponto de integração: posição, peso (ds) e o ω com polo dado. */
interface PontoDeIntegracao {
  x: number;
  y: number;
  ds: number;
  omega: number;
}

/**
 * Pontos de integração ao longo da cadeia, com a coordenada setorial ω
 * acumulada desde a primeira ponta, polo em `polo`. Devolve também o ω no fim
 * de cada trecho, para emendar no próximo.
 */
function pontosDaCadeia(trechos: Trecho[], polo: Ponto): PontoDeIntegracao[] {
  const pts: PontoDeIntegracao[] = [];
  let w0 = 0;
  for (const tr of trechos) {
    if (tr.tipo === 'reta') {
      const ax = tr.a.x - polo.x;
      const ay = tr.a.y - polo.y;
      const bx = tr.b.x - polo.x;
      const by = tr.b.y - polo.y;
      const L = Math.hypot(bx - ax, by - ay);
      const dw = ax * by - ay * bx; // ω cresce linear no reto
      G3.xi.forEach((s, k) => {
        pts.push({ x: ax + s * (bx - ax), y: ay + s * (by - ay), ds: G3.w[k] * L, omega: w0 + s * dw });
      });
      w0 += dw;
    } else {
      const cx = tr.centro.x - polo.x;
      const cy = tr.centro.y - polo.y;
      const r = tr.raio;
      const f0 = tr.ang0;
      const df = tr.ang1 - tr.ang0;
      // dω = x dy − y dx = r (cx cos φ + cy sen φ + r) dφ, integrado a partir de φ0.
      const omega = (f: number) => w0 + r * (cx * (Math.sin(f) - Math.sin(f0)) - cy * (Math.cos(f) - Math.cos(f0)) + r * (f - f0));
      G12.xi.forEach((s, k) => {
        const f = f0 + s * df;
        pts.push({ x: cx + r * Math.cos(f), y: cy + r * Math.sin(f), ds: G12.w[k] * r * Math.abs(df), omega: omega(f) });
      });
      w0 = omega(tr.ang1);
    }
  }
  return pts;
}

/** Extremos da chapa grossa: cantos das faixas e, no arco, os pontos cardeais da face externa. */
function caixaDaChapa(trechos: Trecho[], t: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };
  for (const tr of trechos) {
    if (tr.tipo === 'reta') {
      const L = Math.hypot(tr.b.x - tr.a.x, tr.b.y - tr.a.y);
      const nx = (-(tr.b.y - tr.a.y) / L) * (t / 2);
      const ny = ((tr.b.x - tr.a.x) / L) * (t / 2);
      for (const p of [tr.a, tr.b]) {
        add(p.x + nx, p.y + ny);
        add(p.x - nx, p.y - ny);
      }
    } else {
      const lo = Math.min(tr.ang0, tr.ang1);
      const hi = Math.max(tr.ang0, tr.ang1);
      const angs = [tr.ang0, tr.ang1];
      for (let k = Math.ceil(lo / (Math.PI / 2)); k * (Math.PI / 2) <= hi; k++) angs.push(k * (Math.PI / 2));
      for (const f of angs) {
        for (const r of [tr.raio - t / 2, tr.raio + t / 2]) add(tr.centro.x + r * Math.cos(f), tr.centro.y + r * Math.sin(f));
      }
    }
  }
  return { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) };
}

export function propriedades(sec: SecaoGeometrica): PropriedadesDaSecao {
  // Dois Ue: área e inércias são as dos dois perfis reais. Com solda
  // intermitente, sem a célula fechada; com solda contínua, a torção (J, Cw)
  // é a do tubo — o modelo de linha média do tubo, de canto vivo no encontro,
  // põe ~1 % de aço a mais na área e ~2 % no Ix (comparação com o DimPerfil,
  // 01/11/2026), e esse aço não existe.
  if (sec.dimensoes.familia === 'Ue2') {
    const conjunto = propriedadesDaComposta(sec);
    if (sec.dimensoes.solda?.tipo === 'intermitente') return conjunto;
    const tubo = propriedadesDoGrafo(sec);
    return { ...conjunto, J: tubo.J, Cw: tubo.Cw };
  }
  // Ramo, célula fechada ou espessuras diferentes: o caminho do grafo.
  if (sec.grafo) return propriedadesDoGrafo(sec);
  const { t, trechos } = sec;

  // 1ª passada: comprimento e centroide (o polo não importa aqui).
  const p0 = pontosDaCadeia(trechos, { x: 0, y: 0 });
  let L = 0;
  let sx = 0;
  let sy = 0;
  for (const p of p0) {
    L += p.ds;
    sx += p.x * p.ds;
    sy += p.y * p.ds;
  }
  const G = { x: sx / L, y: sy / L };
  const A = L * t;

  // 2ª passada: tudo em relação ao centroide, ω com polo no centroide.
  let Ix = 0, Iy = 0, Ixy = 0, Sw = 0, Iwx = 0, Iwy = 0, Iww = 0;
  let x3 = 0, x2y = 0, xy2 = 0, y3 = 0;
  for (const { x, y, ds, omega } of pontosDaCadeia(trechos, G)) {
    const dA = ds * t;
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

  // Centro de torção: o polo S que zera ∫ωS·x dA e ∫ωS·y dA, com
  // ωS = ωG − x0·y + y0·x (mudança de polo, a menos de constante).
  const det = Ix * Iy - Ixy * Ixy;
  const x0 = (Iy * Iwy - Ixy * Iwx) / det;
  const y0 = (Ixy * Iwy - Ix * Iwx) / det;

  // Cw = ∫ωn² dA, ωn = ωS normalizado (média nula). Expandido para usar as
  // integrais já acumuladas — ∫x dA e ∫y dA são nulas no centroide.
  const Cw =
    Iww + x0 * x0 * Ix + y0 * y0 * Iy - 2 * x0 * Iwy + 2 * y0 * Iwx - 2 * x0 * y0 * Ixy - (Sw * Sw) / A;

  const meio = (Ix + Iy) / 2;
  const raio = Math.hypot((Ix - Iy) / 2, Ixy);
  const caixa = caixaDaChapa(trechos, t);

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
    J: (L * t ** 3) / 3,
    Cw: Math.max(Cw, 0),
    r0: Math.sqrt((Ix + Iy) / A + x0 * x0 + y0 * y0),
    Wx: { sup: Ix / (caixa.ymax - G.y), inf: Ix / (G.y - caixa.ymin) },
    Wy: { esq: Iy / (G.x - caixa.xmin), dir: Iy / (caixa.xmax - G.x) },
    caixa,
    cubicas: { x3, x2y, xy2, y3 },
    comprimento: L,
  };
}
