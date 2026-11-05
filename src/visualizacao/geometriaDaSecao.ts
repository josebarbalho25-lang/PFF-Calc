// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/geometriaDaSecao.ts — o corte do perfil formado a frio, em
//  escala, com o centroide, o centro de torção e as cotas
// ---------------------------------------------------------------------------
//  Conta pura: devolve o contorno, as linhas e os textos já na coordenada da
//  caixa do SVG. A tela e a memória leem a MESMA geometria — o desenho da tela
//  e o do papel não podem discordar.
//
//  ⚠️ O CONTORNO SAI DA LINHA MÉDIA DO MOTOR, deslocada ±t/2. Não é um desenho
//  à parte: se a geometria da conta estiver errada, o desenho mostra o erro.
//
//  ⚠️ O CENTRO DE TORÇÃO É DESENHADO (pedido do prompt, 01/11/2026): no U, no
//  Ue e na cartola ele fica fora do centroide, e é dele que dependem a
//  flexo-torção e o sinal da FLT no eixo fraco.
//
//  ⚠️ ESCALA ÚNICA nos dois sentidos. O eixo y do SVG desce; o da seção sobe.
//
//  ⚠️ SEÇÃO EM GRAFO (desenhada, dois Ue boca com boca): a chapa não é uma
//  tira só. Sai em PEDAÇOS — um por caminho entre junções — que se encostam
//  nas junções. O SVG desenha o traço grosso e pinta o miolo por cima: o traço
//  das emendas fica escondido e só sobra a borda de fora.
// ═══════════════════════════════════════════════════════════════════════════

import type { PropriedadesDaSecao } from '../motor/secao/propriedades';
import type { Ponto, SecaoGeometrica, Trecho } from '../motor/secao/tipos';
import { numExato } from '../relatorio/formatos';

export interface Linha {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  classe: 'cota' | 'chamada' | 'eixo' | 'eixo-principal' | 'traco';
}

export interface Texto {
  x: number;
  y: number;
  texto: string;
  indice?: string;
  valor: string;
  ancora: 'start' | 'middle' | 'end';
  rot?: number;
  classe: 'cota' | 'eixo' | 'centro';
}

export interface Marca {
  x: number;
  y: number;
  tipo: 'centroide' | 'torcao';
}

export interface DesenhoDaSecao {
  largura: number;
  altura: number;
  contorno: string;
  /** Mais de um pedaço de chapa (seção em grafo): as emendas pedem o miolo pintado por cima. */
  emendas: boolean;
  linhas: Linha[];
  textos: Texto[];
  marcas: Marca[];
}

/** A linha média picada: ponto e normal unitária (esquerda do sentido da cadeia). */
function amostrar(trechos: readonly Trecho[]): { p: Ponto; n: Ponto }[] {
  const out: { p: Ponto; n: Ponto }[] = [];
  for (const tr of trechos) {
    if (tr.tipo === 'reta') {
      const L = Math.hypot(tr.b.x - tr.a.x, tr.b.y - tr.a.y);
      const n = { x: -(tr.b.y - tr.a.y) / L, y: (tr.b.x - tr.a.x) / L };
      out.push({ p: tr.a, n }, { p: tr.b, n });
    } else {
      const passos = 12;
      const sentido = Math.sign(tr.ang1 - tr.ang0);
      for (let k = 0; k <= passos; k++) {
        const f = tr.ang0 + ((tr.ang1 - tr.ang0) * k) / passos;
        const radial = { x: Math.cos(f), y: Math.sin(f) };
        // Andando no sentido anti-horário, a esquerda aponta para o centro.
        const n = { x: -radial.x * sentido, y: -radial.y * sentido };
        out.push({ p: { x: tr.centro.x + tr.raio * radial.x, y: tr.centro.y + tr.raio * radial.y }, n });
      }
    }
  }
  return out;
}

function faixaGrossa(trechos: readonly Trecho[], t: number): Ponto[] {
  const am = amostrar(trechos);
  const ida = am.map(({ p, n }) => ({ x: p.x + (n.x * t) / 2, y: p.y + (n.y * t) / 2 }));
  const volta = [...am].reverse().map(({ p, n }) => ({ x: p.x - (n.x * t) / 2, y: p.y - (n.y * t) / 2 }));
  return [...ida, ...volta];
}

/** O trecho andado ao contrário. */
const inverter = (tr: Trecho): Trecho => (tr.tipo === 'reta' ? { tipo: 'reta', a: tr.b, b: tr.a } : { ...tr, ang0: tr.ang1, ang1: tr.ang0 });

/** Direção em que o trecho sai do nó (pelo começo dele, ou pelo fim). */
function saida(tr: Trecho, peloComeco: boolean): Ponto {
  if (tr.tipo === 'reta') {
    const [a, b] = peloComeco ? [tr.a, tr.b] : [tr.b, tr.a];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
  }
  const ang = peloComeco ? tr.ang0 : tr.ang1;
  const sentido = Math.sign(tr.ang1 - tr.ang0) * (peloComeco ? 1 : -1);
  return { x: -Math.sin(ang) * sentido, y: Math.cos(ang) * sentido };
}

/** Polígono no sentido anti-horário: o preenchimento "nonzero" não fura onde dois pedaços se cobrem. */
function antiHorario(pts: Ponto[]): Ponto[] {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a < 0 ? [...pts].reverse() : pts;
}

/**
 * O contorno da chapa grossa, em cm, nas coordenadas da seção: um lado da
 * linha média na ida, o outro na volta. É o mesmo do desenho 2D e o que as
 * cenas 3D extrudam. Na seção em cadeia, um pedaço só.
 *
 * Na seção em grafo, um pedaço por caminho que atravessa as dobras (nó com
 * dois trechos de mesma espessura); o caminho para nas junções e nas pontas.
 * Onde a junção deixa um dente de fora (canto vivo, ou os trechos todos de um
 * lado só), uma fatia de raio t/2 tapa o dente.
 */
export function contornosDaChapa(sec: SecaoGeometrica): Ponto[][] {
  const g = sec.grafo;
  if (!g) return [antiHorario(faixaGrossa(sec.trechos, sec.t))];
  const incid: number[][] = g.nos.map(() => []);
  g.extremos.forEach(([i, j], k) => {
    incid[i].push(k);
    incid[j].push(k);
  });
  // Dobra de mesma espessura: o pedaço atravessa o nó inteiro.
  const passa = (v: number) => incid[v].length === 2 && Math.abs(g.espessuras[incid[v][0]] - g.espessuras[incid[v][1]]) < 1e-12;
  const outroEm = (v: number, k: number) => (incid[v][0] === k ? incid[v][1] : incid[v][0]);
  const usado = g.extremos.map(() => false);
  const pedacos: Ponto[][] = [];
  g.extremos.forEach((_, k0) => {
    if (usado[k0]) return;
    // Volta até o começo do caminho: uma junção, uma ponta — ou, num anel, o próprio k0.
    let k = k0;
    let v = g.extremos[k0][0];
    for (let guarda = 0; passa(v) && guarda < g.extremos.length; guarda++) {
      const outro = outroEm(v, k);
      if (outro === k0) break;
      k = outro;
      v = g.extremos[k][0] === v ? g.extremos[k][1] : g.extremos[k][0];
    }
    // Daí para a frente, com os trechos já no sentido do caminho.
    const caminho: Trecho[] = [];
    let atual = k;
    let de = v;
    let anel = false;
    for (;;) {
      usado[atual] = true;
      const [i, j] = g.extremos[atual];
      caminho.push(i === de ? sec.trechos[atual] : inverter(sec.trechos[atual]));
      const ate = i === de ? j : i;
      if (!passa(ate)) break;
      const prox = outroEm(ate, atual);
      if (usado[prox]) {
        anel = true;
        break;
      }
      atual = prox;
      de = ate;
    }
    // O contorno de um anel não é um polígono só: vai em duas metades.
    const t = g.espessuras[k];
    if (anel && caminho.length > 1) {
      const meio = Math.ceil(caminho.length / 2);
      pedacos.push(faixaGrossa(caminho.slice(0, meio), t), faixaGrossa(caminho.slice(meio), t));
    } else pedacos.push(faixaGrossa(caminho, t));
  });
  // Os dentes das junções: entre dois trechos vizinhos com mais de 180° livres.
  g.nos.forEach((no, v) => {
    if (incid[v].length < 2 || passa(v)) return;
    const saidas = incid[v]
      .map((k) => {
        const u = saida(sec.trechos[k], g.extremos[k][0] === v);
        return { ang: Math.atan2(u.y, u.x), t: g.espessuras[k] };
      })
      .sort((a, b) => a.ang - b.ang);
    saidas.forEach((s1, m) => {
      const s2 = saidas[(m + 1) % saidas.length];
      let folga = s2.ang - s1.ang;
      if (folga <= 0) folga += 2 * Math.PI;
      if (folga <= Math.PI + 1e-6) return;
      const r = Math.min(s1.t, s2.t) / 2;
      const a0 = s1.ang + Math.PI / 2;
      const a1 = s1.ang + folga - Math.PI / 2;
      const n = Math.max(2, Math.ceil(((a1 - a0) / Math.PI) * 12));
      const fatia = [no];
      for (let q = 0; q <= n; q++) {
        const a = a0 + ((a1 - a0) * q) / n;
        fatia.push({ x: no.x + r * Math.cos(a), y: no.y + r * Math.sin(a) });
      }
      pedacos.push(fatia);
    });
  });
  return pedacos.map(antiHorario);
}

const cm = (v: number) => numExato(v * 10, 2); // as cotas saem em mm, como se digita

export function desenhoDaSecao(sec: SecaoGeometrica, pr: PropriedadesDaSecao, largura = 400, altura = 320): DesenhoDaSecao {
  const d = sec.dimensoes;
  const t = sec.t;
  // A caixa que cabe no desenho inclui o centro de torção: na cantoneira e
  // na cartola ele fica fora da chapa, e as cotas passam por fora dele.
  const c = {
    xmin: Math.min(pr.caixa.xmin, pr.S.x),
    xmax: Math.max(pr.caixa.xmax, pr.S.x),
    ymin: Math.min(pr.caixa.ymin, pr.S.y),
    ymax: Math.max(pr.caixa.ymax, pr.S.y),
  };
  const folga = { esq: 84, dir: 84, cima: 56, baixo: 56 };
  const s = Math.min((largura - folga.esq - folga.dir) / (c.xmax - c.xmin), (altura - folga.cima - folga.baixo) / (c.ymax - c.ymin));
  const ox = folga.esq + (largura - folga.esq - folga.dir - s * (c.xmax - c.xmin)) / 2 - s * c.xmin;
  const oy = folga.cima + (altura - folga.cima - folga.baixo - s * (c.ymax - c.ymin)) / 2 + s * c.ymax;
  const X = (x: number) => ox + s * x;
  const Y = (y: number) => oy - s * y;

  const pedacos = contornosDaChapa(sec);
  const contorno = pedacos.map((pts) => `M ${pts.map((p) => `${X(p.x).toFixed(2)} ${Y(p.y).toFixed(2)}`).join(' L ')} Z`).join(' ');

  const linhas: Linha[] = [];
  const textos: Texto[] = [];
  const traco = (x: number, y: number) => linhas.push({ x1: x - 3, y1: y + 3, x2: x + 3, y2: y - 3, classe: 'traco' });

  /** Cota horizontal de x1 a x2 (seção), na altura yTela da tela. */
  const cotaH = (x1: number, x2: number, yPeca: number, yTela: number, simbolo: string, indice: string, valor: number) => {
    const sobe = yTela < Y(yPeca) ? -1 : 1;
    for (const xx of [x1, x2]) linhas.push({ x1: X(xx), y1: Y(yPeca) + 3 * sobe, x2: X(xx), y2: yTela + 4 * sobe, classe: 'chamada' });
    linhas.push({ x1: X(x1), y1: yTela, x2: X(x2), y2: yTela, classe: 'cota' });
    traco(X(x1), yTela);
    traco(X(x2), yTela);
    textos.push({ x: (X(x1) + X(x2)) / 2, y: yTela + (sobe < 0 ? -6 : 14), texto: simbolo, indice, valor: cm(valor), ancora: 'middle', classe: 'cota' });
  };
  /** Cota vertical de y1 a y2 (seção), na abscissa xTela da tela. */
  const cotaV = (y1: number, y2: number, xPeca: number, xTela: number, simbolo: string, indice: string, valor: number) => {
    const vai = xTela > X(xPeca) ? 1 : -1;
    for (const yy of [y1, y2]) linhas.push({ x1: X(xPeca) + 3 * vai, y1: Y(yy), x2: xTela + 4 * vai, y2: Y(yy), classe: 'chamada' });
    linhas.push({ x1: xTela, y1: Y(y1), x2: xTela, y2: Y(y2), classe: 'cota' });
    traco(xTela, Y(y1));
    traco(xTela, Y(y2));
    textos.push({ x: xTela + 12 * vai, y: (Y(y1) + Y(y2)) / 2, texto: simbolo, indice, valor: cm(valor), ancora: 'middle', rot: -90, classe: 'cota' });
  };

  /**
   * O D do enrijecedor inclinado, cotado ao longo dele: do prolongamento da
   * face externa da mesa até a ponta (9.2.3.1, Figura 2) — a mesma medida que
   * se digita. Cota alinhada, do lado de fora (longe do centroide).
   */
  const cotaDoEnrijecedorInclinado = (valor: number) => {
    const lab = [...sec.trechos].reverse().find((tr) => tr.tipo === 'reta');
    if (!lab || lab.tipo !== 'reta') return;
    const ponta = lab.b;
    const comp = Math.hypot(lab.a.x - ponta.x, lab.a.y - ponta.y);
    const u = { x: (lab.a.x - ponta.x) / comp, y: (lab.a.y - ponta.y) / comp };
    if (Math.abs(u.y) < 1e-9) return;
    const face = Math.sign(ponta.y) * (d.bw / 20);
    const k = (face - ponta.y) / u.y;
    const P1 = { x: X(ponta.x + k * u.x), y: Y(ponta.y + k * u.y) };
    const P2 = { x: X(ponta.x), y: Y(ponta.y) };
    const L = Math.hypot(P2.x - P1.x, P2.y - P1.y);
    let n = { x: -(P2.y - P1.y) / L, y: (P2.x - P1.x) / L };
    const meio = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 };
    if (n.x * (meio.x - X(pr.G.x)) + n.y * (meio.y - Y(pr.G.y)) < 0) n = { x: -n.x, y: -n.y };
    const af = 22;
    for (const P of [P1, P2]) linhas.push({ x1: P.x + 3 * n.x, y1: P.y + 3 * n.y, x2: P.x + (af + 4) * n.x, y2: P.y + (af + 4) * n.y, classe: 'chamada' });
    const Q1 = { x: P1.x + af * n.x, y: P1.y + af * n.y };
    const Q2 = { x: P2.x + af * n.x, y: P2.y + af * n.y };
    linhas.push({ x1: Q1.x, y1: Q1.y, x2: Q2.x, y2: Q2.y, classe: 'cota' });
    traco(Q1.x, Q1.y);
    traco(Q2.x, Q2.y);
    // Texto ao longo da cota, sempre de pé para quem lê (entre −90° e 90°).
    let rot = (Math.atan2(P2.y - P1.y, P2.x - P1.x) * 180) / Math.PI;
    if (rot > 90) rot -= 180;
    if (rot <= -90) rot += 180;
    textos.push({ x: meio.x + (af + 14) * n.x, y: meio.y + (af + 14) * n.y + 4, texto: 'D', valor: cm(valor), ancora: 'middle', rot, classe: 'cota' });
  };

  const bw = d.bw / 10;
  const bf = d.bf / 10;
  const D = d.D / 10;
  // As cotas passam por fora de tudo, inclusive do centro de torção, que no
  // U e no Ue fica atrás da alma, fora da chapa.
  const acima = Math.min(Y(c.ymax), Y(pr.S.y) - 14) - 20;
  const abaixo = Math.max(Y(c.ymin), Y(pr.S.y) + 14) + 20;
  // Dos lados, além do centro de torção, a cota passa por fora da letra do
  // eixo x (que vai 19 px além da chapa).
  const esquerda = Math.min(X(c.xmin), X(pr.S.x) - 26) - 36;
  const direita = Math.max(X(c.xmax), X(pr.S.x) + 14) + 36;
  switch (d.familia) {
    case 'U':
    case 'Ue':
    case 'Z':
    case 'Ze':
      cotaV(-bw / 2, bw / 2, -t / 2, esquerda, 'b', 'w', bw);
      cotaH(-t / 2, -t / 2 + bf, bw / 2, acima, 'b', 'f', bf);
      if ((d.familia === 'Ue' || d.familia === 'Ze') && (d.anguloEnrijecedor ?? 90) === 90) {
        cotaV(bw / 2 - D, bw / 2, bf - t / 2, direita, 'D', '', D);
      } else if (d.familia === 'Ue' || d.familia === 'Ze') {
        cotaDoEnrijecedorInclinado(D);
      }
      break;
    // Dois Ue boca com boca: bf de um Ue, da face da alma ao plano do
    // encontro; D por dentro da célula, no enrijecedor de cima, com o texto
    // deitado — em pé, era mais comprido que a cota e saía por cima da mesa.
    case 'Ue2': {
      cotaV(-bw / 2, bw / 2, -bf, esquerda, 'b', 'w', bw);
      cotaH(-bf, 0, bw / 2, acima, 'b', 'f', bf);
      const xc = X(0) + 14;
      linhas.push({ x1: X(t) + 2, y1: Y(bw / 2 - D), x2: xc + 4, y2: Y(bw / 2 - D), classe: 'chamada' });
      linhas.push({ x1: xc, y1: Y(bw / 2), x2: xc, y2: Y(bw / 2 - D), classe: 'cota' });
      traco(xc, Y(bw / 2));
      traco(xc, Y(bw / 2 - D));
      textos.push({ x: xc + 8, y: (Y(bw / 2) + Y(bw / 2 - D)) / 2 + 4, texto: 'D', indice: '', valor: cm(D), ancora: 'start', classe: 'cota' });
      break;
    }
    // Cartola (Tabela 9): bf a mesa de cima, bw a altura das almas, D da face
    // externa da alma até a ponta do enrijecedor.
    case 'Cr':
      cotaH(-bf / 2, bf / 2, bw / 2, acima, 'b', 'f', bf);
      cotaV(-bw / 2, bw / 2, c.xmax, direita, 'b', 'w', bw);
      cotaH(bf / 2, bf / 2 + D, -bw / 2, abaixo, 'D', '', D);
      break;
    case 'L':
    case 'Le':
      cotaV(-t / 2, bw - t / 2, -t / 2, esquerda, 'b', 'w', bw);
      cotaH(-t / 2, bf - t / 2, -t / 2, abaixo, 'b', 'f', bf);
      if (d.familia === 'Le') cotaV(-t / 2, D - t / 2, bf - t / 2, direita, 'D', '', D);
      break;
  }

  // Eixos centroidais x e y; nos perfis de eixos principais girados (Z, Ze,
  // cantoneira), também os principais 1 e 2.
  const G = pr.G;
  const raio = 0.5 * Math.hypot(c.xmax - c.xmin, c.ymax - c.ymin) + 10 / s;
  // `ponta` diz de que lado vai a letra: o y embaixo, para não brigar com a
  // cota de cima.
  const eixo = (ang: number, classe: Linha['classe'], nome: string, alcance: number, ponta = 1) => {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    linhas.push({ x1: X(G.x - alcance * ux), y1: Y(G.y - alcance * uy), x2: X(G.x + alcance * ux), y2: Y(G.y + alcance * uy), classe });
    const k = ponta * (alcance + 7 / s);
    textos.push({ x: X(G.x + k * ux), y: Y(G.y + k * uy) + 4, texto: nome, valor: '', ancora: 'middle', classe: 'eixo' });
  };
  const alcanceX = Math.max(G.x - c.xmin, c.xmax - G.x) + 12 / s;
  const alcanceY = Math.max(G.y - c.ymin, c.ymax - G.y) + 12 / s;
  eixo(0, 'eixo', 'x', alcanceX);
  eixo(Math.PI / 2, 'eixo', 'y', alcanceY, -1);
  if (Math.abs(Math.sin(2 * pr.alfa)) > 1e-6) {
    // Os principais param antes das linhas de cota: inclinados, iam atravessar
    // o texto da cota de cima (o "bf = 75" do Ze 45°). Do lado sem cota, vão
    // até onde ela estaria e um pouco além — a letra fica no vazio, não em
    // cima da chapa.
    const cotado = {
      esq: ['U', 'Ue', 'Ue2', 'Z', 'Ze', 'L', 'Le'].includes(d.familia),
      dir: d.familia === 'Cr' || d.familia === 'Le' || ((d.familia === 'Ue' || d.familia === 'Ze') && (d.anguloEnrijecedor ?? 90) === 90),
      topo: ['U', 'Ue', 'Ue2', 'Z', 'Ze', 'Cr'].includes(d.familia),
      base: ['Cr', 'L', 'Le'].includes(d.familia),
    };
    const caixa = {
      esq: cotado.esq ? esquerda + 14 : esquerda - 10,
      dir: cotado.dir ? direita - 14 : direita + 10,
      topo: cotado.topo ? acima + 14 : acima - 10,
      base: cotado.base ? abaixo - 14 : abaixo + 10,
    };
    const cabe = (ang: number) => {
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      const lim: number[] = [raio];
      for (const sx of [1, -1]) {
        const ex = sx * ux;
        if (ex > 1e-9) lim.push((caixa.dir - X(G.x)) / (s * ex));
        if (ex < -1e-9) lim.push((X(G.x) - caixa.esq) / (s * -ex));
        const ey = sx * uy;
        if (ey > 1e-9) lim.push((Y(G.y) - caixa.topo) / (s * ey));
        if (ey < -1e-9) lim.push((caixa.base - Y(G.y)) / (s * -ey));
      }
      return Math.max(Math.min(...lim) - 7 / s, 0);
    };
    eixo(pr.alfa, 'eixo-principal', '1', cabe(pr.alfa));
    eixo(pr.alfa + Math.PI / 2, 'eixo-principal', '2', cabe(pr.alfa + Math.PI / 2), -1);
  }

  const marcas: Marca[] = [{ x: X(G.x), y: Y(G.y), tipo: 'centroide' }];
  const distante = Math.hypot(pr.x0, pr.y0) * s > 3;
  if (distante) {
    marcas.push({ x: X(pr.S.x), y: Y(pr.S.y), tipo: 'torcao' });
    textos.push({ x: X(pr.S.x) - 8, y: Y(pr.S.y) - 8, texto: 'CT', valor: '', ancora: 'end', classe: 'centro' });
  }
  textos.push({ x: X(G.x) + 8, y: Y(G.y) - 8, texto: 'G', valor: '', ancora: 'start', classe: 'centro' });

  return { largura, altura, contorno, emendas: pedacos.length > 1, linhas, textos, marcas };
}
