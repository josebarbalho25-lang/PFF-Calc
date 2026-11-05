// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/compressao.ts — força axial de compressão resistente
//  (NBR 14762:2010, 9.7, e Anexo C pelo MRD)
// ---------------------------------------------------------------------------
//  Nc,Rd é o menor entre a global com a local (9.7.2) e a distorcional
//  (9.7.3), γ = 1,20. A local sai por um dos três métodos (8.4):
//   · MLE — área efetiva pelas larguras efetivas de cada elemento, σ = χ·fy;
//   · MSE — área efetiva direta pelo Nℓ (Tabela 10 quando o perfil está nela;
//     senão o Nℓ das faixas finitas, que o 9.7.2 também aceita);
//   · MRD — Anexo C: Nc,Re, Nc,Rℓ e Nc,Rdist com Nℓ e Ndist das faixas.
//
//  ⚠️ O DISTORCIONAL SÓ ENTRA ONDE O MODO EXISTE: perfil com enrijecedor de
//  borda (Ue, Ze, cartola, Le). U simples, pela norma (9.3); Z simples e
//  cantoneira simples, pelo mesmo motivo (pergunta 9 a ele). E quando a curva
//  de assinatura não tem vale distorcional, C.2: "basta que o cálculo do
//  esforço resistente respectivo não seja levado em consideração" (pergunta 8).
// ═══════════════════════════════════════════════════════════════════════════

import type { CriticosElasticos } from '../faixas/criticos';
import type { PropriedadesDaSecao } from '../secao/propriedades';
import type { SecaoGeometrica } from '../secao/tipos';
import { euler, forcaGlobal, principais, type ForcaGlobal } from './global';
import { fr, n, par, pot, rz, situacaoPelaRazao, v, x, type Conta, type Passo, type Verificacao } from './memoria';
import { montarSecao } from '../secao/familias';
import { secaoEfetiva, type SecaoEfetiva } from './secaoEfetiva';
import { comprimentosPrincipais, passoDosEixosPrincipais } from './eixosPrincipais';
import { dispensaDistorcional, klCompressao } from './tabelas';
import type { AcoDaVerificacao, Comprimentos, MetodoDoLocal } from './tipos';

export const GAMA_COMPRESSAO = 1.2;
export const E = 20000;
export const G = 7700;
const NU = 0.3;

/** 9.7.2: χ = 0,658^λ0² até 1,5; 0,877/λ0² acima. */
export function fatorChi(l0: number): number {
  return l0 <= 1.5 ? 0.658 ** (l0 ** 2) : 0.877 / l0 ** 2;
}

/** 9.7.3 e C.3.3: χdist = 1 até 0,561; (1 − 0,25/λ^1,2)/λ^1,2 acima. */
export function fatorChiDistCompressao(l: number): number {
  return l <= 0.561 ? 1 : (1 - 0.25 / l ** 1.2) / l ** 1.2;
}

/** C.3.2 e o MSE de 9.7.2: (1 − 0,15/λ^0,8)/λ^0,8 acima de 0,776. */
export function fatorLocal(l: number): number {
  return l <= 0.776 ? 1 : (1 - 0.15 / l ** 0.8) / l ** 0.8;
}

// A regra de que KL vai para cada eixo principal mora em eixosPrincipais.ts;
// reexportada daqui para quem já a importava.
export { comprimentosPrincipais } from './eixosPrincipais';

export type SituacaoDistorcional = 'calculado' | 'nao-se-aplica' | 'dispensado' | 'sem-vale';

export interface ResultadoCompressao {
  NcSd: number;
  global: ForcaGlobal;
  KL1: number;
  KL2: number;
  lambda0: number;
  chi: number;
  metodo: MetodoDoLocal;
  /** Método que de fato valeu (o MLE cai para o MRD fora do campo dele). */
  metodoUsado: MetodoDoLocal;
  /** Força resistente de cálculo da global + local, kN. */
  NcRdGlobal: number;
  Aef?: number;
  efetiva?: SecaoEfetiva;
  Nl?: number;
  origemNl?: 'Tabela 10' | 'faixas finitas';
  distorcional: SituacaoDistorcional;
  Ndist?: number;
  lambdaDist?: number;
  chiDist?: number;
  NcRdDist: number;
  NcRd: number;
  esbeltez: number;
  verificacao: Verificacao;
}

const intermitente = (sec: SecaoGeometrica) => sec.dimensoes.familia === 'Ue2' && sec.dimensoes.solda?.tipo === 'intermitente';
const temEnrijecedorDeBorda = (sec: SecaoGeometrica) => ['Ue', 'Ze', 'Cr', 'Le'].includes(sec.dimensoes.familia) || intermitente(sec);

/**
 * Dois Ue com solda intermitente: o local e o distorcional são de CADA PERFIL
 * (nota das Tabelas 9 e 12: "kℓ deve ser calculado para cada perfil
 * isoladamente"). A seção dos elementos é a de um Ue; as resistências, vezes 2.
 */
export function secaoDoPerfil(sec: SecaoGeometrica): { sec: SecaoGeometrica; n: number } {
  return intermitente(sec) ? { sec: montarSecao({ ...sec.dimensoes, familia: 'Ue', solda: undefined }), n: 2 } : { sec, n: 1 };
}

/** Caso da Tabela 9/10 e o η, com as dimensões nominais da figura. */
function casoDaTabela10(sec: SecaoGeometrica): { caso: 'a' | 'b' | 'd'; eta: number; muOk: boolean } | undefined {
  const d = sec.dimensoes;
  const eta = d.bf / d.bw;
  // Dois Ue com solda contínua: o tubo do caso d, com a largura externa 2·bf.
  if (d.familia === 'Ue2' && d.solda?.tipo === 'continua') return { caso: 'd', eta: (2 * d.bf) / d.bw, muOk: true };
  // Com solda intermitente: cada Ue isolado, caso b.
  if (intermitente(sec)) {
    const mu = d.D / d.bw;
    return { caso: 'b', eta, muOk: mu >= 0.1 - 1e-12 && mu <= 0.3 + 1e-12 };
  }
  if (d.familia === 'U' || d.familia === 'Z') return { caso: 'a', eta, muOk: true };
  if (d.familia === 'Ue' || (d.familia === 'Ze' && (d.anguloEnrijecedor ?? 90) === 90) || d.familia === 'Cr') {
    const mu = d.D / d.bw;
    return { caso: 'b', eta, muOk: mu >= 0.1 - 1e-12 && mu <= 0.3 + 1e-12 };
  }
  return undefined;
}

export function verificarCompressao(
  sec: SecaoGeometrica,
  pr: PropriedadesDaSecao,
  aco: AcoDaVerificacao,
  L: Comprimentos,
  metodo: MetodoDoLocal,
  criticos: CriticosElasticos,
  NcSd: number,
): ResultadoCompressao {
  const fy = aco.fy;
  const A = pr.A;
  const p = principais(pr);
  const notas: string[] = [];
  const { KL1, KL2, nota } = comprimentosPrincipais(pr.alfa, L);
  const eixos = passoDosEixosPrincipais(pr, L);
  let gl = forcaGlobal(p, E, G, KL1, KL2, L.Lz);
  // ⚠️ Z COM O COMPRIMENTO MAIOR NO EIXO DE MAIOR INÉRCIA (achado A8 da
  // revisão de 01/11/2026; a norma é omissa): travada na direção x a cada
  // KyLy curto, a barra só flete em torno de x — com Ix, não com I1 (I1 > Ix).
  // π²E·I1/(KxLx)² saía até 7 % acima. Quando KyLy é o maior, os principais já
  // ficam a favor (I2 < Iy). Pergunta 3 da revisão ao José.
  const fam = sec.dimensoes.familia;
  let restrito: { I: number; KL: number; eixo: 'x' | 'y' } | undefined;
  if ((fam === 'Z' || fam === 'Ze') && gl.simetria === 'dupla' && KL1 > KL2) {
    const eixo1EmX = KL1 === L.Lx;
    const r = eixo1EmX ? { I: pr.Ix, KL: L.Lx, eixo: 'x' as const } : { I: pr.Iy, KL: L.Ly, eixo: 'y' as const };
    const Ne1r = euler(E, r.I, r.KL);
    if (Ne1r < gl.Ne1) {
      restrito = r;
      const Ne = Math.min(Ne1r, gl.Ne2, gl.Nez);
      gl = { ...gl, Ne1: Ne1r, Ne, modo: Ne === Ne1r ? 'flexao1' : Ne === gl.Ne2 ? 'flexao2' : 'torcao' };
      notas.push(`K${r.eixo}L${r.eixo} maior que o outro: flexão em torno de ${r.eixo} com I${r.eixo}, não I1 (travada na outra direção)`);
    }
  }
  const lambda0 = Math.sqrt((A * fy) / gl.Ne);
  const chi = fatorChi(lambda0);
  const passos: Passo[] = [];
  const avisos: string[] = [];
  if (nota) notas.push(nota);

  // ── Flambagem global (9.7.2.1 a 9.7.2.3) ──
  const contasGlobal: Conta[] = [
    restrito
      ? {
          simbolo: v('N', 'e1'),
          formula: fr(x('π² ', v('E'), ' ', v('I', restrito.eixo)), pot(par(x(v('K', restrito.eixo), v('L', restrito.eixo))), 2)),
          numeros: fr(x('π² · ', n(E), ' · ', n(restrito.I)), pot(n(restrito.KL), 2)),
          valor: gl.Ne1,
          unidade: 'kN',
          rotulo: `travada na outra direção: em torno de ${restrito.eixo}`,
        }
      : { simbolo: v('N', 'e1'), formula: fr(x('π² ', v('E'), ' ', v('I', '1')), pot(par(x(v('K'), v('L'))), 2)), numeros: fr(x('π² · ', n(E), ' · ', n(p.I1)), pot(n(KL1), 2)), valor: gl.Ne1, unidade: 'kN' },
    { simbolo: v('N', 'e2'), formula: fr(x('π² ', v('E'), ' ', v('I', '2')), pot(par(x(v('K'), v('L'))), 2)), numeros: fr(x('π² · ', n(E), ' · ', n(p.I2)), pot(n(KL2), 2)), valor: gl.Ne2, unidade: 'kN' },
    {
      simbolo: v('N', 'ez'),
      formula: x(fr(1, pot(v('r', '0'), 2)), ' ', par(x(fr(x('π² ', v('E'), ' ', v('C', 'w')), pot(par(x(v('K', 'z'), v('L', 'z'))), 2)), ' + ', v('G'), ' ', v('J')))),
      numeros: x(fr(1, pot(n(p.r0), 2)), ' ', par(x(fr(x('π² · ', n(E), ' · ', n(p.Cw)), pot(n(L.Lz), 2)), ' + ', n(G), ' · ', n(p.J)))),
      valor: gl.Nez,
      unidade: 'kN',
    },
  ];
  if (gl.Neacoplada !== undefined) contasGlobal.push({ simbolo: v('N', 'exz'), valor: gl.Neacoplada, unidade: 'kN', rotulo: 'flexo-torção, eixo de simetria' });
  contasGlobal.push(
    { simbolo: v('N', 'e'), valor: gl.Ne, unidade: 'kN', rotulo: { flexao1: 'flexão em 1', flexao2: 'flexão em 2', torcao: 'torção', flexotorcao: 'flexo-torção' }[gl.modo] },
    { simbolo: v('λ', '0'), formula: rz(fr(x(v('A'), ' ', v('f', 'y')), v('N', 'e'))), numeros: rz(fr(x(n(A), ' · ', n(fy)), n(gl.Ne))), valor: lambda0, casas: 3 },
    {
      simbolo: v('χ'),
      formula: lambda0 <= 1.5 ? pot(n(0.658, 3), pot(v('λ', '0'), 2)) : fr(n(0.877, 3), pot(v('λ', '0'), 2)),
      numeros: lambda0 <= 1.5 ? pot(n(0.658, 3), pot(n(lambda0, 3), 2)) : fr(n(0.877, 3), pot(n(lambda0, 3), 2)),
      valor: chi,
      casas: 3,
      rotulo: lambda0 <= 1.5 ? 'λ0 ≤ 1,5' : 'λ0 > 1,5',
    },
  );
  if (eixos) passos.push(eixos);
  passos.push({
    ref: { dupla: '9.7.2.1', mono1: '9.7.2.2', mono2: '9.7.2.2', assimetrica: '9.7.2.3' }[gl.simetria],
    titulo: 'Flambagem global por flexão, torção ou flexo-torção',
    contas: contasGlobal,
  });

  // Cantoneira: a curva das faixas não tem vale — a flambagem local das abas
  // cai direto no patamar da torção (GJ/r0²); é o mesmo modo. O MLE da norma
  // conta os dois (χ com o Nez e a aba AL reduzida), sem exceção para a
  // cantoneira na 14762:2010 — a favor da segurança. A memória diz isso.
  if ((fam === 'L' || fam === 'Le') && metodo === 'MLE') notas.push('cantoneira: a flambagem local das abas e a torção são o mesmo modo; o MLE da norma conta os dois (a favor da segurança)');

  // ── Local, pelo método escolhido ──
  // A seção desenhada vai pelo MRD (Anexo C, com as faixas finitas: o C.1
  // pressupõe a análise de estabilidade, e o MLE pediria classificar à mão
  // elemento a elemento de uma forma qualquer). O tubo dos dois Ue não passa
  // pelo MLE: a nervura dos enrijecedores soldados não é elemento das
  // Tabelas 5 e 6 — vai pelo MSE (Tabela 10, caso d) ou pelo MRD.
  let metodoUsado: MetodoDoLocal = metodo;
  if (fam === 'Desenho' && metodo !== 'MRD') {
    metodoUsado = 'MRD';
    notas.push('seção desenhada: pelo MRD, com as faixas finitas (Anexo C)');
  } else if (fam === 'Ue2' && !intermitente(sec) && metodo === 'MLE') {
    metodoUsado = 'MRD';
    notas.push('dois Ue boca com boca: o MLE não se aplica à nervura soldada; calculado pelo MRD');
  }
  let NcRdGlobal: number;
  let Aef: number | undefined;
  let efetiva: SecaoEfetiva | undefined;
  let Nl: number | undefined;
  let origemNl: ResultadoCompressao['origemNl'];
  const NlFaixas = criticos.P.pos.local?.lam;
  if (criticos.P.pos.localEmprestado) notas.push('a curva tem um só vale de ondas curtas: entra como local e como distorcional');
  if (criticos.P.pos.distorcional?.ombro) notas.push('sem vale distorcional: Ndist tomado no ombro da curva (as dobras passam a andar ≥ 0,5)');

  if (metodoUsado === 'MLE') {
    const local = secaoDoPerfil(sec);
    efetiva = secaoEfetiva(local.sec, { s0: chi * fy, gx: 0, gy: 0 }, E);
    if (local.n > 1) notas.push('solda intermitente: área efetiva de um Ue, vezes 2 (cada perfil isolado)');
    if (efetiva.foraDoCampo.length) {
      metodoUsado = 'MRD';
      notas.push(`fora do campo do MLE (${efetiva.foraDoCampo[0]}): calculado pelo MRD`);
    } else {
      Aef = secaoDoPerfil(sec).n * efetiva.props.A;
      avisos.push(...efetiva.avisos);
      NcRdGlobal = (chi * Aef * fy) / GAMA_COMPRESSAO;
      passos.push({
        ref: '9.7.2 a); 9.2.2.1; 9.2.3.1',
        titulo: 'Área efetiva pelo método da largura efetiva (σ = χ·fy)',
        contas: [
          { simbolo: v('σ'), formula: x(v('χ'), ' ', v('f', 'y')), numeros: x(n(chi, 3), ' · ', n(fy)), valor: chi * fy, unidade: 'kN/cm²' },
          ...efetiva.elementos
            .filter((el) => el.largura && !(el.largura.lambdaP <= 0))
            .map(
              (el): Conta => ({
                simbolo: x(v('b', 'ef'), ` ${el.papel}`),
                valor: el.efetivos.reduce((s, [a, b]) => s + (b - a), 0),
                unidade: 'cm',
                rotulo: `${el.largura!.caso} · b = ${el.b.toFixed(2)} · λp = ${el.largura!.lambdaP.toFixed(3)}`,
              }),
            ),
          { simbolo: v('A', 'ef'), valor: Aef, unidade: 'cm²' },
          { simbolo: v('N', 'c,Rd'), formula: fr(x(v('χ'), ' ', v('A', 'ef'), ' ', v('f', 'y')), v('γ')), numeros: fr(x(n(chi, 3), ' · ', n(Aef), ' · ', n(fy)), n(GAMA_COMPRESSAO, 2)), valor: NcRdGlobal, unidade: 'kN' },
        ],
      });
    }
  }

  if (metodoUsado === 'MSE') {
    const caso = casoDaTabela10(sec);
    const kl = caso && caso.muOk ? klCompressao(caso.caso, caso.eta) : undefined;
    const bwt = sec.dimensoes.bw / sec.dimensoes.t;
    if (kl !== undefined) {
      Nl = ((kl * Math.PI ** 2 * E) / (12 * (1 - NU ** 2) * bwt ** 2)) * A;
      origemNl = 'Tabela 10';
    } else {
      Nl = NlFaixas;
      origemNl = 'faixas finitas';
    }
    if (Nl === undefined) {
      Aef = A;
      notas.push('sem vale local na curva de assinatura (C.2): área bruta');
    } else {
      const lp = Math.sqrt((chi * A * fy) / Nl);
      Aef = A * fatorLocal(lp);
      const contas: Conta[] = [];
      if (origemNl === 'Tabela 10') {
        contas.push(
          { simbolo: v('η'), formula: fr(v('b', 'f'), v('b', 'w')), numeros: fr(n(sec.dimensoes.bf), n(sec.dimensoes.bw)), valor: caso!.eta, casas: 3 },
          { simbolo: v('k', 'ℓ'), valor: kl!, casas: 2, rotulo: `Tabela 10, caso ${caso!.caso}` },
          { simbolo: v('N', 'ℓ'), formula: x(v('k', 'ℓ'), ' ', fr(x('π² ', v('E')), x('12 ', par(x('1 − ', pot(v('ν'), 2))), ' ', pot(par(x(v('b', 'w'), '/', v('t'))), 2))), ' ', v('A')), valor: Nl, unidade: 'kN' },
        );
      } else {
        contas.push({ simbolo: v('N', 'ℓ'), valor: Nl, unidade: 'kN', rotulo: 'faixas finitas (perfil fora da Tabela 10)' });
      }
      contas.push(
        { simbolo: v('λ', 'p'), formula: rz(fr(x(v('χ'), ' ', v('A'), ' ', v('f', 'y')), v('N', 'ℓ'))), numeros: rz(fr(x(n(chi, 3), ' · ', n(A), ' · ', n(fy)), n(Nl))), valor: lp, casas: 3 },
        {
          simbolo: v('A', 'ef'),
          formula: lp <= 0.776 ? v('A') : x(v('A'), ' ', par(x('1 − ', fr(n(0.15, 2), pot(v('λ', 'p'), n(0.8, 1))))), ' ', fr(1, pot(v('λ', 'p'), n(0.8, 1)))),
          valor: Aef,
          unidade: 'cm²',
          rotulo: lp <= 0.776 ? 'λp ≤ 0,776' : 'λp > 0,776',
        },
      );
      passos.push({ ref: '9.7.2 b)', titulo: 'Área efetiva pelo método da seção efetiva', contas });
    }
    NcRdGlobal = (chi * Aef * fy) / GAMA_COMPRESSAO;
    passos.push({
      ref: '9.7.2',
      titulo: 'Global com local',
      contas: [{ simbolo: v('N', 'c,Rd'), formula: fr(x(v('χ'), ' ', v('A', 'ef'), ' ', v('f', 'y')), v('γ')), numeros: fr(x(n(chi, 3), ' · ', n(Aef), ' · ', n(fy)), n(GAMA_COMPRESSAO, 2)), valor: NcRdGlobal, unidade: 'kN' }],
    });
  }

  if (metodoUsado === 'MRD') {
    const NcRe = chi * A * fy;
    Nl = NlFaixas;
    origemNl = 'faixas finitas';
    const contas: Conta[] = [{ simbolo: v('N', 'c,Re'), formula: x(v('χ'), ' ', v('A'), ' ', v('f', 'y')), numeros: x(n(chi, 3), ' · ', n(A), ' · ', n(fy)), valor: NcRe, unidade: 'kN' }];
    let NcRl = NcRe;
    if (Nl === undefined) notas.push('sem vale local na curva de assinatura (C.2): local não considerado');
    else {
      const ll = Math.sqrt(NcRe / Nl);
      NcRl = NcRe * fatorLocal(ll);
      contas.push(
        { simbolo: v('N', 'ℓ'), valor: Nl, unidade: 'kN', rotulo: 'faixas finitas' },
        { simbolo: v('λ', 'ℓ'), formula: rz(fr(v('N', 'c,Re'), v('N', 'ℓ'))), numeros: rz(fr(n(NcRe), n(Nl))), valor: ll, casas: 3 },
        {
          simbolo: v('N', 'c,Rℓ'),
          formula: ll <= 0.776 ? v('N', 'c,Re') : x(par(x('1 − ', fr(n(0.15, 2), pot(v('λ', 'ℓ'), n(0.8, 1))))), ' ', fr(v('N', 'c,Re'), pot(v('λ', 'ℓ'), n(0.8, 1)))),
          valor: NcRl,
          unidade: 'kN',
          rotulo: ll <= 0.776 ? 'λℓ ≤ 0,776' : 'λℓ > 0,776',
        },
      );
    }
    NcRdGlobal = Math.min(NcRe, NcRl) / GAMA_COMPRESSAO;
    contas.push({ simbolo: v('N', 'c,Rd'), formula: fr(x('mín', par(x(v('N', 'c,Re'), '; ', v('N', 'c,Rℓ')))), v('γ')), valor: NcRdGlobal, unidade: 'kN' });
    passos.push({ ref: 'C.3.1; C.3.2', titulo: 'Global e local pelo método da resistência direta', contas });
  }

  // ── Distorcional (9.7.3 / C.3.3) ──
  let distorcional: SituacaoDistorcional = 'calculado';
  let Ndist: number | undefined;
  let lambdaDist: number | undefined;
  let chiDist: number | undefined;
  let NcRdDist = Infinity;
  const d = sec.dimensoes;
  // O tubo dos dois Ue: só o vale de onda longa das faixas (a mesa com a
  // nervura), se houver — ver o mesmo comentário em flexao.ts.
  const dCurva = criticos.P.pos.distorcional;
  const valeDoTubo = sec.dimensoes.familia === 'Ue2' && !intermitente(sec) && dCurva !== undefined && !dCurva.ombro && !criticos.P.pos.localEmprestado;
  if (!temEnrijecedorDeBorda(sec) && !valeDoTubo) {
    distorcional = 'nao-se-aplica';
    passos.push({ ref: '9.3', titulo: 'Flambagem distorcional', contas: [{ simbolo: v('N', 'dist'), texto: 'não se aplica: perfil sem enrijecedor de borda' }] });
  } else {
    // ⚠️ SÓ COM O ENRIJECEDOR A 90°: as Tabelas 11 e 14 remetem às figuras da
    // Tabela 9, que mostram o enrijecedor reto. O Ze 45° era dispensado e
    // saía até 12 % acima (achado A4 da revisão de 01/11/2026).
    const reto = (d.anguloEnrijecedor ?? 90) === 90;
    const minimo = (d.familia === 'Ue' || d.familia === 'Ze' || intermitente(sec)) && reto ? dispensaDistorcional(11, d.bf / d.bw, d.bw / d.t) : undefined;
    if (metodoUsado !== 'MRD' && minimo !== undefined && d.D / d.bw >= minimo) {
      distorcional = 'dispensado';
      passos.push({
        ref: '9.7.3; Tabela 11',
        titulo: 'Flambagem distorcional',
        contas: [{ simbolo: fr(v('D'), v('b', 'w')), numeros: fr(n(d.D), n(d.bw)), valor: d.D / d.bw, casas: 3, rotulo: `≥ ${minimo.toFixed(3)} → dispensada` }],
      });
    } else {
      Ndist = criticos.P.pos.distorcional?.lam;
      if (Ndist === undefined) {
        distorcional = 'sem-vale';
        passos.push({ ref: 'C.2', titulo: 'Flambagem distorcional', contas: [{ simbolo: v('N', 'dist'), texto: 'a curva de assinatura não tem vale distorcional: não considerada' }] });
      } else {
        lambdaDist = Math.sqrt((A * fy) / Ndist);
        chiDist = fatorChiDistCompressao(lambdaDist);
        NcRdDist = (chiDist * A * fy) / GAMA_COMPRESSAO;
        passos.push({
          ref: metodoUsado === 'MRD' ? 'C.3.3' : '9.7.3',
          titulo: 'Flambagem distorcional',
          contas: [
            { simbolo: v('N', 'dist'), valor: Ndist, unidade: 'kN', rotulo: criticos.P.pos.distorcional!.ombro ? `faixas finitas, ombro da curva (sem vale), L = ${criticos.P.pos.distorcional!.L.toFixed(1)} cm` : `faixas finitas, L = ${criticos.P.pos.distorcional!.L.toFixed(1)} cm` },
            { simbolo: v('λ', 'dist'), formula: rz(fr(x(v('A'), ' ', v('f', 'y')), v('N', 'dist'))), numeros: rz(fr(x(n(A), ' · ', n(fy)), n(Ndist))), valor: lambdaDist, casas: 3 },
            {
              simbolo: v('χ', 'dist'),
              formula: lambdaDist <= 0.561 ? n(1) : x(par(x('1 − ', fr(n(0.25, 2), pot(v('λ', 'dist'), n(1.2, 1))))), ' ', fr(1, pot(v('λ', 'dist'), n(1.2, 1)))),
              valor: chiDist,
              casas: 3,
              rotulo: lambdaDist <= 0.561 ? 'λdist ≤ 0,561' : 'λdist > 0,561',
            },
            { simbolo: v('N', 'c,Rd,dist'), formula: fr(x(v('χ', 'dist'), ' ', v('A'), ' ', v('f', 'y')), v('γ')), numeros: fr(x(n(chiDist, 3), ' · ', n(A), ' · ', n(fy)), n(GAMA_COMPRESSAO, 2)), valor: NcRdDist, unidade: 'kN' },
          ],
        });
      }
    }
  }

  // ── Resultado e esbeltez (9.7.4) ──
  const NcRd = Math.min(NcRdGlobal!, NcRdDist);
  const r1 = Math.sqrt(p.I1 / A);
  const r2 = Math.sqrt(p.I2 / A);
  const esbeltez = Math.max(KL1 > 0 ? KL1 / r1 : 0, KL2 > 0 ? KL2 / r2 : 0);
  if (esbeltez > 200) avisos.push(`KL/r = ${esbeltez.toFixed(0)} > 200 (9.7.4)`);
  const razao = NcSd > 0 ? NcSd / NcRd : 0;
  const governa = NcRdDist < NcRdGlobal! ? 'distorcional' : metodoUsado === 'MRD' ? 'global e local (MRD)' : 'global e local';
  return {
    NcSd,
    global: gl,
    KL1,
    KL2,
    lambda0,
    chi,
    metodo,
    metodoUsado,
    NcRdGlobal: NcRdGlobal!,
    Aef,
    efetiva,
    Nl,
    origemNl,
    distorcional,
    Ndist,
    lambdaDist,
    chiDist,
    NcRdDist,
    NcRd,
    esbeltez,
    verificacao: {
      chave: 'compressao',
      titulo: 'Compressão',
      item: metodoUsado === 'MRD' ? 'C.3' : '9.7',
      sd: NcSd,
      rd: NcRd,
      unidade: 'kN',
      razao,
      situacao: situacaoPelaRazao(razao, avisos),
      governa,
      passos,
      avisos,
      notas,
    },
  };
}
