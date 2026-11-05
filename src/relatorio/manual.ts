// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/manual.ts — o manual (docs/MANUAL.md) no visual da memória
// ---------------------------------------------------------------------------
//  Um conversor pequeno de Markdown, só para o que o manual usa: título,
//  capítulos (##), subtítulos (###), parágrafos, listas, tabelas, imagens,
//  negrito e código. Os capítulos saem com as mesmas peças da memória
//  (`secao`), o estilo é o dela (`estiloDaMemoria`) e o PDF sai pela mesma
//  impressão no Edge. As imagens entram embutidas na página.
// ═══════════════════════════════════════════════════════════════════════════

import { esc } from './formatos';
import { estiloDaMemoria } from './estiloRelatorio';
import { VERSAO } from './paginaDaMemoria';
import { secao } from './pecas';

const EXTRA = `<style>
.manual h3 { font: 600 10pt "Sans"; margin: 5mm 0 1.6mm; break-after: avoid; }
.manual ul, .manual ol { margin: 0 0 2.2mm; padding-left: 5mm; }
.manual li { margin: 0 0 1mm; }
.manual code { font: 8.6pt "Sans"; background: var(--velado); padding: 0 1mm; border-radius: 0.6mm; }
.manual figure { margin: 3mm 0 4mm; break-inside: avoid; }
/* figura baixa o bastante para caber no resto da página: alta, ela pulava e
   deixava meia página em branco no meio do capítulo */
.manual figure img { display: block; max-width: 100%; max-height: 80mm; margin: 0 auto; border: 0.4pt solid var(--traco); }
.manual h3 { break-after: avoid; }
.manual figcaption { font-size: 8pt; color: var(--grafite); text-align: center; margin-top: 1.6mm; }
.manual td, .manual th { white-space: normal; text-align: left; vertical-align: top; }
/* A capa igual à da PLS Calc (pedido dele, 04/11/2026): as peças da capa da
   memória, o Conteúdo em duas colunas, e a logo dele pequena à direita, logo
   acima do quadro de autor, versão e data — só na capa do manual. */
.capa .indice { grid-template-columns: 1fr 1fr; }
.capa-logo { margin-top: auto; display: flex; justify-content: flex-end; margin-bottom: 3mm; }
.capa-logo img { height: 13mm; width: auto; }
.capa-logo + .carimbo { margin-top: 0; }
</style>`;

/**
 * Os símbolos da norma com o índice rebaixado, como na memória: NSd → N com
 * "Sd" embaixo. Lista fechada e só palavra inteira — "bf" dentro de uma
 * palavra, ou o "Me" de uma frase, não viram símbolo por acaso.
 */
const SIMBOLOS: [string, string, string][] = [
  ['Nc,Rd,dist', 'N', 'c,Rd,dist'], ['Mx,Rd,dist', 'M', 'x,Rd,dist'], ['MRd,dist', 'M', 'Rd,dist'],
  ['Nc,Rd', 'N', 'c,Rd'], ['Nt,Rd', 'N', 't,Rd'], ['Mx,Rd', 'M', 'x,Rd'], ['My,Rd', 'M', 'y,Rd'], ['Mx,Sd', 'M', 'x,Sd'], ['My,Sd', 'M', 'y,Sd'],
  ['Vx,Sd', 'V', 'x,Sd'], ['Vy,Sd', 'V', 'y,Sd'], ['Mx,esc', 'M', 'x,esc'], ['My,esc', 'M', 'y,esc'], ['Mx,FLT', 'M', 'x,FLT'],
  ['Nc,dist', 'N', 'c,dist'], ['bef,1', 'b', 'ef,1'], ['bef,2', 'b', 'ef,2'],
  ['NSd', 'N', 'Sd'], ['VRd', 'V', 'Rd'], ['MRd', 'M', 'Rd'], ['Wxef', 'W', 'x,ef'], ['Ixef', 'I', 'x,ef'], ['Wef', 'W', 'ef'],
  ['Ndist', 'N', 'dist'], ['Mdist', 'M', 'dist'], ['Ney', 'N', 'ey'], ['Nez', 'N', 'ez'], ['bef1', 'b', 'ef1'], ['bef2', 'b', 'ef2'],
  ['bef', 'b', 'ef'], ['bcef', 'b', 'c,ef'], ['λp', 'λ', 'p'], ['KxLx', 'K', 'x'], ['KyLy', 'K', 'y'], ['KzLz', 'K', 'z'],
  ['fy', 'f', 'y'], ['fu', 'f', 'u'], ['bw', 'b', 'w'], ['bf', 'b', 'f'], ['ri', 'r', 'i'], ['rm', 'r', 'm'], ['bc', 'b', 'c'], ['bt', 'b', 't'],
  ['Ix', 'I', 'x'], ['Iy', 'I', 'y'], ['I2', 'I', '2'], ['Cb', 'C', 'b'], ['Cw', 'C', 'w'], ['Me', 'M', 'e'], ['Ne', 'N', 'e'], ['r0', 'r', '0'], ['x0', 'x', '0'],
];
// Os símbolos só têm letras, dígitos e vírgula: entram na expressão sem escape.
const RE_SIMBOLO = new RegExp(`(?<![\\p{L}\\d,.])(${SIMBOLOS.map(([s]) => s).join('|')})(?![\\p{L}\\d])`, 'gu');
const DE: Record<string, string> = Object.fromEntries(
  SIMBOLOS.map(([s, b, i]) => {
    const base = `<i>${b}</i><sub>${i}</sub>`;
    // KxLx: o K e o L, cada um com o índice
    return [s, s.startsWith('K') ? `${base}<i>L</i><sub>${i}</sub>` : base];
  }),
);

function simbolos(html: string): string {
  // fora das tags e do código
  return html.split(/(<[^>]+>|<code>[^<]*<\/code>)/).map((p) => (p.startsWith('<') ? p : p.replace(RE_SIMBOLO, (m) => DE[m] ?? m))).join('');
}

/** Negrito, código, os símbolos e o resto escapado. */
function emLinha(s: string): string {
  return simbolos(
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'),
  );
}

/** A data da capa: a do dia em que o PDF é gerado, como na PLS. */
export function manualEmHtml(md: string, imagem: (caminho: string) => string, data = new Date().toLocaleDateString('pt-BR')): string {
  const linhas = md.replace(/\r/g, '').split('\n');
  let titulo = '';
  let subtitulo = '';
  const capitulos: { titulo: string; corpo: string[] }[] = [];
  const corpo = () => capitulos[capitulos.length - 1]?.corpo;
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (l.startsWith('# ')) {
      titulo = l.slice(2);
      i++;
      while (i < linhas.length && !linhas[i].trim()) i++;
      if (i < linhas.length && !linhas[i].startsWith('#')) subtitulo = linhas[i++];
      continue;
    }
    if (l.startsWith('## ')) {
      capitulos.push({ titulo: l.slice(3), corpo: [] });
      i++;
      continue;
    }
    const c = corpo();
    if (!c || !l.trim()) {
      i++;
      continue;
    }
    if (l.startsWith('### ')) {
      c.push(`<h3>${emLinha(l.slice(4))}</h3>`);
      i++;
    } else if (/^!\[/.test(l)) {
      const m = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(l)!;
      c.push(`<figure><img src="${imagem(m[2])}" alt="${esc(m[1])}"><figcaption>${emLinha(m[1])}</figcaption></figure>`);
      i++;
    } else if (l.startsWith('|')) {
      const t: string[][] = [];
      while (i < linhas.length && linhas[i].startsWith('|')) {
        const celulas = linhas[i].split('|').slice(1, -1).map((x) => x.trim());
        if (!celulas.every((x) => /^-+$/.test(x))) t.push(celulas);
        i++;
      }
      const [cab, ...resto] = t;
      c.push(`<table><thead><tr>${cab.map((x) => `<th>${emLinha(x)}</th>`).join('')}</tr></thead><tbody>${resto.map((r) => `<tr>${r.map((x) => `<td>${emLinha(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else if (/^(- |\d+\. )/.test(l)) {
      const ordenada = /^\d+\. /.test(l);
      const itens: string[] = [];
      while (i < linhas.length && /^(- |\d+\. |\s{2,}\S)/.test(linhas[i])) {
        const x = linhas[i];
        if (/^\s{2,}\S/.test(x)) itens[itens.length - 1] += ' ' + x.trim();
        else itens.push(x.replace(/^(- |\d+\. )/, ''));
        i++;
      }
      const tag = ordenada ? 'ol' : 'ul';
      c.push(`<${tag}>${itens.map((x) => `<li>${emLinha(x)}</li>`).join('')}</${tag}>`);
    } else {
      const p: string[] = [];
      while (i < linhas.length && linhas[i].trim() && !/^(#|!\[|\||- |\d+\. )/.test(linhas[i])) p.push(linhas[i++]);
      c.push(`<p>${emLinha(p.join(' '))}</p>`);
    }
  }
  // O Conteúdo em duas colunas, lido de cima para baixo: 1 a 4 à esquerda.
  const metade = Math.ceil(capitulos.length / 2);
  const celulas: string[] = [];
  for (let k = 0; k < metade; k++) {
    for (const j of [k, k + metade]) celulas.push(j < capitulos.length ? `<span><span class="n">${j + 1}</span>${emLinha(capitulos[j].titulo)}</span>` : '<span></span>');
  }
  const [nome, resto] = titulo.split(' — ');
  const capa =
    `<section class="capa">` +
    `<div class="capa-topo"><span class="marca">PFF Calc · NBR 14762</span><span>${esc(resto ?? 'Manual do usuário')}</span></div>` +
    `<h1>${emLinha(nome)}</h1>` +
    `<p class="subtitulo">${emLinha(subtitulo)}</p>` +
    `<div class="indice-titulo">Conteúdo</div><div class="indice">${celulas.join('')}</div>` +
    `<div class="capa-logo"><img src="${imagem('imagens/logo-autor.png')}" alt=""></div>` +
    `<div class="carimbo">` +
    `<div><span class="rot">Autor</span><span class="forte">José Barbalho</span></div>` +
    `<div><span class="rot">Versão</span>PFF Calc ${VERSAO}</div>` +
    `<div><span class="rot">Data</span>${esc(data)}</div>` +
    `</div></section>`;
  const miolo = capitulos.map((k, n) => secao(n + 1, emLinha(k.titulo), k.corpo.join(''))).join('');
  return (
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    `<title>${esc(titulo)}</title>` +
    estiloDaMemoria({ obra: 'PFF Calc · NBR 14762', documento: 'Manual do usuário', revisao: VERSAO, versao: VERSAO, rodape: `PFF Calc ${VERSAO} · NBR 14762`, rodapeMeio: 'proestruturas3d.com.br', rotuloRevisao: 'versão' }) +
    EXTRA +
    `</head><body class="manual">${capa}${miolo}</body></html>`
  );
}
