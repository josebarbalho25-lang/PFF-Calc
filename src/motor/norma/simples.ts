// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/simples.ts — tração (9.6), força cortante (9.8.3), momento
//  com cortante (9.8.4) e flexão composta (9.9)
// ---------------------------------------------------------------------------
//  As verificações curtas, juntas num arquivo: cada uma é uma ou duas
//  fórmulas da norma, sem iteração.
// ═══════════════════════════════════════════════════════════════════════════

import type { PropriedadesDaSecao } from '../secao/propriedades';
import type { SecaoGeometrica, TrechoReto } from '../secao/tipos';
import { comprimentosPrincipais, E } from './compressao';
import { principais } from './global';
import { fr, n, par, pot, rz, situacaoPelaRazao, v, x, type Conta, type Verificacao } from './memoria';
import type { AcoDaVerificacao, Comprimentos } from './tipos';

export const GAMA_TRACAO = 1.1;
export const GAMA_CORTANTE = 1.1;
/** Coeficiente de flambagem da chapa com uma borda livre (Tabela 6): o limite do escoamento da aba no cortante. */
const KV_ABA = 0.43;

// ── Tração (9.6.2 a; 9.6.3) ─────────────────────────────────────────────────

export interface ResultadoTracao {
  NtSd: number;
  /** O menor de a) e b), o que entra no 9.9. */
  NtRd: number;
  NtRdEscoamento: number;
  NtRdRuptura: number;
  /** Teto de c): Ct·An·fu/1,65 ≤ A·fu/1,65, qualquer que seja a ligação. */
  NtRdTetoLigacao: number;
  esbeltez: number;
  verificacao: Verificacao;
}

const GAMA_RUPTURA = 1.35;
const GAMA_LIGACAO = 1.65;

/**
 * 9.6.2: o menor de a) escoamento da seção bruta, b) ruptura da seção
 * líquida fora da ligação e c) ruptura na região da ligação.
 *
 * ⚠️ b) NÃO DEPENDE DA LIGAÇÃO quando a barra não tem furo fora dela: An0 = A.
 * Antes (revisão de 01/11/2026) só o a) entrava, e nos aços com fu/fy < 1,227
 * (ZAR 400, ZAR 320, Q-45) o b) governa — o ZAR 400 saía 8 % acima.
 *
 * c) pede Ct e An, que são da ligação. Mas Ct ≤ 1 e An ≤ A: c) nunca passa de
 * A·fu/1,65. Acima desse teto nenhuma ligação passa — "não atende". Abaixo,
 * a memória diz o Ct·An que a ligação tem de dar (recomendação do juiz da
 * revisão; pergunta ao José).
 */
export function verificarTracao(pr: PropriedadesDaSecao, aco: AcoDaVerificacao, L: Comprimentos, NtSd: number): ResultadoTracao {
  const NtRdEscoamento = (pr.A * aco.fy) / GAMA_TRACAO;
  const NtRdRuptura = (pr.A * aco.fu) / GAMA_RUPTURA;
  const NtRdTetoLigacao = (pr.A * aco.fu) / GAMA_LIGACAO;
  const NtRd = Math.min(NtRdEscoamento, NtRdRuptura);
  const p = principais(pr);
  const { KL1, KL2 } = comprimentosPrincipais(pr.alfa, L);
  const esbeltez = Math.max(KL1 > 0 ? KL1 / Math.sqrt(p.I1 / pr.A) : 0, KL2 > 0 ? KL2 / Math.sqrt(p.I2 / pr.A) : 0);
  const avisos = esbeltez > 300 && NtSd > 0 ? [`L/r = ${esbeltez.toFixed(0)} > 300 (9.6.3, recomendação)`] : [];
  const notas = ['9.6.2 b) com An0 = A: sem furos fora da ligação'];
  const razaoAB = NtSd > 0 ? NtSd / NtRd : 0;
  const razaoC = NtSd > 0 ? NtSd / NtRdTetoLigacao : 0;
  const passaDoTeto = razaoC > 1;
  const razao = passaDoTeto ? Math.max(razaoAB, razaoC) : razaoAB;
  const CtAnMinimo = (NtSd * GAMA_LIGACAO) / aco.fu;
  if (NtSd > 0 && !passaDoTeto) notas.push(`9.6.2 c) depende da ligação: ela tem de dar Ct·An ≥ ${CtAnMinimo.toFixed(2).replace('.', ',')} cm²`);
  const governa = passaDoTeto ? 'ruptura na ligação: nenhuma passa' : NtRdRuptura < NtRdEscoamento ? 'ruptura da seção líquida' : 'escoamento da seção bruta';
  const contaCtAn: Conta[] =
    NtSd > 0 && !passaDoTeto
      ? [{ simbolo: x(v('C', 't'), ' ', v('A', 'n')), formula: fr(x(v('N', 't,Sd'), ' ', v('γ')), v('f', 'u')), numeros: fr(x(n(NtSd), ' · ', n(GAMA_LIGACAO, 2)), n(aco.fu)), valor: CtAnMinimo, unidade: 'cm²', rotulo: 'mínimo que a ligação tem de dar' }]
      : [];
  return {
    NtSd,
    NtRd,
    NtRdEscoamento,
    NtRdRuptura,
    NtRdTetoLigacao,
    esbeltez,
    verificacao: {
      chave: 'tracao',
      titulo: 'Tração',
      item: '9.6.2',
      sd: NtSd,
      rd: passaDoTeto ? NtRdTetoLigacao : NtRd,
      unidade: 'kN',
      razao,
      situacao: situacaoPelaRazao(razao, avisos),
      governa,
      passos: [
        {
          ref: '9.6.2 a)',
          titulo: 'Escoamento da seção bruta',
          contas: [{ simbolo: v('N', 't,Rd'), formula: fr(x(v('A'), ' ', v('f', 'y')), v('γ')), numeros: fr(x(n(pr.A), ' · ', n(aco.fy)), n(GAMA_TRACAO, 2)), valor: NtRdEscoamento, unidade: 'kN' }],
        },
        {
          ref: '9.6.2 b)',
          titulo: 'Ruptura da seção líquida fora da ligação',
          contas: [{ simbolo: v('N', 't,Rd'), formula: fr(x(v('A', 'n0'), ' ', v('f', 'u')), v('γ')), numeros: fr(x(n(pr.A), ' · ', n(aco.fu)), n(GAMA_RUPTURA, 2)), valor: NtRdRuptura, unidade: 'kN', rotulo: 'An0 = A, sem furos' }],
        },
        {
          ref: '9.6.2 c)',
          titulo: 'Ruptura da seção líquida na região da ligação',
          contas: [
            { simbolo: x(v('N', 't,Rd'), ' ≤'), formula: fr(x(v('A'), ' ', v('f', 'u')), v('γ')), numeros: fr(x(n(pr.A), ' · ', n(aco.fu)), n(GAMA_LIGACAO, 2)), valor: NtRdTetoLigacao, unidade: 'kN', rotulo: 'Ct ≤ 1 e An ≤ A: teto para qualquer ligação' },
            ...contaCtAn,
          ],
        },
        { ref: '9.6.3', titulo: 'Esbeltez', contas: [{ simbolo: x(v('L'), '/', v('r')), valor: esbeltez, casas: 0, rotulo: 'recomendado ≤ 300' }] },
      ],
      avisos,
      notas,
    },
  };
}

// ── Força cortante (9.8.3) ──────────────────────────────────────────────────

export interface AlmaNoCortante {
  papel: string;
  h: number;
  t: number;
  kv: number;
  ht: number;
  faixa: 1 | 2 | 3;
  VRd: number;
  /** kv com o enrijecedor transversal (a/h dentro de 9.5.2). */
  enrijecida: boolean;
}

export interface ResultadoCortante {
  direcao: 'x' | 'y';
  VSd: number;
  almas: AlmaNoCortante[];
  VRd: number;
  verificacao: Verificacao;
}

/** VRd de uma alma (9.8.3), com h = a parte plana. */
export function cortanteDaAlma(h: number, t: number, fy: number, kv: number): Omit<AlmaNoCortante, 'papel' | 'enrijecida'> {
  const ht = h / t;
  const l1 = 1.08 * Math.sqrt((E * kv) / fy);
  const l2 = 1.4 * Math.sqrt((E * kv) / fy);
  let VRk: number;
  let faixa: 1 | 2 | 3;
  if (ht <= l1) {
    VRk = 0.6 * fy * h * t;
    faixa = 1;
  } else if (ht <= l2) {
    VRk = 0.65 * t ** 2 * Math.sqrt(kv * fy * E);
    faixa = 2;
  } else {
    VRk = (0.905 * E * kv * t ** 3) / h;
    faixa = 3;
  }
  return { h, t, kv, ht, faixa, VRd: VRk / GAMA_CORTANTE };
}

/**
 * Os elementos que resistem ao cortante numa direção: os paralelos a ela,
 * presos nas duas bordas ("cada alma deve ser analisada como um elemento
 * separado", 9.8.3). Elemento com borda livre não entra: 9.8.3 é de alma.
 */
/** `nPerfis`: dois Ue com solda intermitente — as almas de um Ue, vezes 2. */
export function verificarCortante(sec: SecaoGeometrica, aco: AcoDaVerificacao, a: number, direcao: 'x' | 'y', VSd: number, nPerfis = 1): ResultadoCortante {
  const avisos: string[] = [];
  const notas: string[] = [];
  const almas: AlmaNoCortante[] = [];
  for (const el of sec.elementos) {
    const r = sec.trechos[el.trecho] as TrechoReto;
    const L = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
    const paralelo = Math.abs((direcao === 'x' ? r.b.x - r.a.x : r.b.y - r.a.y) / L) > 0.999;
    if (!paralelo) continue;
    if (el.bordas.some((b) => b.tipo === 'livre')) {
      // ⚠️ A ABA DA CANTONEIRA ENTRA COMO ALMA SÓ NO ESCOAMENTO (decisão dele,
      // 01/11/2026, pergunta 12): VRd = 0,6·fy·h·t/γ, sem kv. O limite da faixa
      // de escoamento é o de 9.8.3 com kv = 0,43 — o coeficiente da norma para
      // chapa com uma borda livre (Tabela 6); o de cisalhamento dessa chapa é
      // maior, então o limite fica a favor. O DimPerfil usa kv = 5 (alma presa
      // nas duas bordas): aceitaria aba de h/t até 58 em ZAR 345, que flamba
      // por cisalhamento muito antes de escoar.
      const h = el.b;
      if (sec.dimensoes.familia === 'L') {
        const lim = 1.08 * Math.sqrt((E * KV_ABA) / aco.fy);
        if (h / sec.t <= lim) {
          almas.push({ papel: el.papel, enrijecida: false, ...cortanteDaAlma(h, sec.t, aco.fy, KV_ABA) });
          notas.push(`aba da cantoneira como alma, no escoamento: h/t ≤ ${lim.toFixed(1).replace('.', ',')} (kv = 0,43 da borda livre)`);
          continue;
        }
        notas.push(`aba da cantoneira com h/t = ${(h / sec.t).toFixed(1).replace('.', ',')} acima de ${lim.toFixed(1).replace('.', ',')}: fora do escoamento, não entra no cortante`);
        continue;
      }
      notas.push(`${el.papel} com borda livre não entra no cortante em ${direcao} (9.8.3 é de alma)`);
      continue;
    }
    // Enrijecedor transversal é da alma, no cortante paralelo a ela (Vy).
    // ⚠️ SÓ CONTA SE ATENDER 9.5.2: a/h ≤ 3 E a/h ≤ [260/(h/t)]². Antes
    // (revisão de 01/11/2026) só o 3 era conferido, e a alma esbelta ganhava
    // até 24 % de kv que a norma não dá.
    const h = el.b;
    const ht = h / sec.t;
    const limite = Math.min(3, (260 / ht) ** 2);
    const enrijecida = direcao === 'y' && a > 0 && a / h <= limite;
    if (direcao === 'y' && a > 0) {
      if (enrijecida) notas.push(`enrijecedor transversal: conferir Is ≥ Is,mín (9.5.2)`);
      else notas.push(`a/h = ${(a / h).toFixed(2).replace('.', ',')} acima do limite de 9.5.2 (${limite.toFixed(2).replace('.', ',')}): kv = 5, sem enrijecedor`);
    }
    const kv = enrijecida ? 5 + 5 / (a / h) ** 2 : 5;
    almas.push({ papel: el.papel, enrijecida, ...cortanteDaAlma(h, sec.t, aco.fy, kv) });
  }
  const VRd = nPerfis * almas.reduce((s, al) => s + al.VRd, 0);
  if (!almas.length) (VSd !== 0 ? avisos : notas).push(`nenhuma alma paralela a ${direcao}: cortante não verificado (9.8.3 é de alma)`);
  // Sem alma, com cortante: "avaliar", sem razão — a norma não traz a conta,
  // como a FLT da cantoneira. Antes saía "não atende ∞" (achado B7).
  const naoVerificada = !almas.length && VSd !== 0;
  const razao = VRd > 0 ? Math.abs(VSd) / VRd : naoVerificada ? NaN : 0;
  const contas: Conta[] = almas.flatMap((al) => {
    const lim1 = 1.08 * Math.sqrt((E * al.kv) / aco.fy);
    const lim2 = 1.4 * Math.sqrt((E * al.kv) / aco.fy);
    const formula =
      al.faixa === 1
        ? fr(x(n(0.6, 1), ' ', v('f', 'y'), ' ', v('h'), ' ', v('t')), v('γ'))
        : al.faixa === 2
          ? fr(x(n(0.65, 2), ' ', pot(v('t'), 2), ' ', rz(x(v('k', 'v'), ' ', v('f', 'y'), ' ', v('E')))), v('γ'))
          : fr(fr(x(n(0.905, 3), ' ', v('E'), ' ', v('k', 'v'), ' ', pot(v('t'), 3)), v('h')), v('γ'));
    return [
      { simbolo: x(v('h'), '/', v('t'), ` ${al.papel}`), numeros: fr(n(al.h), n(al.t)), valor: al.ht, casas: 1, rotulo: al.faixa === 1 ? `≤ ${lim1.toFixed(1)}` : al.faixa === 2 ? `entre ${lim1.toFixed(1)} e ${lim2.toFixed(1)}` : `> ${lim2.toFixed(1)}` },
      { simbolo: v('k', 'v'), valor: al.kv, casas: 2 },
      { simbolo: v('V', 'Rd'), formula, valor: al.VRd, unidade: 'kN' },
    ];
  });
  if (almas.length > 1 || nPerfis > 1) contas.push({ simbolo: x('Σ', v('V', 'Rd')), valor: VRd, unidade: 'kN', rotulo: nPerfis > 1 ? `${nPerfis} perfis` : undefined });
  return {
    direcao,
    VSd: Math.abs(VSd),
    almas,
    VRd,
    verificacao: {
      chave: direcao === 'y' ? 'cortanteY' : 'cortanteX',
      titulo: `Cortante em ${direcao}`,
      item: '9.8.3',
      sd: Math.abs(VSd),
      rd: VRd,
      unidade: 'kN',
      razao,
      situacao: naoVerificada ? 'avaliar' : situacaoPelaRazao(razao, avisos),
      naoVerificada,
      passos: [{ ref: '9.8.3', titulo: `Força cortante resistente (${almas.length} alma${almas.length === 1 ? '' : 's'})`, contas }],
      avisos,
      notas: [...new Set(notas)],
    },
  };
}

// ── Momento fletor e cortante combinados (9.8.4) ────────────────────────────

/**
 * Sem enrijecedor transversal: (M/MRd)² + (V/VRd)² ≤ 1. Com: quando M/MRd > 0,5
 * e V/VRd > 0,7, 0,6·M/MRd + V/VRd ≤ 1,3 (a razão volta normalizada por 1,3).
 * MRd é o do 9.8.2.1 (escoamento da seção efetiva), sem FLT.
 *
 * ⚠️ O ENRIJECEDOR É DE CADA PAR: só a alma (Mx com Vy) pode tê-lo, e só se
 * ele valeu no kv (9.5.2). My com Vx é sempre sem (achados A3 e A5).
 */
export function verificarMomentoCortante(pares: { eixo: 'x' | 'y'; MSd: number; MRd: number; VSd: number; VRd: number; comEnrijecedor: boolean }[]): Verificacao {
  const contas: Conta[] = [];
  let pior = 0;
  for (const p of pares) {
    if (!(p.MRd > 0 && p.VRd > 0)) continue;
    const m = Math.abs(p.MSd) / p.MRd;
    const vv = Math.abs(p.VSd) / p.VRd;
    // A cortante do par tem o índice dela: Mx anda com Vy (a alma), My com Vx.
    const ev = p.eixo === 'x' ? 'y' : 'x';
    let r: number;
    if (!p.comEnrijecedor) {
      r = m ** 2 + vv ** 2;
      contas.push({ simbolo: x(pot(par(fr(v('M', `Sd,${p.eixo}`), v('M', `Rd,${p.eixo}`))), 2), ' + ', pot(par(fr(v('V', `Sd,${ev}`), v('V', `Rd,${ev}`))), 2)), numeros: x(pot(n(m, 3), 2), ' + ', pot(n(vv, 3), 2)), valor: r, casas: 3, rotulo: '≤ 1,0' });
    } else if (m > 0.5 && vv > 0.7) {
      r = (0.6 * m + vv) / 1.3;
      contas.push({ simbolo: x(n(0.6, 1), ' ', fr(v('M', `Sd,${p.eixo}`), v('M', `Rd,${p.eixo}`)), ' + ', fr(v('V', `Sd,${ev}`), v('V', `Rd,${ev}`))), numeros: x(n(0.6, 1), ' · ', n(m, 3), ' + ', n(vv, 3)), valor: 0.6 * m + vv, casas: 3, rotulo: '≤ 1,3' });
    } else {
      r = Math.max(m, vv);
      contas.push({ simbolo: v('M', `Sd,${p.eixo}`), texto: 'com enrijecedores: interação só acima de M/MRd 0,5 e V/VRd 0,7' });
    }
    pior = Math.max(pior, r);
  }
  return {
    chave: 'momentoCortante',
    titulo: 'Momento com cortante',
    item: '9.8.4',
    sd: pior,
    rd: 1,
    unidade: '',
    razao: pior,
    situacao: situacaoPelaRazao(pior),
    passos: [{ ref: '9.8.4', titulo: 'Momento fletor e força cortante combinados', contas }],
    avisos: [],
  };
}

// ── Flexão composta (9.9) ───────────────────────────────────────────────────

export function verificarCombinados(N: number, NRd: number, Mx: number, MxRd: number, My: number, MyRd: number): Verificacao {
  const tN = NRd > 0 ? Math.abs(N) / NRd : 0;
  const tx = MxRd > 0 ? Math.abs(Mx) / MxRd : 0;
  const ty = MyRd > 0 ? Math.abs(My) / MyRd : 0;
  const soma = tN + tx + ty;
  return {
    chave: 'combinada',
    titulo: 'Esforços combinados',
    item: '9.9',
    sd: soma,
    rd: 1,
    unidade: '',
    razao: soma,
    situacao: situacaoPelaRazao(soma),
    passos: [
      {
        ref: '9.9',
        titulo: N >= 0 ? 'Flexo-compressão' : 'Flexo-tração',
        contas: [
          {
            simbolo: x(fr(v('N', 'Sd'), v('N', 'Rd')), ' + ', fr(v('M', 'x,Sd'), v('M', 'x,Rd')), ' + ', fr(v('M', 'y,Sd'), v('M', 'y,Rd'))),
            numeros: x(n(tN, 3), ' + ', n(tx, 3), ' + ', n(ty, 3)),
            valor: soma,
            casas: 3,
            rotulo: '≤ 1,0',
          },
        ],
      },
    ],
    avisos: [],
  };
}
