// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/estiloRelatorio.ts — a cara da memória: o CSS do relatório do A-PORT
// ---------------------------------------------------------------------------
//  Trazido de `Pórtico Estrutural/src/relatorio/pagina/estilo.ts` (o desenho
//  é dele: serifa nos títulos, a coluna das referências da norma à esquerda,
//  o carimbo na capa) com as peças que a memória do perfil acrescenta — o
//  corte da seção e a linha de verificação. Documento para imprimir: papel
//  branco e tinta escura em qualquer tema da tela.
//
//  ⚠️ A PÁGINA É A4 COM AS MARGENS DA PRÓPRIA FOLHA (`@page` e as caixas de
//  margem com "página / total"). Quem imprime é o Edge da máquina, sem
//  cabeçalho nem rodapé dele (scripts/servidorDePdf.ts).
//
//  ⚠️ AS FONTES SÃO RELATIVAS (`fontes/…`): no PDF o servidor põe o `<base>`
//  em `public/relatorio/`; na prévia da tela, o `<base>` é `/relatorio/`.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Texto seguro dentro de `content: "…"` do CSS das margens. O "<" e o ">"
 * saem escapados: o nome da obra com "</style>" fecharia o estilo.
 */
function css(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\3C ').replace(/>/g, '\\3E ').replace(/[\r\n]+/g, ' ');
}

const FONTES = `
@font-face { font-family: "Sans"; src: url("fontes/SourceSans3-Regular.ttf"); font-weight: 400; font-style: normal; }
@font-face { font-family: "Sans"; src: url("fontes/SourceSans3-Semibold.ttf"); font-weight: 600; font-style: normal; }
@font-face { font-family: "Sans"; src: url("fontes/SourceSans3-It.ttf"); font-weight: 400; font-style: italic; }
@font-face { font-family: "Serif"; src: url("fontes/SourceSerif4Text-Regular.ttf"); font-weight: 400; font-style: normal; }
@font-face { font-family: "Serif"; src: url("fontes/SourceSerif4Text-Semibold.ttf"); font-weight: 600; font-style: normal; }
@font-face { font-family: "Serif"; src: url("fontes/SourceSerif4Text-It.ttf"); font-weight: 400; font-style: italic; }
@font-face { font-family: "Serif Sub"; src: url("fontes/SourceSerif4Subhead-Regular.ttf"); font-weight: 400; }
@font-face { font-family: "Serif Display"; src: url("fontes/SourceSerif4Display-Light.ttf"); font-weight: 300; }
`;

const CORPO = `
:root {
  --tinta: #1B1F24; --grafite: #4E5861; --nevoa: #8A939B; --traco: #D5DADE; --velado: #F3F5F6;
  --ciano: #1F5A94; --ocre: #9A5F08; --alerta: #A4262C; --ref: 30mm; --gap: 6mm;
}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 9.3pt/1.5 "Sans", sans-serif; color: var(--tinta); font-kerning: normal; hyphens: manual; }
p { margin: 0 0 2.2mm; }
i, var { font-style: italic; font-family: "Serif", serif; }
sub, sup { font-size: 70%; line-height: 0; }
.nevoa { color: var(--nevoa); }
.grafite { color: var(--grafite); }

.capa { min-height: 251mm; display: flex; flex-direction: column; break-after: page; }
.capa-topo { display: flex; justify-content: space-between; align-items: baseline; font-size: 8.2pt; color: var(--grafite);
  padding-bottom: 3mm; border-bottom: 0.6pt solid var(--tinta); }
.marca { font: 600 9pt "Serif"; letter-spacing: 0.02em; color: var(--tinta); }
/* 30pt e não os 38pt da irmã 8800: o título daqui é mais comprido e, em duas
   linhas, a capa com 8 verificações e 12 capítulos empurra o carimbo para uma
   página sozinha. */
.capa h1 { font: 300 30pt/1.05 "Serif Display", serif; letter-spacing: -0.012em; margin: 8mm 0 4mm; }
.capa .subtitulo { font: 11pt/1.45 "Serif", serif; color: var(--grafite); max-width: 128mm; margin: 0 0 6mm; }
.ficha { display: grid; grid-template-columns: 1.35fr 1fr; column-gap: 10mm; margin-bottom: 6mm; }
.ficha dl { margin: 0; display: grid; grid-template-columns: 24mm 1fr; row-gap: 1.6mm; }
.ficha dt { color: var(--nevoa); font-size: 8pt; padding-top: 0.5pt; }
.ficha dd { margin: 0; font-size: 9pt; }
.resumo-titulo { font: 13pt "Serif Sub", serif; margin: 0 0 3mm; }
.alertas { margin-top: 4mm; border-left: 1.4pt solid var(--ocre); padding: 1mm 0 1mm 4mm; font-size: 8.8pt; }
.alertas strong { font-weight: 600; color: var(--ocre); display: block; margin-bottom: 0.8mm; }
.alertas ul { margin: 0; padding-left: 4mm; }
.veredito { margin-top: 4mm; font: 11pt "Serif Sub", serif; }
.carimbo { margin-top: auto; padding-top: 0; break-inside: avoid; display: grid; grid-template-columns: 1.45fr 1fr 0.9fr; border: 0.6pt solid var(--tinta); font-size: 8.4pt; }
.carimbo > div { padding: 2.2mm 3mm 2.4mm; border-right: 0.35pt solid var(--traco); border-bottom: 0.35pt solid var(--traco); }
.carimbo > div:nth-child(3n) { border-right: 0; }
.carimbo > div:nth-last-child(-n+3) { border-bottom: 0; }
.carimbo .rot { display: block; font-size: 6.6pt; color: var(--nevoa); margin-bottom: 0.4mm; }
.carimbo .forte { font-weight: 600; }
.carimbo .empresa { font: 600 9.4pt "Serif"; }

.secao { margin-top: 9mm; }
h2 { display: grid; grid-template-columns: var(--ref) 1fr; column-gap: var(--gap); font: 400 15pt/1.2 "Serif Sub", serif;
  margin: 0 0 5mm; padding-bottom: 2.4mm; border-bottom: 0.6pt solid var(--tinta); break-after: avoid; }
h2 .n { color: var(--ciano); }
.passo { display: grid; grid-template-columns: var(--ref) 1fr; column-gap: var(--gap); margin-bottom: 6mm; break-inside: avoid; }
.passo > .ref { font-size: 7.4pt; line-height: 1.35; color: var(--nevoa); padding-top: 0.9mm; }
.passo > .ref .n { display: block; font: 600 8.6pt "Sans"; color: var(--grafite); margin-bottom: 0.8mm; }
h3 { font: 600 9.8pt/1.3 "Sans"; margin: 0 0 2.4mm; break-after: avoid; }
.passo > .conteudo { min-width: 0; }
.passo > .conteudo > :last-child { margin-bottom: 0; }
.sem-quebra { break-inside: avoid; }

.kv { display: grid; grid-template-columns: 50mm 1fr; margin: 0 0 3mm; border-top: 0.35pt solid var(--traco); }
.kv dt, .kv dd { padding: 1.1mm 0; border-bottom: 0.35pt solid var(--traco); }
.kv dt { color: var(--grafite); padding-right: 3mm; }
.kv dd { margin: 0; }

.eq { font: 10pt/1.6 "Serif", serif; font-variant-numeric: lining-nums tabular-nums; margin: 1.2mm 0 2.2mm; padding-left: 5mm;
  display: flex; align-items: center; flex-wrap: wrap; column-gap: 1.6mm; row-gap: 1mm; }
.eq .res { font-weight: 600; }
.eq .lbl { font: 7.6pt "Sans"; color: var(--nevoa); margin-left: auto; padding-left: 3mm; }
.frac { display: inline-flex; flex-direction: column; text-align: center; vertical-align: middle; line-height: 1.25; }
.frac > span:first-child { border-bottom: 0.55pt solid currentColor; padding: 0 0.25em 0.12em; }
.frac > span:last-child { padding: 0.12em 0.25em 0; }
.rad { --traco-raiz: 0.55pt; display: inline-flex; align-items: stretch; vertical-align: middle; line-height: 1.25; margin-left: 0.05em; }
.rad-sinal { position: relative; flex: none; width: 0.6em; }
.rad-sinal svg { position: absolute; left: 0; right: 0; bottom: 0; top: calc(var(--traco-raiz) / 2); width: 100%; height: calc(100% - var(--traco-raiz) / 2);
  overflow: visible; fill: none; stroke: currentColor; stroke-width: var(--traco-raiz); stroke-linejoin: round; }
.raiz { border-top: var(--traco-raiz) solid currentColor; padding: 0.12em 0.1em 0 0.12em; }
.indice { display: grid; grid-template-columns: 1fr 1fr 1fr; column-gap: 8mm; row-gap: 1.2mm; margin: 3mm 0 4mm;
  font-size: 8.8pt; color: var(--grafite); }
.indice-titulo { font: 13pt "Serif Sub", serif; margin: 7mm 0 0; }
.indice .n { display: inline-block; width: 7mm; color: var(--ciano); font-family: "Serif"; }

table { width: 100%; border-collapse: collapse; font-size: 8.4pt; line-height: 1.35; font-variant-numeric: lining-nums tabular-nums; margin: 0 0 2mm; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { white-space: nowrap; font-weight: 600; color: var(--grafite); text-align: right; vertical-align: bottom; padding: 0 0 1.4mm 2.5mm;
  border-bottom: 0.6pt solid var(--tinta); }
th .un { display: block; font-weight: 400; color: var(--nevoa); font-size: 7.2pt; }
td { text-align: right; padding: 1mm 0 1mm 2.5mm; border-bottom: 0.3pt solid var(--traco); white-space: nowrap; }
th:first-child, td:first-child { text-align: left; padding-left: 0; }
td.txt, th.txt { text-align: left; white-space: normal; }
tr.governa td { background: #EAF0F6; }
tbody tr:last-child td { border-bottom-color: var(--nevoa); }
.nota-tab { font-size: 7.4pt; color: var(--nevoa); margin: 0 0 3mm; }

.st { font-weight: 600; white-space: nowrap; }
.st-atende { color: var(--ciano); }
.st-avaliar { color: var(--ocre); }
.st-naoAtende { color: var(--alerta); }

.verif { display: flex; align-items: baseline; gap: 4mm; margin-top: 1mm; padding: 1.6mm 0 0 5mm; border-top: 0.35pt solid var(--traco); }
.verif .eq { margin: 0; padding: 0; }

.secao-e-props { display: grid; grid-template-columns: 76mm 1fr; column-gap: 6mm; align-items: start; }
svg.secao-perfil { width: 76mm; height: auto; display: block; }
.sec-corpo { fill: #E6EAED; stroke: var(--tinta); stroke-width: 1.1; }
.sec-corpo.emendado { stroke-width: 2.2; }
.sec-miolo { fill: #E6EAED; stroke: none; }
.sec-cota, .sec-traco { stroke: var(--grafite); stroke-width: 0.6; }
.sec-chamada { stroke: var(--nevoa); stroke-width: 0.45; }
.sec-eixo { stroke: var(--ciano); stroke-width: 0.5; stroke-dasharray: 8 3 2 3; }
.sec-texto-cota { font: 12px "Sans"; fill: var(--tinta); }
.sec-texto-cota .simbolo { font-family: "Serif"; font-style: italic; }
.sec-texto-cota .indice { font-size: 9px; }
.sec-texto-eixo { font: italic 13px "Serif"; fill: var(--ciano); }
.sec-marca-g { fill: var(--tinta); }
.sec-marca-ct circle { fill: #fff; stroke: var(--tinta); stroke-width: 0.8; }
.sec-marca-ct line { stroke: var(--tinta); stroke-width: 0.6; }
svg.curva { width: 100%; max-width: 130mm; height: auto; display: block; margin: 1mm 0 2mm; }
.curva-grade { stroke: var(--traco); stroke-width: 0.5; }
.curva-moldura { fill: none; stroke: var(--grafite); stroke-width: 0.6; }
.curva-tique { font: 9px "Sans"; fill: var(--grafite); }
.curva-eixo { font: italic 10px "Serif"; fill: var(--grafite); }
.curva-linha { fill: none; stroke: var(--ciano); stroke-width: 1.2; }
.curva-min { fill: #fff; stroke-width: 1.1; stroke: var(--nevoa); }
.curva-min.local { stroke: var(--ciano); }
.curva-min.distorcional { stroke: var(--ocre); }
.curva-min-txt { font: 9px "Sans"; fill: var(--tinta); }
.props-tab td:nth-child(odd) { text-align: left; padding-left: 4mm; color: var(--grafite); }
.props-tab td:first-child { padding-left: 0; }
.secao.anexo { break-before: page; margin-top: 0; }
.glossario td { vertical-align: baseline; }
.glossario td:nth-child(1) { width: 22mm; font: 10pt "Serif", serif; }
.glossario td:nth-child(2) { text-align: left; white-space: normal; }
.glossario td:nth-child(2) i { font-family: "Serif", serif; }
.glossario td:nth-child(3) { width: 16mm; color: var(--nevoa); }

.fecho { break-inside: avoid; }
.assinatura { margin-top: 14mm; width: 80mm; border-top: 0.6pt solid var(--tinta); padding-top: 1.6mm; font-size: 8.4pt; break-inside: avoid; }
.assinatura .forte { font-weight: 600; display: block; }
`;

export interface MargensDaFolha {
  obra: string;
  documento: string;
  revisao: string;
  versao: string;
  /** O pé da folha à esquerda; sem isto, o da memória. */
  rodape?: string;
  /** O pé da folha no meio (o site, no manual); sem isto, vazio. */
  rodapeMeio?: string;
  /** O rótulo antes da revisão no alto à direita: "rev." na memória, "versão" no manual. */
  rotuloRevisao?: string;
}

/** O `<style>` inteiro, com as margens da folha escritas com os dados do documento. */
export function estiloDaMemoria(m: MargensDaFolha): string {
  const cinza = 'font: 7.4pt "Sans"; color: #8A939B;';
  const margens = `
@page {
  size: A4;
  margin: 25mm 18mm 20mm 22mm;
  @top-left { content: "${css(m.obra)}"; ${cinza} vertical-align: bottom; padding-bottom: 5mm; }
  @top-right { content: "${css(m.documento)}\\2003${css(m.rotuloRevisao ?? 'rev.')} ${css(m.revisao)}"; ${cinza} vertical-align: bottom; padding-bottom: 5mm; }
  @bottom-left { content: "${css(m.rodape ?? `PFF Calc ${m.versao} · NBR 14762`)}"; ${cinza} vertical-align: top; padding-top: 5mm; }
  ${m.rodapeMeio ? `@bottom-center { content: "${css(m.rodapeMeio)}"; ${cinza} vertical-align: top; padding-top: 5mm; }` : ''}
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.4pt "Sans"; color: #4E5861; vertical-align: top; padding-top: 5mm; }
}
@page :first { @top-left { content: none; } @top-right { content: none; } }
`;
  return `<style>${FONTES}${margens}${CORPO}</style>`;
}
