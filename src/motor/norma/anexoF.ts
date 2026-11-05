// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/anexoF.ts — barras com painel conectado à mesa tracionada
//  (Anexo F): MRd = R·Wef·fy/γ, R da Tabela F.1
// ---------------------------------------------------------------------------
//  As condições de F.1 que a seção e o aço dizem sozinhos são conferidas aqui
//  (a, b, c, d, e, g, m); as que dependem da obra são declaradas pelo
//  engenheiro (f, h, i, j, k, l e o F.4: fora de balanço e de trecho entre
//  ponto de inflexão e apoio). Uma só que falhe e o anexo não vale (F.2): a
//  verificação volta ao 9.8.2, e a memória diz qual falhou.
//
//  ⚠️ O ANEXO SÓ VALE NO SENTIDO DO MOMENTO QUE TRACIONA A MESA COM A TELHA.
//  No outro sentido a mesa livre é a tracionada e o painel não trava a
//  comprimida: 9.8.2, com os comprimentos informados.
//
//  ⚠️ DECISÃO DELE (04/11/2026, onde a norma é omissa): o R substitui a FLT,
//  mas o distorcional (9.8.2.3) continua verificado, e vale o menor — a favor
//  da segurança.
// ═══════════════════════════════════════════════════════════════════════════

import type { SecaoGeometrica } from '../secao/tipos';
import { fr, v, x, type Conta, type Expr } from './memoria';
import type { AnexoF, AcoDaVerificacao } from './tipos';

export interface AvaliacaoDoAnexoF {
  /** As condições que falharam, cada uma com a letra de F.1 e o valor. */
  falhas: string[];
  /** As conferidas, para a memória: letra, texto e se passou. */
  conferidas: { letra: string; texto: string; ok: boolean }[];
  /** As mesmas, em linhas de conta: a grandeza, o valor e a faixa da norma. */
  contas: Conta[];
  R?: number;
  /** A linha da Tabela F.1 usada. */
  linha?: string;
}

const DECLARADAS: Record<keyof AnexoF['declaradas'], string> = {
  f: 'f) traspasse ≥ 1,5·bw nos apoios internos',
  h: 'h) deslocamento lateral das duas mesas impedido nos apoios',
  i: 'i) painel conforme F.1 i)',
  j: 'j) conectores conforme F.1 j)',
  k: 'k) nenhum conector não padronizado',
  l: 'l) espaçamento dos conectores ≤ 300 mm, perto do centro da mesa',
  F4: 'F.4: fora de balanço e de trecho entre ponto de inflexão e apoio',
};

const num = (v: number, c = 1) => v.toFixed(c).replace('.', ',');

export function avaliarAnexoF(sec: SecaoGeometrica, aco: AcoDaVerificacao, a: AnexoF): AvaliacaoDoAnexoF {
  const d = sec.dimensoes;
  const conferidas: AvaliacaoDoAnexoF['conferidas'] = [];
  const contas: Conta[] = [];
  // Na memória: "c)  bw/t = 75,0    60 ≤ bw/t ≤ 170 · atende"
  const conferir = (letra: string, texto: string, ok: boolean, simbolo?: Expr, valor?: number, faixa?: string, casas = 1, unidade?: string) => {
    conferidas.push({ letra, texto, ok });
    const sit = ok ? 'atende' : 'NÃO atende';
    contas.push(simbolo === undefined ? { simbolo: x(`${letra})  ${texto}`), rotulo: sit } : { simbolo: x(`${letra})  `, simbolo), valor, casas, unidade, rotulo: `${faixa} · ${sit}` });
  };
  const comEnrijecedor = d.familia === 'Ue' || d.familia === 'Ze';
  conferir('a', 'mesas com enrijecedor de borda', comEnrijecedor);
  conferir('b', `bw = ${num(d.bw, 0)} mm ≤ 292 mm`, d.bw <= 292, v('b', 'w'), d.bw, 'bw ≤ 292 mm', 0, 'mm');
  const bwt = d.bw / d.t;
  conferir('c', `60 ≤ bw/t = ${num(bwt)} ≤ 170`, bwt >= 60 && bwt <= 170, fr(v('b', 'w'), v('t')), bwt, '60 ≤ bw/t ≤ 170');
  const bwbf = d.bw / d.bf;
  conferir('d', `2,8 ≤ bw/bf = ${num(bwbf, 2)} ≤ 4,5`, bwbf >= 2.8 && bwbf <= 4.5, fr(v('b', 'w'), v('b', 'f')), bwbf, '2,8 ≤ bw/bf ≤ 4,5', 2);
  const mesa = sec.elementos.find((e) => e.papel === 'mesa');
  const bt = mesa ? mesa.b / sec.t : NaN;
  conferir('e', `16 ≤ b/t = ${num(bt)} ≤ 43 (parte plana da mesa)`, bt >= 16 && bt <= 43, fr(v('b'), v('t')), bt, '16 ≤ b/t ≤ 43, parte plana da mesa');
  conferir('g', `vão = ${num(a.vao / 100, 2)} m < 10 m`, a.vao > 0 && a.vao < 1000, v('L'), a.vao / 100, 'vão < 10 m', 2, 'm');
  conferir('m', `fy = ${num(aco.fy * 10, 0)} MPa ≤ 410 MPa`, aco.fy <= 41, v('f', 'y'), aco.fy * 10, 'fy ≤ 410 MPa', 0, 'MPa');
  const falhas = conferidas.filter((c) => !c.ok).map((c) => `${c.letra}) ${c.texto}`);
  for (const k of Object.keys(DECLARADAS) as (keyof AnexoF['declaradas'])[]) {
    if (k === 'f' && a.barra !== 'continua') continue;
    if (!a.declaradas[k]) falhas.push(`${DECLARADAS[k]} — não declarada`);
  }
  if (!comEnrijecedor) return { falhas, conferidas, contas };
  // Tabela F.1; nota a: relação entre vãos adjacentes acima de 1,2 → biapoiada
  const continua = a.barra === 'continua' && !(a.relacaoVaos > 1.2);
  const Z = d.familia === 'Ze';
  let R: number | undefined;
  let linha = '';
  if (continua) {
    if (d.bw <= 292) {
      R = Z ? 0.7 : 0.6;
      linha = `contínua, bw ≤ 292, ${Z ? 'Z' : 'U'}`;
    }
  } else if (d.bw <= 165) {
    R = 0.7;
    linha = 'biapoiada, bw ≤ 165';
  } else if (d.bw <= 216) {
    R = 0.65;
    linha = 'biapoiada, 165 < bw ≤ 216';
  } else if (d.bw <= 292) {
    R = Z ? 0.5 : 0.4;
    linha = `biapoiada, 216 < bw ≤ 292, ${Z ? 'Z' : 'U'}`;
  }
  if (a.barra === 'continua' && a.relacaoVaos > 1.2) linha += ` (vãos adjacentes ${num(a.relacaoVaos, 2)} > 1,2: nota a)`;
  return { falhas, conferidas, contas, R, linha };
}

/** O sentido em que o anexo vale: o que traciona a mesa com a telha (Mx > 0 traciona a de baixo). */
export function sentidoDoAnexoF(a: AnexoF): 1 | -1 {
  return a.mesaComTelha === 'inferior' ? 1 : -1;
}
