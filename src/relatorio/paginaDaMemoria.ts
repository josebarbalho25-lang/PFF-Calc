// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/paginaDaMemoria.ts — a memória inteira, num HTML só
// ---------------------------------------------------------------------------
//  Capa (título, ficha, resumo, ressalvas, índice e carimbo), premissas, um
//  capítulo por verificação, as conclusões e o glossário. A saída é a página inteira: a
//  tela a mostra numa moldura, e o servidor a imprime em PDF pelo Edge. O
//  que se vê é o que sai.
// ═══════════════════════════════════════════════════════════════════════════

import type { ResultadoDaVerificacao } from '../motor/norma';
import type { Identificacao } from '../ui/guardarEntrada';
import { capituloConclusoes, capituloDaVerificacao, capituloFlambagem, capituloPremissas, tabelaResumo } from './capitulos';
import { designacao } from './designacao';
import { estiloDaMemoria } from './estiloRelatorio';
import { dataDeHoje, esc, num } from './formatos';
import { capituloGlossario } from './glossario';

export const VERSAO = '0.1.0';

const ou = (s: string) => (s.trim() ? esc(s) : '—');
const nomeDo = (r: ResultadoDaVerificacao) => designacao(r.entrada.perfil);

function capa(r: ResultadoDaVerificacao, id: Identificacao, titulos: readonly string[], data: string): string {
  const avisos = r.lista.flatMap((vf) => vf.avisos.map((a) => `${vf.titulo}: ${a}`));
  // Três colunas, lidas de cima para baixo: com nove verificações, em duas
  // colunas o índice empurrava o carimbo para uma página sozinha.
  const linhas = Math.ceil(titulos.length / 3);
  const celulas: string[] = [];
  for (let i = 0; i < linhas; i++) {
    for (const j of [i, i + linhas, i + 2 * linhas]) celulas.push(j < titulos.length ? `<span><span class="n">${j + 1}</span>${titulos[j]}</span>` : '<span></span>');
  }
  const veredito =
    r.situacao === 'atende'
      ? `<span class="st st-atende">Atende</span>`
      : r.situacao === 'avaliar'
        ? `<span class="st st-avaliar">Atende, com ressalvas</span>`
        : `<span class="st st-naoAtende">Não atende</span>`;
  return (
    `<section class="capa">` +
    `<div class="capa-topo"><span class="marca">PFF Calc · NBR 14762</span><span>Memória de cálculo estrutural</span></div>` +
    `<h1>Verificação de perfil formado a frio</h1>` +
    `<p class="subtitulo">Perfil ${esc(nomeDo(r))} em ${esc(r.entrada.aco.nome)} — estados-limites últimos de tração, compressão, flexão, cortante e esforços combinados pela ABNT NBR 14762:2010, método ${esc(r.entrada.metodo)}</p>` +
    `<div class="ficha"><dl>` +
    `<dt>Obra</dt><dd>${ou(id.obra)}</dd><dt>Cliente</dt><dd>${ou(id.cliente)}</dd><dt>Elemento</dt><dd>${ou(id.elemento)}</dd>` +
    `<dt>Perfil</dt><dd>${esc(nomeDo(r))}</dd><dt>Aço</dt><dd>${esc(r.entrada.aco.nome)}</dd>` +
    `</dl><dl>` +
    `<dt>Documento</dt><dd>${ou(id.documento)}</dd><dt>Revisão</dt><dd>${ou(id.revisao)}</dd><dt>Data</dt><dd>${data}</dd>` +
    `<dt>Norma</dt><dd>ABNT NBR 14762:2010</dd>` +
    `</dl></div>` +
    `<h2 class="resumo-titulo" style="display:block;border:0;padding:0">Resumo dos resultados</h2>` +
    tabelaResumo(r) +
    `<p class="veredito">Situação geral: ${veredito} <span class="nevoa">· índice máximo ${num(r.razaoMaxima, 3)}</span></p>` +
    (avisos.length ? `<div class="alertas"><strong>Ressalvas</strong><ul>${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : '') +
    `<div class="indice-titulo">Conteúdo</div><div class="indice">${celulas.join('')}</div>` +
    `<div class="carimbo">` +
    `<div><span class="rot">Empresa</span><span class="empresa">${ou(id.empresa)}</span></div>` +
    `<div><span class="rot">Responsável técnico</span><span class="forte">${ou(id.responsavel)}</span>${id.titulo ? `<br>${esc(id.titulo)}` : ''}</div>` +
    `<div><span class="rot">CREA</span>${ou(id.registro)}</div>` +
    `<div><span class="rot">Elemento</span>${ou(id.elemento)}</div>` +
    `<div><span class="rot">Processamento</span>PFF Calc ${VERSAO}</div>` +
    `<div><span class="rot">Documento</span><span class="forte">${ou(id.documento)}</span> rev. ${ou(id.revisao)}<br>${data}</div>` +
    `</div></section>`
  );
}

export function paginaDaMemoria(r: ResultadoDaVerificacao, id: Identificacao, data = dataDeHoje()): string {
  // O glossário fecha a memória, como anexo: premissas, contas e conclusões
  // (com a assinatura) seguem na ordem do relatório do A-PORT.
  const titulos = ['Premissas e dados de entrada', 'Flambagem elástica da seção', ...r.lista.map((vf) => esc(vf.titulo)), 'Conclusões', 'Glossário'];
  const corpo = [
    capituloPremissas(r, 1),
    capituloFlambagem(r, 2),
    ...r.lista.map((vf, i) => capituloDaVerificacao(vf, i + 3)),
    capituloConclusoes(r, r.lista.length + 3, id.responsavel, id.registro, id.titulo ?? ''),
    capituloGlossario(r, r.lista.length + 4),
  ]
    .join('')
    // O primeiro capítulo abre a página 2 colado no alto.
    .replace('<section class="secao">', '<section class="secao" style="margin-top:0">');
  const titulo = `Memória de cálculo — ${nomeDo(r)}${id.elemento ? ` — ${id.elemento}` : ''}`;
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    `<title>${esc(titulo)}</title>` +
    estiloDaMemoria({ obra: id.obra || nomeDo(r), documento: id.documento, revisao: id.revisao, versao: VERSAO }) +
    `</head><body>${capa(r, id, titulos, data)}${corpo}</body></html>`
  );
}

/** Nome de arquivo: "Obra - V1 - Ue 150 x 60 x 20 x 2,00 - MC-001 rev00.pdf". */
export function nomeDoPdf(r: ResultadoDaVerificacao, id: Identificacao): string {
  // O Windows recusa no nome de arquivo os sinais abaixo e os caracteres de
  // controle (um Tab colado junto com o nome da obra, por exemplo).
  const limpo = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '-').replace(/\s+/g, ' ').trim();
  const partes = [limpo(id.obra), limpo(id.elemento), limpo(nomeDo(r)), limpo(id.documento) ? `${limpo(id.documento)} rev${limpo(id.revisao)}` : ''];
  return `${partes.filter(Boolean).join(' - ') || 'Memoria de calculo'}.pdf`;
}
