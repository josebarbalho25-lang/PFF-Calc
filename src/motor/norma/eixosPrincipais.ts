// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/eixosPrincipais.ts — a passagem para os eixos principais, por
//  extenso, na memória (Z e cantoneira)
// ---------------------------------------------------------------------------
//  A norma faz o Ne nos eixos PRINCIPAIS (9.7.2.1) e o Me do Z com o Ney do
//  eixo principal de menor inércia (9.8.2.2); os esforços, ele digita nos
//  eixos da alma (pergunta 7). É nessa passagem que quem confere se perde —
//  então ela aparece inteira: o ângulo, as inércias, que KL foi para cada
//  eixo, o centro de torção e os momentos girados.
//
//  Convenção dos momentos girados, a mesma dos digitados: Mx > 0 comprime o
//  lado y > 0 e My > 0 comprime o lado x > 0; então M1 > 0 comprime o lado
//  2 > 0 e M2 > 0 comprime o lado 1 > 0. O par (My, Mx) é a direção que
//  comprime, e gira como vetor.
// ═══════════════════════════════════════════════════════════════════════════

import type { PropriedadesDaSecao } from '../secao/propriedades';
import { fr, n, par, pot, rz, v, x, type Conta, type Passo } from './memoria';
import type { Comprimentos } from './tipos';

/**
 * Os comprimentos de flambagem nos eixos principais. O eixo principal mais
 * perto de x leva Lx, o mais perto de y leva Ly; a 45° (cantoneira de abas
 * iguais) os dois levam o maior, a favor da segurança.
 */
export function comprimentosPrincipais(alfa: number, L: Comprimentos): { KL1: number; KL2: number; nota?: string } {
  const a = Math.abs(((alfa * 180) / Math.PI) % 180);
  const perto = Math.min(a, 180 - a); // ângulo do eixo 1 com x, 0 a 90
  if (perto < 45 - 1e-6) return { KL1: L.Lx, KL2: L.Ly };
  if (perto > 45 + 1e-6) return { KL1: L.Ly, KL2: L.Lx };
  const m = Math.max(L.Lx, L.Ly);
  return { KL1: m, KL2: m, nota: 'eixos principais a 45°: Lx e Ly tomados iguais ao maior' };
}

/** Seção com os principais girados em relação a x e y (Z, cantoneira). */
export function eixosGirados(pr: PropriedadesDaSecao): boolean {
  return Math.abs(Math.sin(2 * pr.alfa)) > 1e-6;
}

/** Os momentos digitados (eixos da alma) girados para os principais. */
export function momentosPrincipais(alfa: number, Mx: number, My: number): { M1: number; M2: number } {
  const c = Math.cos(alfa);
  const s = Math.sin(alfa);
  return { M1: Mx * c - My * s, M2: Mx * s + My * c };
}

const graus = (rad: number) => (rad * 180) / Math.PI;

/** O passo "Eixos principais": ângulo, I1 e I2, os KL de cada eixo e o centro de torção. */
export function passoDosEixosPrincipais(pr: PropriedadesDaSecao, L: Comprimentos): Passo | undefined {
  if (!eixosGirados(pr)) return undefined;
  const { KL1, KL2, nota } = comprimentosPrincipais(pr.alfa, L);
  const a = graus(pr.alfa);
  const perto = Math.min(Math.abs(a) % 180, 180 - (Math.abs(a) % 180));
  const c = Math.cos(pr.alfa);
  const s = Math.sin(pr.alfa);
  // O centro de torção a partir do centroide, nos eixos 1 e 2.
  const x0p = pr.x0 * c + pr.y0 * s;
  const y0p = -pr.x0 * s + pr.y0 * c;
  const meio = x(fr(x(v('I', 'x'), ' + ', v('I', 'y')), 2));
  const raiz = rz(x(pot(par(fr(x(v('I', 'x'), ' − ', v('I', 'y')), 2)), 2), ' + ', pot(v('I', 'xy'), 2)));
  const contas: Conta[] = [
    {
      simbolo: v('α'),
      formula: x('½ arctan ', fr(x('−2 ', v('I', 'xy')), x(v('I', 'x'), ' − ', v('I', 'y')))),
      numeros: x('½ arctan ', fr(x('−2 · ', n(pr.Ixy)), x(n(pr.Ix), ' − ', n(pr.Iy)))),
      valor: a,
      casas: 2,
      unidade: '°',
      rotulo: 'eixo 1 a partir de x, anti-horário',
    },
    { simbolo: v('I', '1'), formula: x(meio, ' + ', raiz), valor: pr.I1, unidade: 'cm⁴' },
    { simbolo: v('I', '2'), formula: x(meio, ' − ', raiz), valor: pr.I2, unidade: 'cm⁴' },
    {
      simbolo: x(v('K', '1'), v('L', '1')),
      valor: KL1,
      unidade: 'cm',
      rotulo: nota ? 'eixos a 45°: o maior de KxLx e KyLy' : perto < 45 ? 'eixo 1 mais perto de x: KxLx' : 'eixo 1 mais perto de y: KyLy',
    },
    {
      simbolo: x(v('K', '2'), v('L', '2')),
      valor: KL2,
      unidade: 'cm',
      rotulo: nota ? 'eixos a 45°: o maior de KxLx e KyLy' : perto < 45 ? 'eixo 2 mais perto de y: KyLy' : 'eixo 2 mais perto de x: KxLx',
    },
    { simbolo: v('x', '0,1'), formula: x(v('x', '0'), ' cos α + ', v('y', '0'), ' sen α'), valor: x0p, unidade: 'cm', rotulo: 'centro de torção, na direção 1' },
    { simbolo: v('y', '0,2'), formula: x('−', v('x', '0'), ' sen α + ', v('y', '0'), ' cos α'), valor: y0p, unidade: 'cm', rotulo: 'centro de torção, na direção 2' },
  ];
  return { ref: '9.7.2.1', titulo: 'Eixos principais de inércia', contas };
}

/** As contas dos momentos girados, para a seção de premissas. */
export function contasDosMomentosPrincipais(alfa: number, Mx: number, My: number): Conta[] {
  const { M1, M2 } = momentosPrincipais(alfa, Mx, My);
  return [
    {
      simbolo: v('M', '1,Sd'),
      formula: x(v('M', 'x,Sd'), ' cos α − ', v('M', 'y,Sd'), ' sen α'),
      valor: M1,
      unidade: 'kN·cm',
      rotulo: 'positivo comprime o lado 2 > 0',
    },
    {
      simbolo: v('M', '2,Sd'),
      formula: x(v('M', 'x,Sd'), ' sen α + ', v('M', 'y,Sd'), ' cos α'),
      valor: M2,
      unidade: 'kN·cm',
      rotulo: 'positivo comprime o lado 1 > 0',
    },
  ];
}
