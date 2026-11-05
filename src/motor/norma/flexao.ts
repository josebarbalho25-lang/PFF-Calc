// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/flexao.ts — momento fletor resistente (NBR 14762:2010, 9.8.2,
//  e Anexo C pelo MRD), em torno de x ou de y, no sentido do momento aplicado
// ---------------------------------------------------------------------------
//  MRd é o menor entre o início de escoamento da seção efetiva (9.8.2.1), a
//  FLT (9.8.2.2) e o distorcional (9.8.2.3), γ = 1,10.
//
//  ⚠️ O SENTIDO IMPORTA no perfil monossimétrico em relação ao eixo da
//  flexão (U e Ue em y, cartola em x): a parte comprimida é outra, e com ela
//  o Wc, o Mℓ, o Mdist e o sinal do Anexo E. Momento nulo: vale o pior dos
//  dois sentidos.
//
//  ⚠️ FLEXÃO RESTRITA nos eixos do desenho (σ = M·y/Ix), como nas faixas
//  finitas (`faixas/criticos.ts`): no Z e na cantoneira o momento entra no
//  eixo da alma ou da aba, sem a linha neutra inclinar.
// ═══════════════════════════════════════════════════════════════════════════

import type { CriticosDoSentido, CriticosElasticos } from '../faixas/criticos';
import type { PropriedadesDaSecao } from '../secao/propriedades';
import type { SecaoGeometrica } from '../secao/tipos';
import { E, fatorLocal, G, secaoDoPerfil } from './compressao';
import { propriedades } from '../secao/propriedades';
import { comprimentosPrincipais, passoDosEixosPrincipais } from './eixosPrincipais';
import { euler, momentoAnexoE, momentoFLT, parametroJ, principais, simetria, torcao } from './global';
import { tensoesDeReferencia } from '../faixas/malha';
import { MotorDeFaixas } from '../faixas/motor';
import { celulasFechadas } from '../secao/propriedadesGrafo';
import { fr, n, par, pot, rz, situacaoPelaRazao, v, x, type Conta, type Passo, type Verificacao } from './memoria';
import { secaoEfetiva, type CampoDeTensao, type SecaoEfetiva } from './secaoEfetiva';
import { dispensaDistorcional, klFlexao } from './tabelas';
import type { AcoDaVerificacao, AnexoF, Comprimentos, MetodoDoLocal } from './tipos';
import { avaliarAnexoF, sentidoDoAnexoF } from './anexoF';

export const GAMA_FLEXAO = 1.1;
const NU = 0.3;

export type Eixo = 'x' | 'y';
/** + comprime o lado positivo do eixo perpendicular (y > 0 para Mx). */
export type Sentido = 1 | -1;

/** 9.8.2.2: χFLT. */
export function fatorFLT(l0: number): number {
  if (l0 <= 0.6) return 1;
  if (l0 < 1.336) return 1.11 * (1 - 0.278 * l0 ** 2);
  return 1 / l0 ** 2;
}

/** 9.8.2.3 e C.4.3: χdist = 1 até 0,673; (1 − 0,22/λ)/λ acima. */
export function fatorChiDistFlexao(l: number): number {
  return l <= 0.673 ? 1 : (1 - 0.22 / l) / l;
}

export interface ResultadoFlexao {
  eixo: Eixo;
  sentido: Sentido;
  MSd: number;
  W: number;
  Wc: number;
  metodoUsado: MetodoDoLocal;
  /** Escoamento da seção efetiva (9.8.2.1). */
  MRdEscoamento: number;
  /** O do 9.8.2.1, sem FLT: o que entra no 9.8.4 (no MRD, o local com MRe = W·fy). */
  MRdLocal: number;
  Wef?: number;
  /** FLT (9.8.2.2). */
  Me: number;
  lambda0: number;
  chiFLT: number;
  MRdFLT: number;
  /** Distorcional (9.8.2.3). */
  distorcional: 'calculado' | 'nao-se-aplica' | 'dispensado' | 'sem-vale';
  Mdist?: number;
  MRdDist: number;
  MRd: number;
  verificacao: Verificacao;
}

/** O sentido do motor de faixas (F6) que corresponde ao sentido daqui: o "+" daqui é o "neg" de lá. */
function criticosDoSentido(c: CriticosElasticos, eixo: Eixo, s: Sentido): CriticosDoSentido {
  const k = eixo === 'x' ? c.Mx : c.My;
  return s > 0 ? k.neg : k.pos;
}

/**
 * Distâncias às fibras extremas, a partir de uma linha neutra na coordenada
 * `ln` (y para Mx, x para My), do lado comprimido e do tracionado.
 */
function fibras(pr: PropriedadesDaSecao, eixo: Eixo, s: Sentido, ln: number) {
  const max = eixo === 'x' ? pr.caixa.ymax : pr.caixa.xmax;
  const min = eixo === 'x' ? pr.caixa.ymin : pr.caixa.xmin;
  const ladoPos = max - ln;
  const ladoNeg = ln - min;
  return s > 0 ? { comp: ladoPos, trac: ladoNeg } : { comp: ladoNeg, trac: ladoPos };
}

/** σ (compressão +) para a linha neutra `ln` e a tensão `sc` na fibra comprimida extrema. */
function campo(eixo: Eixo, s: Sentido, ln: number, sc: number, comp: number): CampoDeTensao {
  const g = (s * sc) / comp; // σ = s·sc·(coord − ln)/comp
  return eixo === 'x' ? { s0: -g * ln, gx: 0, gy: g } : { s0: -g * ln, gx: g, gy: 0 };
}

/**
 * Seção efetiva do MLE na flexão, por aproximações sucessivas (9.2.2.1 a):
 * a linha neutra anda quando trechos saem. `modo`: 'escoamento' — a fibra
 * extrema que escoa primeiro chega a fy (se for a tracionada, a comprimida
 * fica abaixo); 'compressao' — a fibra comprimida extrema em σc (FLT).
 */
function efetivaNaFlexao(sec: SecaoGeometrica, pr: PropriedadesDaSecao, eixo: Eixo, s: Sentido, fy: number, modo: 'escoamento' | 'compressao', sc?: number) {
  let ln = eixo === 'x' ? pr.G.y : pr.G.x;
  let ef: SecaoEfetiva | undefined;
  let iteracoes = 0;
  for (; iteracoes < 60; iteracoes++) {
    // ⚠️ O CAMPO DE TENSÃO SE MEDE PELA FIBRA EXTREMA BRUTA (achado A9 da
    // revisão de 01/11/2026). Medido na caixa da seção efetiva, quando a ponta
    // livre saía (U em My, cantoneira) a caixa encolhia, o fy ia para o fim
    // do trecho que ficou, e a ponta bruta passava a ler 2 a 3 vezes fy —
    // saía mais chapa, e o ciclo se repetia: MLE 3 a 5 vezes abaixo do MSE e
    // do MRD. Nenhum elemento passa de fy no início do escoamento. A linha
    // neutra é a da efetiva; o Wef, pela fibra extrema da efetiva (abaixo).
    const f = fibras(pr, eixo, s, ln);
    const sigmaC = modo === 'compressao' ? sc! : f.comp >= f.trac ? fy : (fy * f.comp) / f.trac;
    ef = secaoEfetiva(sec, campo(eixo, s, ln, sigmaC, f.comp), E);
    const novo = eixo === 'x' ? ef.props.G.y : ef.props.G.x;
    if (Math.abs(novo - ln) < 1e-7) {
      ln = novo;
      break;
    }
    ln = novo;
  }
  const I = eixo === 'x' ? ef!.props.Ix : ef!.props.Iy;
  const f = fibras(ef!.props, eixo, s, ln);
  return { ef: ef!, ln, iteracoes, Wef: I / Math.max(f.comp, f.trac), Wcef: I / f.comp, convergiu: iteracoes < 60 };
}

/** O Me da FLT para o eixo e o sentido; undefined quando a norma não traz expressão. */
function momentoCritico(
  sec: SecaoGeometrica,
  pr: PropriedadesDaSecao,
  eixo: Eixo,
  s: Sentido,
  L: Comprimentos,
  criticos: CriticosElasticos,
): { Me: number; ref: string; nota?: string; contas: Conta[] } | undefined {
  if (!(L.Lz > 0)) return { Me: Infinity, ref: '9.8.2.2', nota: 'travada à torção (KzLz = 0)', contas: [{ simbolo: v('M', 'e'), texto: 'travada à torção (KzLz = 0): sem FLT' }] };
  const fam = sec.dimensoes.familia;
  const p = principais(pr);
  const Nez = torcao(p, E, G, L.Lz);
  // As contas por extenso: quem confere o Me precisa ver de onde saiu cada Ne.
  const contaNe = (ind: string, I: number, indI: string, KL: number, rotulo?: string): Conta => ({
    simbolo: v('N', ind),
    formula: fr(x('π² ', v('E'), ' ', v('I', indI)), pot(par(x(v('K', indI), v('L', indI))), 2)),
    numeros: fr(x('π² · ', n(E), ' · ', n(I)), pot(n(KL), 2)),
    valor: euler(E, I, KL),
    unidade: 'kN',
    rotulo,
  });
  const contaNez: Conta = {
    simbolo: v('N', 'ez'),
    formula: x(fr(1, pot(v('r', '0'), 2)), ' ', par(x(fr(x('π² ', v('E'), ' ', v('C', 'w')), pot(par(x(v('K', 'z'), v('L', 'z'))), 2)), ' + ', v('G'), ' ', v('J')))),
    numeros: x(fr(1, pot(n(p.r0), 2)), ' ', par(x(fr(x('π² · ', n(E), ' · ', n(p.Cw)), pot(n(L.Lz), 2)), ' + ', n(G), ' · ', n(p.J)))),
    valor: Nez,
    unidade: 'kN',
  };
  if (fam === 'Z' || fam === 'Ze') {
    // ⚠️ O Z FLETIDO EM TORNO DO EIXO PARALELO À ALMA (y): a norma não traz Me
    // (9.8.2.2 só dá o do carregamento no plano da alma). Com Ix > Iy, o
    // deslocamento para fora do plano do carregamento é governado pelo Ix, o
    // eixo forte, e a FLT não comanda — como no perfil I fletido no eixo de
    // menor inércia. Com Iy ≥ Ix (Z livre de mesa larga), essa leitura não
    // vale: fica sem Me e acende "avaliar" (decisão dele, 04/11/2026).
    if (eixo === 'y') {
      if (!(pr.Ix > pr.Iy)) return undefined;
      return {
        Me: Infinity,
        ref: '9.8.2.2',
        nota: 'Z fletido em torno do eixo paralelo à alma, com Ix > Iy: o deslocamento para fora do plano é governado pelo eixo forte e a FLT não comanda',
        contas: [{ simbolo: v('M', 'e'), texto: 'flexão em torno do eixo paralelo à alma, com Ix > Iy: sem FLT' }],
      };
    }
    const { KL2 } = comprimentosPrincipais(pr.alfa, L);
    const Ne2 = euler(E, p.I2, KL2);
    const Me = momentoFLT(L.Cb, p.r0, Ne2, Nez, 0.5);
    return {
      Me,
      ref: '9.8.2.2 (Z ponto-simétrico)',
      contas: [
        contaNe('e2', p.I2, '2', KL2, 'eixo principal de menor inércia'),
        contaNez,
        {
          simbolo: v('M', 'e'),
          formula: x('0,5 ', v('C', 'b'), ' ', v('r', '0'), ' ', rz(x(v('N', 'e2'), ' ', v('N', 'ez')))),
          numeros: x('0,5 · ', n(L.Cb), ' · ', n(p.r0), ' · ', rz(x(n(Ne2), ' · ', n(Nez)))),
          valor: Me,
          unidade: 'kN·cm',
        },
      ],
    };
  }
  if (fam === 'U' || fam === 'Ue' || fam === 'Cr') {
    // eixo de simetria: x no U e no Ue, y na cartola
    const simetricoEm: Eixo = fam === 'Cr' ? 'y' : 'x';
    if (eixo === simetricoEm) {
      const e = simetricoEm === 'x' ? 'y' : 'x';
      const Iperp = e === 'y' ? pr.Iy : pr.Ix;
      const Lperp = e === 'y' ? L.Ly : L.Lx;
      const Ne = euler(E, Iperp, Lperp);
      const Me = momentoFLT(L.Cb, p.r0, Ne, Nez);
      return {
        Me,
        ref: '9.8.2.2',
        contas: [
          contaNe(`e${e}`, Iperp, e, Lperp),
          contaNez,
          {
            simbolo: v('M', 'e'),
            formula: x(v('C', 'b'), ' ', v('r', '0'), ' ', rz(x(v('N', `e${e}`), ' ', v('N', 'ez')))),
            numeros: x(n(L.Cb), ' · ', n(p.r0), ' · ', rz(x(n(Ne), ' · ', n(Nez)))),
            valor: Me,
            unidade: 'kN·cm',
          },
        ],
      };
    }
    // Anexo E: flexão em torno do eixo perpendicular ao de simetria. Cm = 1,0,
    // a favor da segurança (a tela não pede M1/M2).
    let j: number, Cs: 1 | -1, e: 'x' | 'y';
    if (fam === 'Cr') {
      j = parametroJ(-pr.cubicas.y3, -pr.cubicas.x2y, pr.Ix, Math.abs(pr.y0));
      // centro de torção do lado y > 0 (a mesa de cima); Cs = +1 se comprime esse lado
      Cs = s > 0 === pr.y0 > 0 ? 1 : -1;
      e = 'y';
    } else {
      j = parametroJ(pr.cubicas.x3, pr.cubicas.xy2, pr.Iy, Math.abs(pr.x0));
      // centro de torção em x < 0 (atrás da alma); My > 0 comprime x > 0 → Cs = −1
      Cs = s > 0 === pr.x0 > 0 ? 1 : -1;
      e = 'x';
    }
    const I = e === 'x' ? pr.Ix : pr.Iy;
    const KL = e === 'x' ? L.Lx : L.Ly;
    const Ne = euler(E, I, KL);
    const Me = momentoAnexoE(Cs, 1, Ne, Nez, j, pr.r0);
    const sinal = Cs > 0 ? ' + ' : ' − ';
    const Nsim = v('N', `e${e}`);
    return {
      Me,
      ref: 'Anexo E',
      nota: `Cs = ${Cs}; Cm = 1,0`,
      contas: [
        contaNe(`e${e}`, I, e, KL, 'em torno do eixo de simetria'),
        contaNez,
        { simbolo: v('j'), valor: j, unidade: 'cm', rotulo: 'E.2.1' },
        { simbolo: v('C', 's'), valor: Cs, casas: 0, rotulo: Cs > 0 ? 'comprime o lado do centro de torção' : 'traciona o lado do centro de torção' },
        {
          simbolo: v('M', 'e'),
          formula: x(fr(x(v('C', 's'), ' ', Nsim), v('C', 'm')), ' ', par(x(v('j'), sinal, rz(x(pot(v('j'), 2), ' + ', pot(v('r', '0'), 2), ' ', fr(v('N', 'ez'), Nsim)))))),
          numeros: x(fr(x(n(Cs, 0), ' · ', n(Ne)), n(1, 1)), ' ', par(x(n(j), sinal, rz(x(pot(n(j), 2), ' + ', pot(n(pr.r0), 2), ' · ', fr(n(Nez), n(Ne))))))),
          valor: Me,
          unidade: 'kN·cm',
        },
      ],
    };
  }
  if (fam === 'Desenho' || fam === 'Ue2') return momentoGenerico(sec, pr, eixo, s, L, criticos, p, Nez, contaNe, contaNez);
  // Cantoneiras: a norma não traz Me para elas (nem nos eixos das abas, nem
  // nos principais): FLT fica sem verificar, com aviso.
  return undefined;
}

/**
 * O Me da seção desenhada e dos dois Ue boca com boca, pela forma:
 * - fechada (tubo, solda contínua): caixão, Me = Cb·(Ney·G·J)^0,5 (9.8.2.2);
 * - dupla simetria, eixos alinhados: Me = Cb·r0·(Ney·Nez)^0,5 no eixo de
 *   maior inércia; no de menor, não há FLT;
 * - monossimétrica alinhada: a mesma fórmula fletida em torno do eixo de
 *   simetria; em torno do outro, o Anexo E;
 * - sem simetria, ou com os eixos principais girados: as faixas finitas no
 *   comprimento KzLz (o ramo global da curva), vezes Cb — a "análise geral de
 *   estabilidade elástica" que o C.1 pressupõe.
 */
function momentoGenerico(
  sec: SecaoGeometrica,
  pr: PropriedadesDaSecao,
  eixo: Eixo,
  s: Sentido,
  L: Comprimentos,
  criticos: CriticosElasticos,
  p: ReturnType<typeof principais>,
  Nez: number,
  contaNe: (ind: string, I: number, indI: string, KL: number, rotulo?: string) => Conta,
  contaNez: Conta,
): { Me: number; ref: string; nota?: string; contas: Conta[] } {
  const d = sec.dimensoes;
  const alinhado = Math.abs(Math.sin(2 * pr.alfa)) < 1e-6;
  const sim = simetria(p);
  const maior = eixo === 'x' ? pr.Ix >= pr.Iy : pr.Iy > pr.Ix;
  const outro = eixo === 'x' ? 'y' : 'x';
  const Iout = outro === 'y' ? pr.Iy : pr.Ix;
  const KLout = outro === 'y' ? L.Ly : L.Lx;
  const semFLT = { Me: Infinity, ref: '9.8.2.2', nota: 'flexão em torno do eixo de menor inércia de seção simétrica: sem FLT', contas: [{ simbolo: v('M', 'e'), texto: 'flexão em torno do eixo de menor inércia: sem FLT' } as Conta] };
  const fechada = celulasFechadas(sec) > 0 && !(d.familia === 'Ue2' && d.solda?.tipo === 'intermitente');
  if (fechada && alinhado && sim === 'dupla') {
    if (!maior) return semFLT;
    const Ne = euler(E, Iout, KLout);
    const Me = Number.isFinite(Ne) ? L.Cb * Math.sqrt(Ne * G * pr.J) : Infinity;
    return {
      Me,
      ref: '9.8.2.2 (seção fechada)',
      contas: [
        contaNe(`e${outro}`, Iout, outro, KLout),
        { simbolo: v('M', 'e'), formula: x(v('C', 'b'), ' ', rz(x(v('N', `e${outro}`), ' ', v('G'), ' ', v('J')))), numeros: x(n(L.Cb), ' · ', rz(x(n(Ne), ' · ', n(G), ' · ', n(pr.J)))), valor: Me, unidade: 'kN·cm' },
      ],
    };
  }
  if (alinhado && sim !== 'assimetrica') {
    // eixo de simetria no desenho: x se o centro de torção está sobre x (y0 = 0)
    const simEm: Eixo | 'ambos' = sim === 'dupla' ? 'ambos' : Math.abs(pr.y0) < 1e-9 * pr.r0 ? 'x' : 'y';
    if (sim === 'dupla' && !maior) return semFLT;
    if (simEm === 'ambos' || simEm === eixo) {
      const Ne = euler(E, Iout, KLout);
      const Me = momentoFLT(L.Cb, p.r0, Ne, Nez);
      return {
        Me,
        ref: '9.8.2.2',
        contas: [
          contaNe(`e${outro}`, Iout, outro, KLout),
          contaNez,
          { simbolo: v('M', 'e'), formula: x(v('C', 'b'), ' ', v('r', '0'), ' ', rz(x(v('N', `e${outro}`), ' ', v('N', 'ez')))), numeros: x(n(L.Cb), ' · ', n(p.r0), ' · ', rz(x(n(Ne), ' · ', n(Nez)))), valor: Me, unidade: 'kN·cm' },
        ],
      };
    }
    // Anexo E: fletida em torno do eixo perpendicular ao de simetria. Na
    // notação do anexo, x é o eixo de simetria, com o centro de torção do lado
    // negativo; aqui o desenho é girado/espelhado para isso.
    const emX = simEm === 'x';
    const c0 = emX ? pr.x0 : pr.y0;
    const sg = c0 < 0 ? 1 : -1;
    const j = emX ? parametroJ(sg * pr.cubicas.x3, sg * pr.cubicas.xy2, pr.Iy, Math.abs(c0)) : parametroJ(sg * pr.cubicas.y3, sg * pr.cubicas.x2y, pr.Ix, Math.abs(c0));
    const Cs: 1 | -1 = s > 0 === c0 > 0 ? 1 : -1;
    const Isim = emX ? pr.Ix : pr.Iy;
    const KLsim = emX ? L.Lx : L.Ly;
    const e = emX ? 'x' : 'y';
    const Ne = euler(E, Isim, KLsim);
    const Me = momentoAnexoE(Cs, 1, Ne, Nez, j, pr.r0);
    return {
      Me,
      ref: 'Anexo E',
      nota: `Cs = ${Cs}; Cm = 1,0`,
      contas: [contaNe(`e${e}`, Isim, e, KLsim, 'em torno do eixo de simetria'), contaNez, { simbolo: v('j'), valor: j, unidade: 'cm', rotulo: 'E.2.1' }, { simbolo: v('C', 's'), valor: Cs, casas: 0 }, { simbolo: v('M', 'e'), valor: Me, unidade: 'kN·cm' }],
    };
  }
  // Sem simetria (ou eixos principais girados): as faixas no comprimento da barra.
  const Lb = L.Lz;
  if (!(Lb > 0)) return { Me: Infinity, ref: 'C.1', nota: 'travada à torção (KzLz = 0)', contas: [{ simbolo: v('M', 'e'), texto: 'travada à torção (KzLz = 0): sem FLT' }] };
  const m = criticos.malha;
  const motor = new MotorDeFaixas(m, tensoesDeReferencia(m, eixo === 'x' ? { Mx: 1 } : { My: 1 }, true));
  const r = motor.resolver([Lb]);
  // o "+" daqui é o "neg" das faixas (criticosDoSentido)
  const Mcr = s > 0 ? r.lamNeg[0] : r.lamPos[0];
  const Me = Number.isFinite(Mcr) ? L.Cb * Mcr : Infinity;
  return {
    Me,
    ref: 'C.1 (faixas finitas)',
    nota: 'Me pelas faixas finitas no comprimento KzLz: seção sem simetria',
    contas: [
      { simbolo: v('M', 'cr'), valor: Mcr, unidade: 'kN·cm', rotulo: `faixas finitas, meia-onda L = KzLz = ${Lb.toFixed(1)} cm` },
      { simbolo: v('M', 'e'), formula: x(v('C', 'b'), ' ', v('M', 'cr')), valor: Me, unidade: 'kN·cm' },
    ],
  };
}

function contaSimples(simbolo: Conta['simbolo'], valor: number, unidade?: string, rotulo?: string): Conta {
  return { simbolo, valor, unidade, rotulo };
}

export function verificarFlexao(
  sec: SecaoGeometrica,
  pr: PropriedadesDaSecao,
  aco: AcoDaVerificacao,
  L: Comprimentos,
  metodo: MetodoDoLocal,
  criticos: CriticosElasticos,
  eixo: Eixo,
  MSd: number,
  anexoF?: AnexoF,
): ResultadoFlexao {
  const F = eixo === 'x' ? anexoF : undefined;
  if (MSd === 0) {
    const a = verificarFlexao1(sec, pr, aco, L, metodo, criticos, eixo, 1, 0, F);
    const b = verificarFlexao1(sec, pr, aco, L, metodo, criticos, eixo, -1, 0, F);
    return a.MRd <= b.MRd ? a : b;
  }
  return verificarFlexao1(sec, pr, aco, L, metodo, criticos, eixo, MSd > 0 ? 1 : -1, Math.abs(MSd), F);
}

function verificarFlexao1(
  sec: SecaoGeometrica,
  pr: PropriedadesDaSecao,
  aco: AcoDaVerificacao,
  L: Comprimentos,
  metodo: MetodoDoLocal,
  criticos: CriticosElasticos,
  eixo: Eixo,
  s: Sentido,
  MSd: number,
  anexoF?: AnexoF,
): ResultadoFlexao {
  const fy = aco.fy;
  const I = eixo === 'x' ? pr.Ix : pr.Iy;
  const bruta = fibras(pr, eixo, s, eixo === 'x' ? pr.G.y : pr.G.x);
  const W = I / Math.max(bruta.comp, bruta.trac);
  const Wc = I / bruta.comp;
  const cr = criticosDoSentido(criticos, eixo, s);
  const passos: Passo[] = [];
  const avisos: string[] = [];
  const notas: string[] = [];
  passos.push({
    ref: '9.8.2',
    titulo: `Módulos resistentes da seção bruta (${s > 0 ? 'positivo' : 'negativo'}: comprime ${eixo === 'x' ? (s > 0 ? 'em cima' : 'embaixo') : s > 0 ? 'o lado x > 0' : 'o lado x < 0'})`,
    contas: [contaSimples(v('W'), W, 'cm³', 'fibra que escoa primeiro'), contaSimples(v('W', 'c'), Wc, 'cm³', 'fibra comprimida')],
  });

  // ── FLT: Me e χFLT (9.8.2.2 / C.4.1) ──
  // No Z, o Me usa o eixo principal de menor inércia: a passagem vai por extenso.
  const familia = sec.dimensoes.familia;
  const eixos = (familia === 'Z' || familia === 'Ze') && eixo === 'x' ? passoDosEixosPrincipais(pr, L) : undefined;
  if (eixos) passos.push(eixos);
  const me = momentoCritico(sec, pr, eixo, s, L, criticos);
  let Me = Infinity;
  if (!me && (familia === 'Z' || familia === 'Ze') && eixo === 'y')
    (MSd !== 0 ? avisos : notas).push('Z com Iy ≥ Ix fletido em torno do eixo paralelo à alma: a norma não traz Me, e o eixo forte deixa de governar o deslocamento para fora do plano — FLT não verificada');
  else if (!me) (MSd > 0 ? avisos : notas).push('a norma não traz Me para esta seção neste eixo: FLT não verificada');
  else {
    Me = me.Me;
    if (me.nota) notas.push(me.nota);
  }
  const lambda0 = Math.sqrt((Wc * fy) / Me);
  const chiFLT = fatorFLT(lambda0);
  const contasMe: Conta[] = me ? me.contas : [contaSimples(v('M', 'e'), Me, 'kN·cm')];

  // ── Local e escoamento, pelo método ──
  // Seção desenhada: pelo MRD; tubo dos dois Ue: MSE (Tabela 13, caso c) ou
  // MRD — o porquê está em compressao.ts.
  let metodoUsado: MetodoDoLocal = metodo;
  if (familia === 'Desenho' && metodo !== 'MRD') {
    metodoUsado = 'MRD';
    notas.push('seção desenhada: pelo MRD, com as faixas finitas (Anexo C)');
  } else if (familia === 'Ue2' && sec.dimensoes.solda?.tipo !== 'intermitente' && metodo === 'MLE') {
    metodoUsado = 'MRD';
    notas.push('dois Ue boca com boca: o MLE não se aplica à nervura soldada; calculado pelo MRD');
  } else if (familia === 'Ue2' && eixo === 'y' && metodo === 'MLE') {
    // Em y, cada Ue fica sob força e momento ao mesmo tempo (o centroide dele
    // está longe do eixo do conjunto): não é a flexão simples do 9.2.2.1.
    metodoUsado = 'MRD';
    notas.push('solda intermitente: flexão em y pelo MRD (cada perfil sob força e momento)');
  }
  // Solda intermitente em x: a seção efetiva de um Ue, vezes 2 (os dois fletem
  // em torno do mesmo eixo, com o centroide na mesma altura).
  const local = secaoDoPerfil(sec);
  const prLocal = local.n > 1 ? propriedades(local.sec) : pr;
  let MRdEscoamento = Infinity;
  let MRdFLT = Infinity;
  let MRdLocal: number | undefined;
  let Wef: number | undefined;
  const Ml = cr.local?.lam;
  if (cr.localEmprestado) notas.push('a curva tem um só vale de ondas curtas: entra como local e como distorcional');
  if (cr.distorcional?.ombro) notas.push('sem vale distorcional: Mdist tomado no ombro da curva (as dobras passam a andar ≥ 0,5)');

  if (metodoUsado === 'MLE') {
    const esc0 = efetivaNaFlexao(local.sec, prLocal, eixo, s, fy, 'escoamento');
    const flt0 = chiFLT < 1 ? efetivaNaFlexao(local.sec, prLocal, eixo, s, fy, 'compressao', chiFLT * fy) : esc0;
    const esc = { ...esc0, Wef: local.n * esc0.Wef, Wcef: local.n * esc0.Wcef };
    const flt = { ...flt0, Wef: local.n * flt0.Wef, Wcef: local.n * flt0.Wcef };
    if (local.n > 1) notas.push('solda intermitente: seção efetiva de um Ue, vezes 2 (cada perfil isolado)');
    const fora = [...esc.ef.foraDoCampo, ...flt.ef.foraDoCampo];
    if (fora.length) {
      metodoUsado = 'MRD';
      notas.push(`fora do campo do MLE (${fora[0]}): calculado pelo MRD`);
    } else {
      if (!esc.convergiu || !flt.convergiu) avisos.push('a linha neutra da seção efetiva não convergiu em 60 aproximações');
      avisos.push(...esc.ef.avisos);
      Wef = esc.Wef;
      MRdEscoamento = (Wef * fy) / GAMA_FLEXAO;
      MRdFLT = (chiFLT * flt.Wcef * fy) / GAMA_FLEXAO;
      passos.push({
        ref: '9.8.2.1 a); 9.2.2.1; 9.2.3.1',
        titulo: 'Início de escoamento da seção efetiva (MLE)',
        contas: [
          ...esc.ef.elementos
            .filter((el) => el.largura && !(el.largura.lambdaP <= 0))
            .map((el) => contaSimples(x(v('b', 'ef'), ` ${el.papel}`), el.efetivos.reduce((t, [a, b]) => t + (b - a), 0), 'cm', `${el.largura!.caso} · λp = ${el.largura!.lambdaP.toFixed(3)}`)),
          contaSimples(v('W', 'ef'), Wef, 'cm³', `${esc.iteracoes + 1} aproximações da linha neutra`),
          { simbolo: v('M', 'Rd'), formula: fr(x(v('W', 'ef'), ' ', v('f', 'y')), v('γ')), numeros: fr(x(n(Wef), ' · ', n(fy)), n(GAMA_FLEXAO, 2)), valor: MRdEscoamento, unidade: 'kN·cm' },
        ],
      });
      passos.push({
        ref: me ? me.ref : '9.8.2.2',
        titulo: 'Flambagem lateral com torção (MLE)',
        contas: [
          ...contasMe,
          { simbolo: v('λ', '0'), formula: rz(fr(x(v('W', 'c'), ' ', v('f', 'y')), v('M', 'e'))), valor: lambda0, casas: 3 },
          contaSimples(v('χ', 'FLT'), chiFLT),
          contaSimples(v('W', 'c,ef'), flt.Wcef, 'cm³', 'σ = χFLT·fy na fibra comprimida'),
          { simbolo: v('M', 'Rd'), formula: fr(x(v('χ', 'FLT'), ' ', v('W', 'c,ef'), ' ', v('f', 'y')), v('γ')), valor: MRdFLT, unidade: 'kN·cm' },
        ],
      });
    }
  }

  if (metodoUsado === 'MSE') {
    const d = sec.dimensoes;
    const tubo = d.familia === 'Ue2' && d.solda?.tipo === 'continua';
    const maior = eixo === 'x' && (['U', 'Ue', 'Z', 'Ze', 'Ue2'].includes(d.familia)) && (d.anguloEnrijecedor ?? 90) === 90;
    const caso = d.familia === 'U' || d.familia === 'Z' ? 'a' : tubo ? 'c' : 'b';
    // no tubo, a largura externa é a dos dois Ue: 2·bf (Tabela 9, caso d)
    const kl = maior ? klFlexao(caso, (tubo ? 2 * d.bf : d.bf) / d.bw, d.D / d.bw) : undefined;
    const MlTab = kl !== undefined ? ((kl * Math.PI ** 2 * E) / (12 * (1 - NU ** 2) * (d.bw / d.t) ** 2)) * Wc : undefined;
    const MlUsado = MlTab ?? Ml;
    if (MlUsado === undefined) {
      Wef = W;
      MRdEscoamento = (W * fy) / GAMA_FLEXAO;
      MRdFLT = (chiFLT * Wc * fy) / GAMA_FLEXAO;
      notas.push('sem vale local na curva de assinatura (C.2): seção bruta');
    } else {
      const lpE = Math.sqrt((W * fy) / MlUsado);
      Wef = W * fatorLocal673(lpE);
      const lpF = Math.sqrt((chiFLT * Wc * fy) / MlUsado);
      const Wcef = Wc * fatorLocal673(lpF);
      MRdEscoamento = (Wef * fy) / GAMA_FLEXAO;
      MRdFLT = (chiFLT * Wcef * fy) / GAMA_FLEXAO;
      passos.push({
        ref: '9.8.2.1 b); 9.8.2.2 b)',
        titulo: 'Seção efetiva pelo MSE',
        contas: [
          contaSimples(v('M', 'ℓ'), MlUsado, 'kN·cm', MlTab !== undefined ? `Tabela 13, caso ${caso}, kℓ = ${kl!.toFixed(2)}` : 'faixas finitas'),
          { simbolo: v('λ', 'p'), formula: rz(fr(x(v('W'), ' ', v('f', 'y')), v('M', 'ℓ'))), valor: lpE, casas: 3 },
          contaSimples(v('W', 'ef'), Wef, 'cm³', lpE <= 0.673 ? 'λp ≤ 0,673' : 'λp > 0,673'),
          { simbolo: v('M', 'Rd'), formula: fr(x(v('W', 'ef'), ' ', v('f', 'y')), v('γ')), valor: MRdEscoamento, unidade: 'kN·cm' },
          ...contasMe,
          contaSimples(v('χ', 'FLT'), chiFLT),
          contaSimples(v('W', 'c,ef'), Wcef, 'cm³', `λp = ${lpF.toFixed(3)}`),
          { simbolo: v('M', 'Rd,FLT'), formula: fr(x(v('χ', 'FLT'), ' ', v('W', 'c,ef'), ' ', v('f', 'y')), v('γ')), valor: MRdFLT, unidade: 'kN·cm' },
        ],
      });
    }
  }

  if (metodoUsado === 'MRD') {
    // C.4.1: λ0 com W (a fibra que escoa primeiro), não com Wc como em 9.8.2.2
    const l0W = Math.sqrt((W * fy) / Me);
    const MReC4 = fatorFLT(l0W) * W * fy;
    let MRl = MReC4;
    const contas: Conta[] = [...contasMe, { simbolo: v('λ', '0'), formula: rz(fr(x(v('W'), ' ', v('f', 'y')), v('M', 'e'))), valor: l0W, casas: 3 }, contaSimples(v('M', 'Re'), MReC4, 'kN·cm')];
    if (Ml === undefined) notas.push('sem vale local na curva de assinatura (C.2): local não considerado');
    else {
      const ll = Math.sqrt(MReC4 / Ml);
      MRl = MReC4 * fatorLocal(ll);
      contas.push(contaSimples(v('M', 'ℓ'), Ml, 'kN·cm', 'faixas finitas'), { simbolo: v('λ', 'ℓ'), formula: rz(fr(v('M', 'Re'), v('M', 'ℓ'))), valor: ll, casas: 3 }, contaSimples(v('M', 'Rℓ'), MRl, 'kN·cm'));
    }
    MRdFLT = MReC4 / GAMA_FLEXAO;
    MRdEscoamento = MRl / GAMA_FLEXAO;
    // Para o 9.8.4 (momento com cortante), o análogo do 9.8.2.1: o local com
    // MRe = W·fy, sem a FLT (antes ia o MRℓ com a FLT dentro — a favor, mas
    // fora da norma; achado do juiz da revisão de 01/11/2026).
    MRdLocal = Ml === undefined ? (W * fy) / GAMA_FLEXAO : (W * fy * fatorLocal(Math.sqrt((W * fy) / Ml))) / GAMA_FLEXAO;
    passos.push({ ref: 'C.4.1; C.4.2', titulo: 'Global (FLT) e local pelo MRD', contas });
  }

  // ── Distorcional (9.8.2.3 / C.4.3) ──
  const d = sec.dimensoes;
  let distorcional: ResultadoFlexao['distorcional'] = 'calculado';
  let Mdist: number | undefined;
  let MRdDist = Infinity;
  // ⚠️ O TUBO DOS DOIS Ue NÃO TEM O DISTORCIONAL DO Ue (os enrijecedores
  // soldados não giram), mas as faixas acham outro vale de onda longa: a mesa
  // comprimida flamba inteira, de alma a alma, levando a nervura junto. É
  // verificado quando a curva faz esse vale (Ue 300x100x25x2,65: 1,8·My, não
  // governa — CONFERENCIA §5); o DimPerfil usa ali o distorcional de um Ue.
  const valeDoTubo = d.familia === 'Ue2' && local.n === 1 && cr.distorcional !== undefined && !cr.distorcional.ombro && !cr.localEmprestado;
  if (!valeDoTubo && !['Ue', 'Ze', 'Cr', 'Le'].includes(d.familia) && !(d.familia === 'Ue2' && local.n > 1)) {
    distorcional = 'nao-se-aplica';
  } else {
    // Só com o enrijecedor a 90° (figuras da Tabela 9; ver compressao.ts).
    const reto = (d.anguloEnrijecedor ?? 90) === 90;
    const minimo = eixo === 'x' && (d.familia === 'Ue' || d.familia === 'Ze' || local.n > 1) && reto ? dispensaDistorcional(14, d.bf / d.bw, d.bw / d.t) : undefined;
    if (metodoUsado !== 'MRD' && minimo !== undefined && d.D / d.bw >= minimo) {
      distorcional = 'dispensado';
      passos.push({ ref: '9.8.2.3; Tabela 14', titulo: 'Flambagem distorcional', contas: [{ simbolo: fr(v('D'), v('b', 'w')), valor: d.D / d.bw, casas: 3, rotulo: `≥ ${minimo.toFixed(3)} → dispensada` }] });
    } else {
      Mdist = cr.distorcional?.lam;
      if (Mdist === undefined) {
        distorcional = 'sem-vale';
        passos.push({ ref: 'C.2', titulo: 'Flambagem distorcional', contas: [{ simbolo: v('M', 'dist'), texto: 'a curva de assinatura não tem vale distorcional: não considerada' }] });
      } else {
        const ld = Math.sqrt((W * fy) / Mdist);
        const cd = fatorChiDistFlexao(ld);
        MRdDist = (cd * W * fy) / GAMA_FLEXAO;
        passos.push({
          ref: metodoUsado === 'MRD' ? 'C.4.3' : '9.8.2.3',
          titulo: 'Flambagem distorcional',
          contas: [
            contaSimples(v('M', 'dist'), Mdist, 'kN·cm', cr.distorcional!.ombro ? `faixas finitas, ombro da curva (sem vale), L = ${cr.distorcional!.L.toFixed(1)} cm` : valeDoTubo ? `faixas finitas, L = ${cr.distorcional!.L.toFixed(1)} cm: a mesa comprimida com a nervura` : `faixas finitas, L = ${cr.distorcional!.L.toFixed(1)} cm`),
            { simbolo: v('λ', 'dist'), formula: rz(fr(x(v('W'), ' ', v('f', 'y')), v('M', 'dist'))), numeros: rz(fr(x(n(W), ' · ', n(fy)), n(Mdist))), valor: ld, casas: 3 },
            { simbolo: v('χ', 'dist'), formula: ld <= 0.673 ? n(1) : x(par(x('1 − ', fr(n(0.22, 2), v('λ', 'dist')))), ' ', fr(1, v('λ', 'dist'))), valor: cd, casas: 3 },
            { simbolo: v('M', 'Rd,dist'), formula: fr(x(v('χ', 'dist'), ' ', v('W'), ' ', v('f', 'y')), v('γ')), valor: MRdDist, unidade: 'kN·cm' },
          ],
        });
      }
    }
  }

  // ── Anexo F (painel na mesa tracionada) ──
  let MRdAnexoF = Infinity;
  if (anexoF) {
    if (s !== sentidoDoAnexoF(anexoF)) {
      notas.push(`Anexo F: este momento comprime a mesa com a telha (${anexoF.mesaComTelha === 'superior' ? 'de cima' : 'de baixo'}); verificado pelo 9.8.2`);
    } else {
      const av = avaliarAnexoF(sec, aco, anexoF);
      const contas = av.contas;
      if (av.falhas.length || av.R === undefined) {
        notas.push(`Anexo F não aplicado (F.2), verificado pelo 9.8.2: ${av.falhas.join('; ')}`);
        passos.push({ ref: 'Anexo F, F.1 e F.2', titulo: 'Anexo F: condições', contas, nota: `não atendidas: ${av.falhas.join('; ')} — verificação pelo 9.8.2` });
      } else {
        // O Wef do 9.8.2.1; no MRD, o análogo: o local com MRe = W·fy (MRdLocal).
        const base = metodoUsado === 'MRD' ? (MRdLocal ?? MRdEscoamento) : MRdEscoamento;
        MRdAnexoF = av.R * base;
        passos.push({
          ref: 'Anexo F, F.1; Tabela F.1',
          titulo: 'Painel conectado à mesa tracionada',
          contas: [
            ...contas,
            { simbolo: v('R'), valor: av.R, casas: 2, rotulo: `Tabela F.1: ${av.linha}` },
            {
              simbolo: v('M', 'Rd'),
              formula: fr(x(v('R'), ' ', v('W', 'ef'), ' ', v('f', 'y')), v('γ')),
              numeros: x(n(av.R, 2), ' · ', n(base, 1), metodoUsado === 'MRD' ? ' (MRd local, C.4)' : ''),
              valor: MRdAnexoF,
              unidade: 'kN·cm',
            },
          ],
          nota: 'o R substitui a FLT; o distorcional continua verificado e vale o menor',
        });
      }
    }
  }
  const MRd = Number.isFinite(MRdAnexoF) ? Math.min(MRdAnexoF, MRdDist) : Math.min(MRdEscoamento, MRdFLT, MRdDist);
  const governa = Number.isFinite(MRdAnexoF)
    ? MRd === MRdDist && MRdDist < MRdAnexoF ? 'distorcional' : 'Anexo F'
    : MRd === MRdDist ? 'distorcional' : MRd === MRdFLT && MRdFLT < MRdEscoamento ? 'FLT' : metodoUsado === 'MRD' ? 'local (MRD)' : 'escoamento da seção efetiva';
  const razao = MSd / MRd;
  return {
    eixo,
    sentido: s,
    MSd,
    W,
    Wc,
    metodoUsado,
    MRdEscoamento,
    MRdLocal: MRdLocal ?? MRdEscoamento,
    Wef,
    Me,
    lambda0,
    chiFLT,
    MRdFLT,
    distorcional,
    Mdist,
    MRdDist,
    MRd,
    verificacao: {
      chave: eixo === 'x' ? 'flexaoX' : 'flexaoY',
      titulo: `Flexão em ${eixo}`,
      item: metodoUsado === 'MRD' ? 'C.4' : '9.8.2',
      sd: MSd,
      rd: MRd,
      unidade: 'kN·cm',
      razao,
      situacao: situacaoPelaRazao(razao, avisos),
      governa,
      passos,
      avisos,
      notas,
    },
  };
}

/** 9.8.2.1 b): Wef = W(1 − 0,22/λp)/λp acima de 0,673. */
function fatorLocal673(lp: number): number {
  return lp <= 0.673 ? 1 : (1 - 0.22 / lp) / lp;
}
