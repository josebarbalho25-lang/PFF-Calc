// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/expr.ts — a fórmula do motor vira HTML
// ---------------------------------------------------------------------------
//  Um desenho só para a memória A4 e para o detalhe da tela: a mesma linha
//  `símbolo = fórmula = números = resultado`, com fração empilhada, raiz com
//  traço em cima e índice embaixo. As classes (.eq, .frac, .raiz, .lbl) são as
//  do relatório do A-PORT; a tela as repinta com os tokens do tema.
// ═══════════════════════════════════════════════════════════════════════════

import type { Conta, Expr, Passo } from '../motor/norma/memoria';
import { casasPeloTamanho, esc, num, numExato } from './formatos';

export function exprHtml(e: Expr): string {
  switch (e.t) {
    case 'v':
      return `<i>${esc(e.nome)}</i>${e.ind ? `<sub>${esc(e.ind)}</sub>` : ''}`;
    case 'n':
      if (!Number.isFinite(e.v)) return num(e.v);
      // Número de entrada com as casas que tem (34,5); casas fixas quando a
      // conta pede (γa1 = 1,10).
      return e.casas === undefined ? numExato(e.v, casasPeloTamanho(e.v)) : num(e.v, e.casas);
    case 'txt':
      return esc(e.s);
    case 'fr':
      return `<span class="frac"><span>${exprHtml(e.num)}</span><span>${exprHtml(e.den)}</span></span>`;
    case 'rz':
      // O sinal é desenho, não letra: o "√" de fonte tem altura fixa, e o
      // traço de cima, sendo borda de texto, ficava na altura da letra —
      // cortava a fração lá dentro. Assim os dois esticam com o conteúdo.
      return `<span class="rad"><span class="rad-sinal"><svg viewBox="0 0 10 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 13.5 L2.4 12 L5.4 24 L10 0" vector-effect="non-scaling-stroke"/></svg></span><span class="raiz">${exprHtml(e.x)}</span></span>`;
    case 'pot':
      return `${exprHtml(e.base)}<sup>${exprHtml(e.exp)}</sup>`;
    case 'par':
      return `(${exprHtml(e.x)})`;
    case 'seq':
      return e.partes.map(exprHtml).join('');
  }
}

/** O resultado escrito: casas fixas da conta, ou pelo tamanho. */
export function valorHtml(c: Conta): string {
  if (c.valor === undefined) return '';
  const casas = c.casas ?? casasPeloTamanho(c.valor);
  return `${num(c.valor, casas)}${c.unidade ? ` ${esc(c.unidade)}` : ''}`;
}

/** Uma linha de conta, no formato `.eq` do relatório. */
export function contaHtml(c: Conta): string {
  const partes = [exprHtml(c.simbolo)];
  if (c.formula) partes.push('=', exprHtml(c.formula));
  if (c.numeros) partes.push('=', exprHtml(c.numeros));
  if (c.valor !== undefined) partes.push('=', `<span class="res">${valorHtml(c)}</span>`);
  else if (c.texto) partes.push(':', esc(c.texto));
  const lbl = [c.rotulo, c.valor !== undefined ? c.texto : undefined].filter(Boolean).map((s) => esc(s!)).join(' · ');
  return `<div class="eq">${partes.map((p) => `<span>${p}</span>`).join('')}${lbl ? `<span class="lbl">${lbl}</span>` : ''}</div>`;
}

/** As contas de um passo, sem a moldura da página. */
export function contasHtml(p: Passo): string {
  return p.contas.map(contaHtml).join('') + (p.nota ? `<p class="nota-tab">${esc(p.nota)}</p>` : '');
}
