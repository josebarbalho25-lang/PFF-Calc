// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/index.ts — a porta do motor da NBR 14762: entra o perfil com
//  os esforços, sai a verificação inteira, com a memória passo a passo
// ---------------------------------------------------------------------------
//  É ESTA a função que o A-PORT vai chamar, barra a barra. Nada aqui sabe de
//  tela. As faixas finitas vêm prontas na entrada (`criticos`).
// ═══════════════════════════════════════════════════════════════════════════

import { montarSecao } from '../secao/familias';
import { propriedades, type PropriedadesDaSecao } from '../secao/propriedades';
import type { SecaoGeometrica } from '../secao/tipos';
import { secaoDoPerfil, verificarCompressao, type ResultadoCompressao } from './compressao';
import { verificarBarraComposta } from './composta';
import { verificarFlexao, type ResultadoFlexao } from './flexao';
import type { Situacao, Verificacao } from './memoria';
import { verificarLarguraEspessura } from './limites';
import { verificarCombinados, verificarCortante, verificarMomentoCortante, verificarTracao, type ResultadoCortante, type ResultadoTracao } from './simples';
import type { EntradaDaVerificacao } from './tipos';

export interface ResultadoDaVerificacao {
  entrada: EntradaDaVerificacao;
  secao: SecaoGeometrica;
  propriedades: PropriedadesDaSecao;
  larguraEspessura: Verificacao;
  tracao: ResultadoTracao;
  compressao: ResultadoCompressao;
  flexaoX: ResultadoFlexao;
  flexaoY: ResultadoFlexao;
  cortanteY: ResultadoCortante;
  cortanteX: ResultadoCortante;
  momentoCortante: Verificacao;
  combinada: Verificacao;
  /** Na ordem da memória e da tela. */
  lista: Verificacao[];
  razaoMaxima: number;
  situacao: Situacao;
}

/** A entrada que o motor recusa — a frase diz qual campo e por quê. */
export class EntradaInvalida extends Error {}

/**
 * ⚠️ O MOTOR RECUSA ENTRADA ESTRANHA EM VEZ DE CALCULAR COM ELA — a lição da
 * calculadora 8800: comprimento NaN virava "travada" e uma barra reprovada
 * passava. A tela já barra no campo; a trava aqui é para o A-PORT.
 */
function validar(e: EntradaDaVerificacao): void {
  const L = e.comprimentos;
  for (const k of ['Lx', 'Ly', 'Lz', 'a'] as const) {
    if (!Number.isFinite(L[k]) || L[k] < 0) throw new EntradaInvalida(`${k} = ${L[k]}: comprimento tem de ser um número ≥ 0`);
  }
  if (!Number.isFinite(L.Cb) || L.Cb < 1) throw new EntradaInvalida(`Cb = ${L.Cb}: tem de ser um número ≥ 1`);
  for (const [k, valor] of Object.entries(e.esforcos)) {
    if (!Number.isFinite(valor)) throw new EntradaInvalida(`${k} = ${valor}: esforço tem de ser um número`);
  }
  if (!(e.aco.fy > 0 && e.aco.fu > 0)) throw new EntradaInvalida(`aço ${e.aco.nome} sem fy ou fu`);
  const solda = e.perfil.solda;
  if (e.perfil.familia === 'Ue2' && solda?.tipo === 'intermitente' && !(solda.s > 0)) throw new EntradaInvalida(`espaçamento das soldas s = ${solda.s}: tem de ser maior que zero`);
  if (e.perfil.familia === 'Ue2' && !solda) throw new EntradaInvalida('dois Ue boca com boca: falta dizer a solda (contínua ou intermitente)');
}

export function verificar(entrada: EntradaDaVerificacao): ResultadoDaVerificacao {
  validar(entrada);
  const { aco, esforcos: f, comprimentos: L, metodo, criticos } = entrada;
  const secao = montarSecao(entrada.perfil);
  const pr = propriedades(secao);

  const tracao = verificarTracao(pr, aco, L, Math.max(-f.N, 0));
  const compressao = verificarCompressao(secao, pr, aco, L, metodo, criticos, Math.max(f.N, 0));
  const flexaoX = verificarFlexao(secao, pr, aco, L, metodo, criticos, 'x', f.Mx, entrada.anexoF);
  const flexaoY = verificarFlexao(secao, pr, aco, L, metodo, criticos, 'y', f.My);
  // Dois Ue com solda intermitente: os elementos (Tabela 4, cortante) são os
  // de cada Ue; as resistências, vezes 2.
  const local = secaoDoPerfil(secao);
  const cortanteY = verificarCortante(local.sec, aco, L.a, 'y', f.Vy, local.n);
  const cortanteX = verificarCortante(local.sec, aco, 0, 'x', f.Vx, local.n);
  const momentoCortante = verificarMomentoCortante(
    [
      { eixo: 'x', MSd: f.Mx, MRd: flexaoX.MRdLocal, VSd: f.Vy, VRd: cortanteY.VRd, comEnrijecedor: cortanteY.almas.some((al) => al.enrijecida) },
      { eixo: 'y', MSd: f.My, MRd: flexaoY.MRdLocal, VSd: f.Vx, VRd: cortanteX.VRd, comEnrijecedor: false },
    ],
  );
  const NRd = f.N >= 0 ? compressao.NcRd : tracao.NtRd;
  const combinada = verificarCombinados(f.N, NRd, f.Mx, flexaoX.MRd, f.My, flexaoY.MRd);

  const larguraEspessura = verificarLarguraEspessura(local.sec, f, cortanteY.almas.some((al) => al.enrijecida));
  const solda = entrada.perfil.solda;
  const composta = entrada.perfil.familia === 'Ue2' && solda?.tipo === 'intermitente' ? [verificarBarraComposta(pr, propriedades(local.sec), L, solda.s, Math.max(f.N, 0))] : [];
  const lista = [larguraEspessura, ...composta, tracao.verificacao, compressao.verificacao, flexaoX.verificacao, flexaoY.verificacao, cortanteY.verificacao, cortanteX.verificacao, momentoCortante, combinada];
  // NaN tem de pesar como reprovação, não sumir do máximo — menos a
  // verificação que a norma não traz (cortante sem alma), que fica "avaliar".
  const contadas = lista.filter((vf) => !vf.naoVerificada);
  const razaoMaxima = contadas.some((vf) => Number.isNaN(vf.razao)) ? NaN : Math.max(...contadas.map((vf) => vf.razao));
  const situacao: Situacao = lista.some((vf) => vf.situacao === 'naoAtende') ? 'naoAtende' : lista.some((vf) => vf.situacao === 'avaliar') ? 'avaliar' : 'atende';
  return { entrada, secao, propriedades: pr, larguraEspessura, tracao, compressao, flexaoX, flexaoY, cortanteY, cortanteX, momentoCortante, combinada, lista, razaoMaxima, situacao };
}

export type { EntradaDaVerificacao } from './tipos';
