// ═══════════════════════════════════════════════════════════════════════════
//  motor/secao/composta.ts — dois Ue boca com boca (pedido dele, 01/11/2026)
// ---------------------------------------------------------------------------
//  Os dois Ue de frente um para o outro, as pontas dos enrijecedores se
//  tocando. Com SOLDA CONTÍNUA ao longo do encontro, os dois enrijecedores
//  viram uma chapa só, de espessura 2t, e a seção é um TUBO: uma célula
//  fechada (as duas almas e as quatro meias-mesas) com duas nervuras internas
//  (os enrijecedores soldados), em cima e embaixo, no plano do encontro. É o
//  que as Tabelas 9 e 10 (caso d) e 12 e 13 (caso c) da norma chamam de
//  "seção tubular retangular formada por dois perfis U enrijecido".
//
//  Com SOLDA INTERMITENTE a seção é a mesma no desenho e na flexão, mas a
//  torção não fecha a célula: quem trata é a norma (`norma/composta.ts`).
//
//  ⚠️ O MODELO DA JUNÇÃO: as mesas de cada Ue vão até o plano do encontro
//  (x = 0) e lá se encontram com a nervura — canto vivo (nó de grau 3). Os
//  cantos alma-mesa ficam arredondados como no Ue. Esse modelo põe aço que
//  não existe (as mesas ganham t/2 até o plano, os cantos mesa-enrijecedor
//  viram vivos): no Ue 300x100x25x2,65, +1,1 % na área e +1,9 % no Ix. Por
//  isso ele serve só à torção (J, Cw da célula) e às faixas finitas (a tensão
//  crítica); a área e as inércias são as dos dois Ue reais
//  (`propriedadesDaComposta`), e as faixas devolvem a força crítica na seção
//  real (`criticos.ts`).
//
//  O DimPerfil (relatório "UE caixa", 01/11/2026) deixa uma folga de t entre
//  os enrijecedores (face da alma a bf + t/2 do plano): Iy 3 % maior que o
//  daqui. Aqui os enrijecedores se encostam, que é a peça soldada.
// ═══════════════════════════════════════════════════════════════════════════

import { GeometriaInvalida, montarSecao } from './familias';
import { montarDoDesenho } from './grafo';
import { propriedades, type PropriedadesDaSecao } from './propriedades';
import type { DimensoesDoPerfil, SecaoDesenhada, SecaoGeometrica } from './tipos';

/** Os nós e trechos dos dois Ue (mm), na linha média: o que o motor monta e o que o editor recebe. */
export function desenhoDoUe2(d: DimensoesDoPerfil): SecaoDesenhada {
  const { bw, bf, D, t } = d;
  const h = bw - t; // de linha média a linha média das mesas
  const c = D - t / 2; // o enrijecedor, da linha média da mesa à ponta
  const xa = bf - t / 2; // da linha média da alma ao plano do encontro
  if (!(c > 0 && c < h / 2)) throw new GeometriaInvalida(`D = ${D} mm: os enrijecedores de cima e de baixo se cruzam ou somem`);
  // nós (mm): 0..3 cantos alma-mesa; 4, 5 encontros em cima e embaixo; 6, 7 pontas das nervuras
  const nos = [
    { x: -xa, y: h / 2 },
    { x: -xa, y: -h / 2 },
    { x: xa, y: h / 2 },
    { x: xa, y: -h / 2 },
    { x: 0, y: h / 2 },
    { x: 0, y: -h / 2 },
    { x: 0, y: h / 2 - c },
    { x: 0, y: -h / 2 + c },
  ];
  const trechos = [
    { i: 0, j: 1 }, // alma esquerda
    { i: 0, j: 4 }, // meia-mesa de cima, esquerda
    { i: 4, j: 2 }, // meia-mesa de cima, direita
    { i: 2, j: 3 }, // alma direita
    { i: 3, j: 5 }, // meia-mesa de baixo, direita
    { i: 5, j: 1 }, // meia-mesa de baixo, esquerda
    { i: 4, j: 6, t: 2 * t }, // nervura de cima (dois enrijecedores soldados)
    { i: 5, j: 7, t: 2 * t }, // nervura de baixo
  ];
  return { nos, trechos };
}

export function montarUe2(d: DimensoesDoPerfil): SecaoGeometrica {
  const sec = montarDoDesenho({ ...d, desenho: desenhoDoUe2(d) });
  // ⚠️ A LARGURA PLANA É A DA PEÇA REAL (9.2.1), não a do modelo da junção.
  // No modelo, a mesa vai até o plano do encontro sem a dobra mesa-enrijecedor
  // e a nervura mede da linha média da mesa: b sairia bf − ri − t e D − t/2
  // (ele pegou no Ue 125x…x3,25: mesa 11,688 no lugar de 10,875). Cada Ue
  // tem as duas dobras da mesa e a dobra do enrijecedor.
  const t = d.t / 10;
  const ri = d.ri / 10;
  const mesa = d.bf / 10 - 2 * (ri + t);
  const nervura = d.D / 10 - (ri + t);
  const plana = [null, mesa, mesa, null, mesa, mesa, nervura, nervura];
  const elementos = sec.elementos.map((e, k) => (plana[k] === null ? e : { ...e, b: plana[k]! }));
  return { ...sec, elementos, dimensoes: d };
}

/**
 * As propriedades dos dois Ue com SOLDA INTERMITENTE, para a flambagem global
 * e a flexão do conjunto: área e inércias somadas em torno do centroide do
 * conjunto (o plano do encontro).
 *
 * TORÇÃO: a solda em trechos não leva o fluxo de cisalhamento contínuo, então
 * a célula NÃO fecha: J = 2·J(Ue). Mas o conjunto gira em torno do centro
 * dele (o plano do encontro), e as soldas obrigam isso: o centro de torção de
 * cada Ue, a uma distância e do centro do conjunto, anda e·θ na vertical — cada
 * Ue flete em torno do próprio x. Daí o empenamento do conjunto aberto:
 * Cw = 2·[Cw(Ue) + Ix(Ue)·e²]. (Com cada Ue empenando sozinho, Cw = 2·Cw(Ue),
 * a torção governava com a metade da resistência do tubo — não é o que as
 * soldas deixam acontecer.) As soldas têm de levar esse cisalhamento entre os
 * perfis: é a ligação (seção 10), fora desta versão.
 */
export function propriedadesDaComposta(sec: SecaoGeometrica): PropriedadesDaSecao {
  const d = sec.dimensoes;
  const um = propriedades(montarSecao({ ...d, familia: 'Ue', solda: undefined }));
  const t = d.t / 10;
  const dist = d.bf / 10 - t / 2 - um.G.x; // do plano do encontro ao centroide de cada Ue
  const eCT = d.bf / 10 - t / 2 - um.S.x; // do plano do encontro ao centro de torção de cada Ue
  const A = 2 * um.A;
  const Ix = 2 * um.Ix;
  const Iy = 2 * (um.Iy + um.A * dist * dist);
  const meio = (Ix + Iy) / 2;
  const raio = Math.abs(Ix - Iy) / 2;
  const caixa = { xmin: -d.bf / 10, xmax: d.bf / 10, ymin: -d.bw / 20, ymax: d.bw / 20 };
  return {
    A,
    G: { x: 0, y: 0 },
    Ix,
    Iy,
    Ixy: 0,
    rx: Math.sqrt(Ix / A),
    ry: Math.sqrt(Iy / A),
    I1: meio + raio,
    I2: meio - raio,
    alfa: 0.5 * Math.atan2(0, Ix - Iy),
    x0: 0,
    y0: 0,
    S: { x: 0, y: 0 },
    J: 2 * um.J,
    Cw: 2 * (um.Cw + um.Ix * eCT * eCT),
    r0: Math.sqrt((Ix + Iy) / A),
    Wx: { sup: Ix / caixa.ymax, inf: Ix / caixa.ymax },
    Wy: { esq: Iy / caixa.xmax, dir: Iy / caixa.xmax },
    caixa,
    cubicas: { x3: 0, x2y: 0, xy2: 0, y3: 0 },
    comprimento: 2 * um.comprimento,
  };
}
