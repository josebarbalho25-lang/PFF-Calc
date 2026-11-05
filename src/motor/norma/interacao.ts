// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/interacao.ts — a superfície de interação N–Mx–My do 9.9
// ---------------------------------------------------------------------------
//  A interação da norma para perfil formado a frio é LINEAR (9.9):
//  N/NRd + Mx/Mx,Rd + My/My,Rd ≤ 1, com cada resistência a do sinal do
//  esforço — Nc,Rd ou Nt,Rd; o Mx,Rd e o My,Rd de cada sentido (no My do Ue,
//  pontas comprimidas × alma comprimida dão resistências diferentes). Em cada
//  octante é um plano; a superfície é o poliedro de oito faces com os seis
//  vértices nos eixos.
//
//  ⚠️ NÃO É A INTERAÇÃO PLÁSTICA POR FIBRAS: essa não é a da norma para perfil
//  formado a frio. As resistências saem do mesmo `verificar` da tela, uma
//  rodada por esforço isolado — o diagrama não tem conta própria.
// ═══════════════════════════════════════════════════════════════════════════

import { verificar } from './index';
import type { EntradaDaVerificacao } from './tipos';

export interface SuperficieDeInteracao {
  NcRd: number;
  NtRd: number;
  MxRd: { pos: number; neg: number };
  MyRd: { pos: number; neg: number };
  /** O ponto solicitante e o índice do 9.9 (a mesma soma da verificação combinada). */
  ponto: { N: number; Mx: number; My: number };
  indice: number;
}

export function superficieDeInteracao(e: EntradaDaVerificacao): SuperficieDeInteracao {
  const so = (N: number, Mx: number, My: number) => verificar({ ...e, esforcos: { N, Mx, My, Vx: 0, Vy: 0 } });
  const NcRd = so(1, 0, 0).compressao.NcRd;
  const NtRd = so(-1, 0, 0).tracao.NtRd;
  const MxRd = { pos: so(0, 1, 0).flexaoX.MRd, neg: so(0, -1, 0).flexaoX.MRd };
  const MyRd = { pos: so(0, 0, 1).flexaoY.MRd, neg: so(0, 0, -1).flexaoY.MRd };
  const f = e.esforcos;
  // a mesma guarda de `verificarCombinados`: resistência nula não entra na soma
  const parcela = (s: number, pos: number, neg: number) => {
    const R = s > 0 ? pos : neg;
    return s === 0 || !(R > 0) ? 0 : Math.abs(s) / R;
  };
  const indice = parcela(f.N, NcRd, NtRd) + parcela(f.Mx, MxRd.pos, MxRd.neg) + parcela(f.My, MyRd.pos, MyRd.neg);
  return { NcRd, NtRd, MxRd, MyRd, ponto: { N: f.N, Mx: f.Mx, My: f.My }, indice };
}
