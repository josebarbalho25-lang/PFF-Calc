// ═══════════════════════════════════════════════════════════════════════════
//  motor/faixas/criticos.ts — os esforços críticos elásticos que a norma pede
//  (Nℓ, Ndist, Mℓ, Mdist), tirados da curva de assinatura da seção
// ---------------------------------------------------------------------------
//  Para cada caso de carga de referência (compressão, Mx, My) roda a curva,
//  acha os mínimos, classifica cada um pela forma do modo (`modos.ts`) e
//  escolhe: o crítico local é o menor mínimo local; o distorcional, o menor
//  mínimo distorcional. É a leitura da norma: "valores críticos (valores
//  mínimos)" da análise de estabilidade elástica (C.1).
//
//  ⚠️ QUANDO FALTA UM DOS DOIS (revisão de 01/11/2026):
//  - sem mínimo local, mas com o distorcional: o único vale de ondas curtas
//    entra como os dois. Na beira do limite de 0,35 das dobras ele mudava de
//    nome com 1 mm de enrijecedor, e o local sumia da conta (achado B4).
//  - sem vale distorcional num perfil com enrijecedor de borda: o crítico é
//    tomado no OMBRO da curva — o primeiro ponto, depois do vale local, em
//    que as dobras andam ≥ 0,5 (o modo já é nitidamente distorcional), achado
//    por bissecção. A barra apresenta o modo; só não faz vale (achado A6, a
//    pergunta 8 ao José). Sem trecho distorcional nenhum, fica sem: aí a
//    barra não apresenta o modo (C.2).
//
//  ⚠️ O SENTIDO DO MOMENTO IMPORTA. Mx e My aqui são os de F6 (Mx = ∫σ·y dA
//  com tração positiva): "pos" é o momento que traciona o lado y > 0 (Mx) ou
//  x > 0 (My); "neg", o contrário. Quem traduz para o sinal da calculadora é
//  o motor da norma.
// ═══════════════════════════════════════════════════════════════════════════

import { montarSecao } from '../secao/familias';
import type { SecaoGeometrica } from '../secao/tipos';
import { curvaDeAssinatura, type Minimo } from './assinatura';
import { malhaDaSecao, propriedadesDaMalha, tensoesDeReferencia, type EsforcoDeReferencia, type Malha, type OpcoesDaMalha } from './malha';
import { medirModo, type MedidasDoModo } from './modos';
import { MotorDeFaixas } from './motor';

export type ModoDeFlambagem = 'local' | 'distorcional' | 'global';

export interface MinimoClassificado extends Minimo {
  modo: ModoDeFlambagem;
  medidas: MedidasDoModo;
  /** Deslocamentos nodais do modo, para o desenho. */
  deslocamentos: Float64Array;
  /** Não é vale: o ponto do ombro, tomado quando o distorcional não faz vale. */
  ombro?: boolean;
}

export interface CriticosDoSentido {
  lam: number[];
  minimos: MinimoClassificado[];
  local?: MinimoClassificado;
  distorcional?: MinimoClassificado;
  /** O local é o vale distorcional emprestado (não havia vale local). */
  localEmprestado?: boolean;
}

export interface CriticosDoCaso {
  L: number[];
  /** As tensões de referência do caso: o modo em qualquer L da curva sai delas (o 3D da janela). */
  tensoes: Float64Array;
  pos: CriticosDoSentido;
  neg: CriticosDoSentido;
  avisos: string[];
}

export interface CriticosElasticos {
  malha: Malha;
  P: CriticosDoCaso;
  Mx: CriticosDoCaso;
  My: CriticosDoCaso;
}

/**
 * Limites da classificação pela forma do modo, calibrados em 01/11/2026 num
 * lote de 530 perfis do catálogo, contra os rótulos de Pierin et al.: nos
 * mínimos que Pierin rotula, as dobras andam até 10 % (p95) nos locais e no
 * mínimo 70 % (p5) nos distorcionais. Qualquer limite entre 0,22 e 0,5 dá o
 * mesmo resultado (98,4 % iguais a Pierin; o resto é casamento ambíguo por
 * valor); 0,35 é o meio do patamar.
 *
 * ⚠️ O cFSM do pyCUFSM 0.2.0 seria o juiz natural, mas está quebrado nesta
 * versão (oraculos/scripts/loteCfsm.py, cabeçalho) — não usar.
 */
export const LIMITES = { dobrasLocal: 0.35, deformacaoGlobal: 0.15 };

export function classificar(m: MedidasDoModo): ModoDeFlambagem {
  if (m.dobras < LIMITES.dobrasLocal) return 'local';
  if (m.deformacao < LIMITES.deformacaoGlobal) return 'global';
  return 'distorcional';
}

/** Dobras a partir das quais o ponto do ombro conta como distorcional. */
export const DOBRAS_DO_OMBRO = 0.5;

/**
 * O ombro distorcional: o primeiro ponto da curva, depois de `desde`, em que
 * as dobras andam ≥ 0,5; refinado por bissecção no log de L. Para se o modo
 * virar global antes.
 */
function ombroDistorcional(motor: MotorDeFaixas, malha: Malha, L: number[], s: 1 | -1, desde: number): MinimoClassificado | undefined {
  const medir = (Lx: number) => {
    const modo = motor.modos(Lx, s, 1)[0];
    return modo ? { modo, medidas: medirModo(malha, modo) } : undefined;
  };
  for (let i = 1; i < L.length; i++) {
    if (L[i] <= desde) continue;
    const m = medir(L[i]);
    if (!m) return undefined;
    if (classificar(m.medidas) === 'global') return undefined;
    if (m.medidas.dobras < DOBRAS_DO_OMBRO) continue;
    let lo = Math.log(Math.max(L[i - 1], desde));
    let hi = Math.log(L[i]);
    let melhor = { L: L[i], ...m };
    for (let k = 0; k < 14; k++) {
      const meio = 0.5 * (lo + hi);
      const q = medir(Math.exp(meio));
      if (q && q.medidas.dobras >= DOBRAS_DO_OMBRO) {
        hi = meio;
        melhor = { L: Math.exp(meio), ...q };
      } else lo = meio;
    }
    return { L: melhor.L, lam: melhor.modo.lam, modo: 'distorcional', medidas: melhor.medidas, deslocamentos: melhor.modo.deslocamentos, ombro: true };
  }
  return undefined;
}

function sentido(motor: MotorDeFaixas, malha: Malha, L: number[], lam: number[], minimos: Minimo[], s: 1 | -1, comEnrijecedor: boolean): CriticosDoSentido {
  const classificados = minimos.map((mn) => {
    const modo = motor.modos(mn.L, s, 1)[0];
    const medidas = medirModo(malha, modo);
    return { ...mn, modo: classificar(medidas), medidas, deslocamentos: modo.deslocamentos };
  });
  const menor = (qual: ModoDeFlambagem) =>
    classificados.filter((m) => m.modo === qual).reduce<MinimoClassificado | undefined>((a, b) => (!a || b.lam < a.lam ? b : a), undefined);
  let local = menor('local');
  let distorcional = menor('distorcional');
  let localEmprestado = false;
  if (!local && distorcional) {
    local = distorcional;
    localEmprestado = true;
  }
  let ombro: MinimoClassificado | undefined;
  if (!distorcional && comEnrijecedor) {
    ombro = ombroDistorcional(motor, malha, L, s, local?.L ?? 0);
    distorcional = ombro;
  }
  return { lam, minimos: ombro ? [...classificados, ombro] : classificados, local, distorcional, localEmprestado };
}

export interface OpcoesDosCriticos extends OpcoesDaMalha {
  /** Pontos da curva (padrão 100, F7). */
  n?: number;
}

export function criticosElasticos(sec: SecaoGeometrica, op: OpcoesDosCriticos = {}): CriticosElasticos {
  const d = sec.dimensoes;
  if (d.familia === 'Ue2' && d.solda?.tipo === 'intermitente') return criticosDaComposta(sec, op);
  if (d.familia === 'Ue2') return criticosDoTubo(sec, op);
  return curvas(sec, op, { P: { P: 1 }, Mx: { Mx: 1 }, My: { My: 1 } });
}

/** A, Ix e Iy dos dois Ue reais, pela malha de um Ue (a mesma discretização das faixas). */
function conjuntoDeDoisUe(sec: SecaoGeometrica, op: OpcoesDosCriticos) {
  const d = sec.dimensoes;
  const um = montarSecao({ ...d, familia: 'Ue', solda: undefined });
  const pm = propriedadesDaMalha(malhaDaSecao(um, op));
  const dist = (d.bf / 10 - um.t / 2) - pm.xc; // do plano do encontro (centroide do conjunto) ao centroide do Ue
  return { um, pm, dist, A: 2 * pm.A, Ix: 2 * pm.Ixx, Iy: 2 * (pm.Iyy + pm.A * dist * dist) };
}

/**
 * Dois Ue com SOLDA CONTÍNUA: as faixas rodam no tubo, mas a malha do tubo tem
 * ~1 % de aço a mais que os dois Ue (o canto vivo do encontro, ver
 * `secao/composta.ts`). A tensão crítica é a do tubo; o esforço é o da seção
 * real. O esforço de referência põe na malha a tensão que N = 1 (Mx = 1,
 * My = 1) põe nos dois Ue — e o autovalor já sai no esforço da seção real.
 */
function criticosDoTubo(sec: SecaoGeometrica, op: OpcoesDosCriticos): CriticosElasticos {
  const tubo = propriedadesDaMalha(malhaDaSecao(sec, op));
  const real = conjuntoDeDoisUe(sec, op);
  return curvas(sec, op, { P: { P: tubo.A / real.A }, Mx: { Mx: tubo.Ixx / real.Ix }, My: { My: tubo.Iyy / real.Iy } });
}

/**
 * Dois Ue boca com boca com SOLDA INTERMITENTE: o kℓ "calculado para cada
 * perfil isoladamente" (nota das Tabelas 9 e 12 da norma). As faixas rodam no
 * Ue sozinho, com as tensões que o conjunto põe nele — por unidade de esforço
 * do CONJUNTO, para o autovalor já sair no esforço da barra composta:
 * - N do conjunto = 1: cada Ue leva A/Ac = 1/2;
 * - Mx do conjunto = 1: cada Ue leva Ix/Ix,c = 1/2 (centroides na mesma altura);
 * - My do conjunto = 1: no Ue comprimido, uma força A·d/Iy,c (d = do centroide
 *   do conjunto ao do Ue) mais um momento Iy/Iy,c que comprime o lado da alma.
 *   Os dois sentidos são o mesmo, por simetria — o Ue que comprime troca.
 */
function criticosDaComposta(sec: SecaoGeometrica, op: OpcoesDosCriticos): CriticosElasticos {
  const { um, pm, dist, Ix: Ixc, Iy: Iyc } = conjuntoDeDoisUe(sec, op);
  const c = curvas(um, op, { P: { P: 0.5 }, Mx: { Mx: pm.Ixx / Ixc }, My: { P: (pm.A * dist) / Iyc, My: pm.Iyy / Iyc } });
  return { ...c, My: { ...c.My, neg: c.My.pos } };
}

function curvas(sec: SecaoGeometrica, op: OpcoesDosCriticos, refs: { P: EsforcoDeReferencia; Mx: EsforcoDeReferencia; My: EsforcoDeReferencia }): CriticosElasticos {
  const malha = malhaDaSecao(sec, op);
  const comEnrijecedor = ['Ue', 'Ze', 'Cr', 'Le'].includes(sec.dimensoes.familia) || temEnrijecedorDesenhado(sec);
  // Varredura da especificação: de meio menor elemento plano a 100 vezes a
  // maior dimensão da seção.
  // Só os elementos com b ≥ t: uma parte plana de décimos de milímetro (D
  // quase todo na dobra) dava um "mínimo" espúrio em L ≈ 0,02 cm, com Nℓ de
  // dezenas de milhares de kN, que ia à tela e à memória (achado B5).
  const planos = sec.elementos.filter((e) => e.b >= sec.t);
  const Lmin = 0.5 * Math.min(...(planos.length ? planos : sec.elementos).map((e) => e.b));
  const xs = malha.nos.map((p) => p.x);
  const ys = malha.nos.map((p) => p.y);
  const Lmax = 100 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  // ⚠️ FLEXÃO RESTRITA (σ = M·y/Ix), nos eixos x e y do desenho — os da alma.
  // No U, no Ue e na cartola dá o mesmo que a livre (Ixy = 0). No Z e na
  // cantoneira é a escolha que vale: as Tabelas 12 e 13 da norma dão o mesmo
  // kℓ para U e Z, o que só fecha com as mesmas tensões nas chapas; e é o
  // modelo das tabelas de Pierin et al. (2013), conferido no Ze contra elas.
  // Com a flexão livre o Mℓ do Z cai pela
  // metade e o vale distorcional some — a instabilidade lateral do Z solto é
  // do Me (9.8.2.2, o fator 0,5), não da seção.
  const caso = (f: EsforcoDeReferencia): CriticosDoCaso => {
    const sig = tensoesDeReferencia(malha, f, true);
    const motor = new MotorDeFaixas(malha, sig);
    const a = curvaDeAssinatura(malha, sig, { Lmin, Lmax, n: op.n ?? 100 });
    return {
      L: a.L,
      tensoes: sig,
      pos: sentido(motor, malha, a.L, a.lamPos, a.minimosPos, 1, comEnrijecedor),
      neg: sentido(motor, malha, a.L, a.lamNeg, a.minimosNeg, -1, comEnrijecedor),
      avisos: a.avisos,
    };
  };
  return { malha, P: caso(refs.P), Mx: caso(refs.Mx), My: caso(refs.My) };
}

/** Seção desenhada aberta com enrijecedor de borda (AL preso por dobra a um AA): o ombro distorcional vale. */
function temEnrijecedorDesenhado(sec: SecaoGeometrica): boolean {
  return sec.dimensoes.familia === 'Desenho' && sec.elementos.some((e) => e.papel === 'enrijecedor');
}
