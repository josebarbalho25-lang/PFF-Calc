// ═══════════════════════════════════════════════════════════════════════════
//  motor/secao/tipos.ts — o perfil formado a frio como a conta o enxerga
// ---------------------------------------------------------------------------
//  A seção é a LINHA MÉDIA da chapa: trechos retos e arcos de canto, todos com
//  a mesma espessura t. É o esquema da NBR 6355 (linha média com o canto
//  arredondado) e é também o que o motor de faixas finitas discretiza — as
//  propriedades e os esforços críticos saem da mesma geometria, e por isso
//  não brigam entre si.
//
//  ⚠️ UNIDADES: o perfil digitado vem em MILÍMETRO (como a NBR 6355 e os
//  catálogos imprimem: "Ue 150 x 60 x 20 x 2,00"); a geometria daqui para
//  dentro é em CENTÍMETRO. A conversão acontece UMA vez, em `familias.ts`.
//
//  EIXOS: x horizontal, y vertical, no plano da seção. Nos perfis de alma
//  (U, Ue, Z, Ze) a alma é vertical, então x é o eixo perpendicular à alma —
//  o de maior inércia, como o X-X da calculadora 8800.
// ═══════════════════════════════════════════════════════════════════════════

/** Um ponto do plano da seção, cm. */
export interface Ponto {
  x: number;
  y: number;
}

/** Trecho reto da linha média. */
export interface TrechoReto {
  tipo: 'reta';
  a: Ponto;
  b: Ponto;
}

/**
 * Arco de canto da linha média: centro, raio médio (ri + t/2) e os ângulos
 * polares de início e fim, em radianos. O arco vai de `ang0` a `ang1` pelo
 * caminho curto — o sentido é o do sinal de (ang1 − ang0).
 */
export interface TrechoArco {
  tipo: 'arco';
  centro: Ponto;
  raio: number;
  ang0: number;
  ang1: number;
}

export type Trecho = TrechoReto | TrechoArco;

/** Como uma borda de elemento plano está presa. */
export type Borda = { tipo: 'livre' } | { tipo: 'elemento'; indice: number };

/** O papel do elemento plano na seção — decide o procedimento da largura efetiva. */
export type PapelDoElemento = 'alma' | 'mesa' | 'enrijecedor' | 'aba';

/**
 * Um elemento plano: a parte reta de chapa entre dobras (ou entre a dobra e a
 * borda livre). A largura efetiva da norma usa SEMPRE esta largura plana, sem
 * os cantos.
 */
export interface ElementoPlano {
  papel: PapelDoElemento;
  /** Índice do trecho reto correspondente em `SecaoGeometrica.trechos`. */
  trecho: number;
  /** Largura plana b, cm. */
  b: number;
  /** Bordas na ordem do trecho: [a, b]. AA = duas presas; AL = uma livre. */
  bordas: [Borda, Borda];
  /** Espessura do elemento, cm, quando difere da da seção (as abas soldadas do tubo: 2t). */
  t?: number;
}

/**
 * As famílias da primeira versão (ver ESTADO.md, pergunta 1), mais a seção
 * DESENHADA (nós e trechos de chapa, como o painel gráfico do DimPerfil) e os
 * DOIS Ue BOCA COM BOCA (pedidos dele de 01/11/2026).
 */
export type FamiliaDePerfil = 'U' | 'Ue' | 'Z' | 'Ze' | 'Cr' | 'L' | 'Le' | 'Desenho' | 'Ue2';

/** Um nó do desenho, mm. */
export interface NoDesenhado {
  x: number;
  y: number;
}

/** Um trecho de chapa entre dois nós do desenho; `t` em mm quando difere da seção. */
export interface TrechoDesenhado {
  i: number;
  j: number;
  t?: number;
}

/** A seção desenhada: nós e trechos, espessura e raio interno, mm. */
export interface SecaoDesenhada {
  nos: NoDesenhado[];
  trechos: TrechoDesenhado[];
}

/** Como os dois Ue boca com boca estão ligados. Espaçamento em cm. */
export type SoldaDaComposta = { tipo: 'continua' } | { tipo: 'intermitente'; s: number };

/**
 * O perfil como o projetista digita, em MILÍMETRO, nas dimensões EXTERNAS da
 * NBR 6355 (de face externa a face externa).
 */
export interface DimensoesDoPerfil {
  familia: FamiliaDePerfil;
  /** Alma (U, Ue, Z, Ze, Cr) ou primeira aba (L, Le), mm. */
  bw: number;
  /** Mesa (U, Ue, Z, Ze, Cr) ou segunda aba (L, Le), mm. */
  bf: number;
  /** Enrijecedor de borda, mm. Zero nas famílias sem enrijecedor. */
  D: number;
  /** Espessura de cálculo, mm. */
  t: number;
  /** Raio interno de dobramento, mm. */
  ri: number;
  /**
   * Ângulo do enrijecedor com a mesa, graus (90 = perpendicular). Só no Ze;
   * nas outras famílias o enrijecedor é sempre a 90°.
   */
  anguloEnrijecedor?: number;
  /** Só na família 'Desenho': os nós e trechos (o t e o ri são os de cima). */
  desenho?: SecaoDesenhada;
  /** Só na família 'Ue2': a solda entre os dois Ue (bw, bf, D, t, ri são de cada Ue). */
  solda?: SoldaDaComposta;
}

/**
 * A ligação dos trechos quando a seção não é uma cadeia (ramo em T, célula
 * fechada): cada trecho vai de um nó a outro; nós em cm. Sem isto, os trechos
 * estão na ordem da cadeia.
 */
export interface GrafoDaSecao {
  nos: Ponto[];
  /** Nó inicial e final de cada trecho, na ordem de `SecaoGeometrica.trechos`. */
  extremos: [number, number][];
  /** Espessura de cada trecho, cm. */
  espessuras: number[];
}

/** A geometria pronta para a conta: linha média em cm, elementos planos. */
export interface SecaoGeometrica {
  dimensoes: DimensoesDoPerfil;
  /** Espessura, cm. */
  t: number;
  /** Raio médio dos cantos (ri + t/2), cm. */
  rm: number;
  /** A linha média, na ordem da cadeia (uma ponta livre à outra) — ou na do grafo. */
  trechos: Trecho[];
  elementos: ElementoPlano[];
  /** Presente quando a seção tem ramo ou célula fechada. */
  grafo?: GrafoDaSecao;
}
