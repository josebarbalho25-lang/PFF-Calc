// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/pecas.ts — as peças da página: seção, passo, pares, tabela
// ---------------------------------------------------------------------------
//  O vocabulário do relatório do A-PORT (`relatorio/pagina/pecas.ts`), trazido
//  sem mudar: cada SEÇÃO numerada com a linha grossa embaixo; cada PASSO com o
//  número e o item da norma na coluna da esquerda (`.ref`) e o conteúdo à
//  direita; tabela com a unidade embaixo do título da coluna.
// ═══════════════════════════════════════════════════════════════════════════

import type { Situacao } from '../motor/norma/memoria';
import { esc } from './formatos';

export function secao(n: number, titulo: string, corpo: string, classe = ''): string {
  return `<section class="secao${classe ? ` ${classe}` : ''}"><h2><span class="n">${n}</span><span>${titulo}</span></h2>${corpo}</section>`;
}

/** Um passo: o número e a referência à esquerda, o título e o conteúdo à direita. */
export function passo(p: { n?: string; ref?: string; titulo?: string; corpo: string; semQuebra?: boolean }): string {
  return (
    `<div class="passo${p.semQuebra ? ' sem-quebra' : ''}">` +
    `<div class="ref">${p.n ? `<span class="n">${p.n}</span>` : ''}${p.ref ?? ''}</div>` +
    `<div class="conteudo">${p.titulo ? `<h3>${p.titulo}</h3>` : ''}${p.corpo}</div></div>`
  );
}

/** Pares rótulo–valor (HTML já pronto dos dois lados). */
export function kv(pares: ReadonlyArray<readonly [string, string]>): string {
  return `<dl class="kv">${pares.map(([r, v]) => `<dt>${r}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

export interface Coluna {
  /** HTML do título. */
  cab: string;
  un?: string;
  /** Texto à esquerda, com quebra. */
  txt?: boolean;
}

export interface Linha {
  celulas: string[];
  classe?: string;
}

export function tabela(colunas: readonly Coluna[], linhas: readonly Linha[], classe = ''): string {
  const cab = colunas
    .map((c) => `<th${c.txt ? ' class="txt"' : ''}>${c.cab}${c.un ? `<span class="un">${c.un}</span>` : ''}</th>`)
    .join('');
  const corpo = linhas
    .map(
      (l) =>
        `<tr${l.classe ? ` class="${l.classe}"` : ''}>` +
        l.celulas.map((v, i) => `<td${colunas[i]?.txt ? ' class="txt"' : ''}>${v}</td>`).join('') +
        '</tr>',
    )
    .join('');
  return `<table${classe ? ` class="${classe}"` : ''}><thead><tr>${cab}</tr></thead><tbody>${corpo}</tbody></table>`;
}

export function nota(html: string): string {
  return `<p class="nota-tab">${html}</p>`;
}

const ROTULO_DA_SITUACAO: Record<Situacao, string> = { atende: 'Atende', avaliar: 'Avaliar', naoAtende: 'Não atende' };

export function situacao(s: Situacao, rotulo?: string): string {
  return `<span class="st st-${s}">${esc(rotulo ?? ROTULO_DA_SITUACAO[s])}</span>`;
}

/** Variável em itálico de fórmula, com índice opcional: v('N', 'c,Rd'). */
export function v(nome: string, indice?: string): string {
  return `<i>${nome}</i>${indice ? `<sub>${indice}</sub>` : ''}`;
}
