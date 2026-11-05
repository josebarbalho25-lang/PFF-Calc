// ═══════════════════════════════════════════════════════════════════════════
//  ui/guardarEntrada.ts — a última entrada fica no navegador, para a
//  calculadora reabrir onde parou
// ---------------------------------------------------------------------------
//  ⚠️ O QUE VEM DO NAVEGADOR É CONFERIDO ANTES DE ENTRAR. Uma versão velha
//  pode ter guardado uma família ou um aço que mudou de nome: aí vale o de
//  partida, nunca um valor que o motor não reconhece.
// ═══════════════════════════════════════════════════════════════════════════

import { acoPeloNome } from '../motor/catalogos/acos';
import type { AnexoF, Comprimentos, Esforcos, MetodoDoLocal } from '../motor/norma/tipos';
import type { DimensoesDoPerfil, FamiliaDePerfil, SecaoDesenhada, SoldaDaComposta } from '../motor/secao/tipos';
import { NOMES_DAS_FAMILIAS, OUTRO_ACO, type EscolhaDoAco } from './PainelPerfil';

const CHAVE = 'calculadora-nbr14762:entrada';
const CHAVE_ID = 'calculadora-nbr14762:identificacao';

export interface EstadoDaEntrada {
  perfil: DimensoesDoPerfil;
  aco: EscolhaDoAco;
  esforcos: Esforcos;
  comprimentos: Comprimentos;
  metodo: MetodoDoLocal;
  /** O Anexo F na tela: desligado, os valores ficam guardados para quando religar. */
  anexoF: EstadoDoAnexoF;
}

export type EstadoDoAnexoF = AnexoF & { ligado: boolean };

export const ANEXO_F_DE_PARTIDA: EstadoDoAnexoF = {
  ligado: false,
  mesaComTelha: 'superior',
  barra: 'biapoiada',
  relacaoVaos: 1,
  vao: 600,
  declaradas: { f: false, h: false, i: false, j: false, k: false, l: false, F4: false },
};

export const ENTRADA_DE_PARTIDA: EstadoDaEntrada = {
  perfil: { familia: 'Ue', bw: 150, bf: 60, D: 20, t: 2, ri: 2 },
  aco: { nome: 'ZAR 345', fy: 34.5, fu: 43 },
  esforcos: { N: 0, Mx: 0, My: 0, Vx: 0, Vy: 0 },
  comprimentos: { Lx: 300, Ly: 150, Lz: 150, Cb: 1, a: 0 },
  metodo: 'MLE',
  anexoF: ANEXO_F_DE_PARTIDA,
};

function lerAnexoF(v: unknown): EstadoDoAnexoF {
  const a = (v ?? {}) as Partial<EstadoDoAnexoF>;
  const z = ANEXO_F_DE_PARTIDA;
  const d = (a.declaradas ?? {}) as Partial<EstadoDoAnexoF['declaradas']>;
  const sim = (k: keyof EstadoDoAnexoF['declaradas']) => d[k] === true;
  return {
    ligado: a.ligado === true,
    mesaComTelha: a.mesaComTelha === 'inferior' ? 'inferior' : 'superior',
    barra: a.barra === 'continua' ? 'continua' : 'biapoiada',
    relacaoVaos: positivo(a.relacaoVaos, z.relacaoVaos),
    vao: positivo(a.vao, z.vao),
    declaradas: { f: sim('f'), h: sim('h'), i: sim('i'), j: sim('j'), k: sim('k'), l: sim('l'), F4: sim('F4') },
  };
}

/** Esforço pode ser negativo; comprimento e Cb, não. */
function qualquer(v: unknown, padrao: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : padrao;
}

function numero(v: unknown, padrao: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : padrao;
}

/** fy e fu: zero deixa a norma sem conta (achado B2 da revisão de 01/11/2026). */
function positivo(v: unknown, padrao: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : padrao;
}

/**
 * A entrada pelo endereço (`#entrada=` + JSON), antes da guardada. É o que
 * deixa tirar o print de um perfil qualquer pelo Edge sem janela
 * (`scripts/prints.ps1`). Passa pela mesma conferência da guardada.
 */
function textoDaEntrada(): string | null {
  const marca = '#entrada=';
  const hash = typeof location === 'undefined' ? '' : location.hash;
  if (hash.startsWith(marca)) return decodeURIComponent(hash.slice(marca.length).split('&')[0]);
  return localStorage.getItem(CHAVE);
}

/**
 * A janela que o print quer aberta (`&janela=Lx`, `&janela=dist`,
 * `&janela=memoria`...). Só para os prints sem janela: quem usa abre pelo (?).
 */
export function janelaDoEndereco(): string | null {
  const achado = typeof location === 'undefined' ? null : /[#&]janela=(\w+)/.exec(location.hash);
  return achado?.[1] ?? null;
}

function lerSolda(v: unknown): SoldaDaComposta {
  const s = (v ?? {}) as Partial<{ tipo: string; s: unknown }>;
  return s.tipo === 'intermitente' ? { tipo: 'intermitente', s: positivo(s.s, 50) } : { tipo: 'continua' };
}

/**
 * O desenho guardado: nós com coordenada finita, trechos com nós que existem
 * e espessura positiva. Qualquer coisa fora disso é jogada fora — o editor
 * abre vazio, e o motor nunca recebe um nó sem número.
 */
function lerDesenho(v: unknown): SecaoDesenhada | undefined {
  const d = v as Partial<{ nos: unknown; trechos: unknown }> | null;
  if (!d || !Array.isArray(d.nos) || !Array.isArray(d.trechos)) return undefined;
  const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  const nos = d.nos.map((n: unknown) => n as Partial<{ x: unknown; y: unknown }>);
  if (!nos.every((n) => n && finito(n.x) && finito(n.y))) return undefined;
  const indice = (k: unknown): k is number => Number.isInteger(k) && (k as number) >= 0 && (k as number) < nos.length;
  const trechos = d.trechos.map((tr: unknown) => tr as Partial<{ i: unknown; j: unknown; t: unknown }>);
  if (!trechos.every((tr) => tr && indice(tr.i) && indice(tr.j) && (tr.t === undefined || (finito(tr.t) && tr.t > 0)))) return undefined;
  return {
    nos: nos.map((n) => ({ x: n.x as number, y: n.y as number })),
    trechos: trechos.map((tr) => ({ i: tr.i as number, j: tr.j as number, ...(tr.t === undefined ? {} : { t: tr.t as number }) })),
  };
}

export function lerEntrada(): EstadoDaEntrada {
  try {
    const bruto = JSON.parse(textoDaEntrada() ?? 'null') as Partial<EstadoDaEntrada> | null;
    if (!bruto?.perfil || !bruto.aco) return ENTRADA_DE_PARTIDA;
    const p = bruto.perfil;
    const familia = (Object.keys(NOMES_DAS_FAMILIAS) as FamiliaDePerfil[]).find((k) => k === p.familia);
    if (!familia) return ENTRADA_DE_PARTIDA;
    const z = ENTRADA_DE_PARTIDA.perfil;
    const perfil: DimensoesDoPerfil = {
      familia,
      bw: numero(p.bw, z.bw),
      bf: numero(p.bf, z.bf),
      D: numero(p.D, 0),
      t: numero(p.t, z.t),
      ri: numero(p.ri, z.ri),
      anguloEnrijecedor: familia === 'Ze' ? (p.anguloEnrijecedor === 45 ? 45 : 90) : undefined,
      solda: familia === 'Ue2' ? lerSolda(p.solda) : undefined,
      desenho: lerDesenho(p.desenho) ?? (familia === 'Desenho' ? { nos: [], trechos: [] } : undefined),
    };
    const a = bruto.aco;
    const doCatalogo = typeof a.nome === 'string' ? acoPeloNome(a.nome) : undefined;
    const aco: EscolhaDoAco = doCatalogo
      ? { nome: doCatalogo.nome, fy: doCatalogo.fy, fu: doCatalogo.fu }
      : a.nome === OUTRO_ACO
        ? { nome: OUTRO_ACO, fy: positivo(a.fy, 25), fu: positivo(a.fu, 40) }
        : ENTRADA_DE_PARTIDA.aco;
    const f = (bruto.esforcos ?? {}) as Partial<Esforcos>;
    const L = (bruto.comprimentos ?? {}) as Partial<Comprimentos>;
    const partida = ENTRADA_DE_PARTIDA.comprimentos;
    const esforcos: Esforcos = { N: qualquer(f.N, 0), Mx: qualquer(f.Mx, 0), My: qualquer(f.My, 0), Vx: qualquer(f.Vx, 0), Vy: qualquer(f.Vy, 0) };
    const comprimentos: Comprimentos = {
      Lx: numero(L.Lx, partida.Lx),
      Ly: numero(L.Ly, partida.Ly),
      Lz: numero(L.Lz, partida.Lz),
      Cb: Math.max(1, numero(L.Cb, 1)),
      a: numero(L.a, 0),
    };
    const metodo: MetodoDoLocal = bruto.metodo === 'MSE' || bruto.metodo === 'MRD' ? bruto.metodo : 'MLE';
    return { perfil, aco, esforcos, comprimentos, metodo, anexoF: lerAnexoF(bruto.anexoF) };
  } catch {
    return ENTRADA_DE_PARTIDA;
  }
}

export function guardarEntrada(e: EstadoDaEntrada): void {
  // Aberta pelo endereço (print sem janela, conferência), não grava por cima
  // da entrada que ele deixou guardada.
  if (typeof location !== 'undefined' && location.hash.startsWith('#entrada=')) return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    // Navegador sem armazenamento (aba anônima, cota cheia): só não guarda.
  }
}

/** Joga fora a entrada guardada: a saída da tela de erro da raiz. */
export function esquecerEntrada(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento, nada a esquecer
  }
}

/**
 * O que vai no carimbo da memória. Tudo texto livre. O responsável técnico,
 * o título dele e o registro (CREA) NÃO são digitados aqui: vêm da
 * configuração (`ui/projetista.ts`), um lugar só, e o App os junta na hora
 * de montar a memória.
 */
export interface Identificacao {
  obra: string;
  cliente: string;
  elemento: string;
  documento: string;
  revisao: string;
  empresa: string;
  responsavel: string;
  /** O título do projetista ("Engenheiro Civil"). */
  titulo?: string;
  registro: string;
}

export const IDENTIFICACAO_VAZIA: Identificacao = {
  obra: '',
  cliente: '',
  elemento: '',
  documento: '',
  revisao: '00',
  empresa: '',
  responsavel: '',
  registro: '',
};

export function lerIdentificacao(): Identificacao {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_ID) ?? 'null') as Record<string, unknown> | null;
    const id = { ...IDENTIFICACAO_VAZIA };
    if (bruto) for (const k of Object.keys(id) as (keyof Identificacao)[]) if (typeof bruto[k] === 'string') id[k] = bruto[k];
    return id;
  } catch {
    return { ...IDENTIFICACAO_VAZIA };
  }
}

export function guardarIdentificacao(id: Identificacao): void {
  try {
    localStorage.setItem(CHAVE_ID, JSON.stringify(id));
  } catch {
    // Navegador sem armazenamento: só não lembra.
  }
}
