// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/deformadaDoEsforco.ts — como a barra se mexe em cada esforço
// ---------------------------------------------------------------------------
//  Conta pura, para a cena dos esforços: uma barra em balanço, engastada em
//  z = 0, com o corte (a face onde o esforço age) em z = L. Na seção, x é o X
//  (as mesas) e y é o Y (a alma), como no desenho 2D.
//
//   · N      — encurta (compressão) ou alonga (tração);
//   · Mx, Vy — flete no plano da ALMA (o plano YZ): a ponta desce (−y);
//   · My, Vx — flete no plano das MESAS (o plano XZ): a ponta vai para +x.
//
//  O sentido casa com o das setas da cena: a cortante empurra a ponta para
//  onde ela vai, e a seta curva gira junto com a face.
//
//  O momento curva a barra por igual (curvatura constante); a cortante é a
//  força na ponta (a linha elástica do balanço com carga na ponta). A seção
//  continua plana e acompanha a inclinação da barra — é isso que deixa a face
//  do corte girar junto com a seta do momento.
//
//  ⚠️ A PONTA E OS VÉRTICES SAEM DA MESMA CONTA. A seta do esforço e os eixos
//  do corte andam com a `ponta`; a barra, com `ponto`. Se as duas contas se
//  separassem, a seta descolaria da face (selo: `deformadaDoEsforco.test.ts`).
//
//  ⚠️ ESCALA DIDÁTICA: amplitude exagerada para se ver o movimento.
// ═══════════════════════════════════════════════════════════════════════════

export type Esforco = 'N' | 'Mx' | 'My' | 'Vx' | 'Vy';

export const COMPRIMENTO_DA_BARRA = 3.6;

const L = COMPRIMENTO_DA_BARRA;
const CURVATURA = 0.055;
const FLECHA = 0.34;
const ENCURTAMENTO = 0.07;

type Trio = [number, number, number];

export interface Deformada {
  /** Onde vai parar o ponto (x, y, z) da barra indeformada. */
  ponto(x: number, y: number, z: number): Trio;
  /** O centro da face do corte e o giro dela (ângulos de Euler, ordem XYZ). */
  ponta: { pos: Trio; rot: Trio };
}

/** Deslocamento transversal w(z) e inclinação dw/dz da linha do balanço. */
function linhaElastica(momento: boolean, a: number, z: number): { w: number; inc: number } {
  if (momento) {
    const k = CURVATURA * a;
    return { w: (-k * z * z) / 2, inc: -k * z };
  }
  const f = FLECHA * a;
  return { w: (-f * (3 * L * z * z - z ** 3)) / (2 * L ** 3), inc: (-f * (6 * L * z - 3 * z * z)) / (2 * L ** 3) };
}

/** `a` vai de 0 (barra reta) a 1 (o máximo da animação). */
export function deformada(esforco: Esforco, compressao: boolean, a: number): Deformada {
  if (esforco === 'N') {
    const fator = 1 + (compressao ? -1 : 1) * ENCURTAMENTO * a;
    return { ponto: (x, y, z) => [x, y, z * fator], ponta: { pos: [0, 0, L * fator], rot: [0, 0, 0] } };
  }
  const momento = esforco === 'Mx' || esforco === 'My';
  const naAlma = esforco === 'Mx' || esforco === 'Vy';
  // Na alma a ponta desce; nas mesas vai para +x (a linha elástica é negativa).
  const sentido = naAlma ? 1 : -1;
  const linha = (z: number) => {
    const { w, inc } = linhaElastica(momento, a, z);
    return { w: sentido * w, inc: sentido * inc };
  };
  const ponto = (x: number, y: number, z: number): Trio => {
    const { w, inc } = linha(z);
    const phi = Math.atan(inc);
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    return naAlma ? [x, w + y * c, z - y * s] : [w + x * c, y, z - x * s];
  };
  const { w, inc } = linha(L);
  const phi = Math.atan(inc);
  return {
    ponto,
    ponta: naAlma ? { pos: [0, w, L], rot: [-phi, 0, 0] } : { pos: [w, 0, L], rot: [0, phi, 0] },
  };
}
