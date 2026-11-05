// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/MemoriaCalculo.tsx — a janela da memória: o PDF à esquerda, o
//  carimbo à direita
// ---------------------------------------------------------------------------
//  ⚠️ A JANELA MOSTRA O PDF, NÃO O HTML — como a do relatório do A-PORT: o
//  que se vê é o que sai, com as páginas, as quebras e o "Página X de Y".
//  Enquanto o Edge imprime (uns 2 s), aparece a página corrida em HTML; se o
//  servidor não imprimir, ela fica, e o Imprimir do navegador cobre a saída.
//
//  Mexer no carimbo marca o PDF como velho e reimprime depois de uma pausa
//  na digitação — imprimir a cada tecla enfileiraria um Edge por letra.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResultadoDaVerificacao } from '../motor/norma';
import { guardarIdentificacao, type Identificacao } from '../ui/guardarEntrada';
import { exportarPdf, imprimirNoServidor } from './exportarPdf';
import { nomeDoPdf, paginaDaMemoria } from './paginaDaMemoria';

interface Props {
  resultado: ResultadoDaVerificacao;
  identificacao: Identificacao;
  mudarIdentificacao: (id: Identificacao) => void;
  fechar: () => void;
}

const CAMPOS: Array<[keyof Identificacao, string]> = [
  ['obra', 'Obra'],
  ['cliente', 'Cliente'],
  ['elemento', 'Elemento'],
  ['documento', 'Documento'],
  ['revisao', 'Revisão'],
  ['empresa', 'Empresa'],
];

/** A página corrida para a tela: a folha branca centrada, as fontes de /relatorio/. */
function paraATela(html: string): string {
  const base = `<base href="${location.origin}/relatorio/">`;
  const tela =
    '<style>@media screen { html { background: #50555c; } body { width: 210mm; margin: 10mm auto; padding: 25mm 18mm 20mm 22mm; ' +
    'background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,.45); } .capa { min-height: 0; } }</style>';
  return html.replace('<head>', `<head>${base}`).replace('</head>', `${tela}</head>`);
}

export function MemoriaCalculo({ resultado, identificacao, mudarIdentificacao, fechar }: Props) {
  const html = useMemo(() => paginaDaMemoria(resultado, identificacao), [resultado, identificacao]);
  const [pdf, setPdf] = useState<{ url: string; html: string; blob: Blob } | null>(null);
  const [estado, setEstado] = useState<'imprimindo' | 'pronto' | 'falhou'>('imprimindo');
  const [recado, setRecado] = useState<{ texto: string; erro: boolean } | null>(null);
  const moldura = useRef<HTMLIFrameElement>(null);

  // Reimprime o PDF 700 ms depois da última mudança; a impressão que ficou
  // velha no meio do caminho é cancelada, não só ignorada.
  useEffect(() => {
    const controle = new AbortController();
    setEstado('imprimindo');
    const relogio = setTimeout(async () => {
      const r = await imprimirNoServidor(html, controle.signal);
      if (controle.signal.aborted) return;
      // ⚠️ A URL NASCE AQUI, FORA DO setPdf: no modo estrito o React chama o
      // atualizador duas vezes, e a URL da chamada descartada nunca era
      // liberada — um PDF inteiro perdido na memória a cada pausa na digitação.
      if (r instanceof Blob) {
        setPdf({ url: URL.createObjectURL(r), html, blob: r });
        setEstado('pronto');
      } else setEstado('falhou');
    }, 700);
    return () => {
      controle.abort();
      clearTimeout(relogio);
    };
  }, [html]);

  // Cada PDF novo libera o anterior; o último sai junto com a janela.
  useEffect(() => {
    if (!pdf) return;
    const url = pdf.url;
    return () => URL.revokeObjectURL(url);
  }, [pdf]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [fechar]);

  const pdfEmDia = pdf && pdf.html === html;

  async function exportar() {
    setRecado(null);
    // O PDF que a janela já mostra, se estiver em dia, vai direto: imprimir
    // de novo dobraria a espera.
    const pronto = pdf && pdf.html === html ? pdf.blob : null;
    const r = await exportarPdf(() => (pronto ? Promise.resolve(pronto) : imprimirNoServidor(html)), nomeDoPdf(resultado, identificacao));
    if (!r.ok) setRecado({ texto: r.erro, erro: true });
    else setRecado(r.gravado ? { texto: 'PDF gravado', erro: false } : null);
  }

  function mudar(k: keyof Identificacao, valor: string) {
    const novo = { ...identificacao, [k]: valor };
    mudarIdentificacao(novo);
    guardarIdentificacao(novo);
  }

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className="modal-caixa janela-memoria" role="dialog" aria-label="Memória de cálculo">
        <div className="modal-cabeca">
          <h3>Memória de cálculo</h3>
          <span className={`pilula estado-pdf ${estado}`}>{estado === 'pronto' && pdfEmDia ? 'PDF' : estado === 'falhou' ? 'HTML' : '…'}</span>
          <button type="button" className="btn-icone" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)">
            ✕
          </button>
        </div>
        <div className="memoria-corpo">
          <div className="memoria-previa">
            {pdfEmDia ? (
              <iframe key={pdf.url} title="Memória de cálculo em PDF" src={pdf.url} />
            ) : (
              <iframe ref={moldura} title="Memória de cálculo" srcDoc={paraATela(html)} />
            )}
          </div>
          <div className="memoria-lado">
            <fieldset className="cad-bloco">
              <legend>Carimbo</legend>
              {CAMPOS.map(([k, rotulo]) => (
                <div className="cad-linha linha-texto" key={k}>
                  <label htmlFor={`id-${k}`}>{rotulo}</label>
                  <input id={`id-${k}`} className="campo texto" value={identificacao[k]} onChange={(e) => mudar(k, e.target.value)} />
                </div>
              ))}
            </fieldset>
            <div className="memoria-acoes">
              <button type="button" className="btn-primario" onClick={exportar}>
                Exportar relatório PDF
              </button>
              {estado === 'falhou' && (
                <button type="button" className="btn-fantasma" onClick={() => moldura.current?.contentWindow?.print()}>
                  Imprimir
                </button>
              )}
              {recado && <span className={`recado${recado.erro ? ' erro' : ''}`}>{recado.texto}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
