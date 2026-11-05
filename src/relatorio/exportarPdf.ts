// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/exportarPdf.ts — a memória vai ao servidor, volta PDF, vai ao disco
// ---------------------------------------------------------------------------
//  O servidor da página (Vite) imprime pelo Edge da máquina na rota /pdf
//  (scripts/servidorDePdf.ts). O PDF volta e vai para a caixa "Salvar como"
//  do Windows, quando o navegador a oferece; sem ela, o download de sempre —
//  o mesmo caminho do A-PORT (`relatorio/salvarPdf.ts`).
//
//  ⚠️ A CAIXA "SALVAR COMO" ABRE ANTES DA IMPRESSÃO. O navegador só deixa
//  abri-la logo depois do clique (uns 5 s); o Edge frio leva perto disso para
//  imprimir, e a caixa pedida depois dava erro de segurança, em inglês, com o
//  PDF perdido (achado da revisão de 01/11/2026). Agora: clique → caixa →
//  imprime → grava. Se a caixa recusar, cai no download.
//
//  ⚠️ NO PROGRAMA INSTALADO (Electron) não há servidor: a página fala com o
//  programa pela ponte `window.programa` (instalador/ponte.cjs) — ele imprime
//  (printToPDF), abre a caixa "Salvar como" do Windows e grava.
//
//  ⚠️ NÃO LANÇA: servidor sem a rota é estado, não exceção — volta a frase
//  para a tela. E cancelar a caixa não é erro: volta calado.
// ═══════════════════════════════════════════════════════════════════════════

interface JanelaComArquivos {
  showSaveFilePicker?: (opcoes: unknown) => Promise<FileSystemFileHandle>;
}

/** A ponte do programa instalado; no navegador, não existe. */
interface Programa {
  imprimirPdf: (html: string) => Promise<Uint8Array>;
  ondeSalvar: (nome: string) => Promise<string | null>;
  gravar: (senha: string, bytes: Uint8Array) => Promise<boolean>;
}
const programa = (): Programa | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { programa?: Programa }).programa);

export type ResultadoDoPdf = { ok: true; gravado: boolean } | { ok: false; erro: string };

/** Pede o PDF ao servidor. `sinal` cancela o pedido que ficou velho. */
export async function imprimirNoServidor(html: string, sinal?: AbortSignal): Promise<Blob | { erro: string }> {
  const p = programa();
  if (p) {
    try {
      const bytes = await p.imprimirPdf(html);
      if (sinal?.aborted) return { erro: 'cancelado' };
      return new Blob([bytes as BlobPart], { type: 'application/pdf' });
    } catch {
      return { erro: 'o PDF não saiu' };
    }
  }
  let resposta: Response;
  try {
    resposta = await fetch('/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
      signal: sinal,
    });
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return { erro: 'cancelado' };
    return { erro: 'o servidor da calculadora não respondeu' };
  }
  if ((resposta.headers.get('Content-Type') ?? '').startsWith('application/pdf')) return await resposta.blob();
  try {
    const bruto = (await resposta.json()) as { erro?: string };
    return { erro: bruto.erro ?? 'o PDF não saiu' };
  } catch {
    return { erro: 'o PDF não saiu' };
  }
}

function baixar(pdf: Blob, nome: string): void {
  const url = URL.createObjectURL(pdf);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  // Revogar cedo demais cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Grava a memória em PDF. `obterPdf` imprime (ou devolve o PDF que a janela
 * já tem) — e só é chamado depois de a caixa "Salvar como" responder.
 */
export async function exportarPdf(obterPdf: () => Promise<Blob | { erro: string }>, nome: string): Promise<ResultadoDoPdf> {
  const p = programa();
  if (p) {
    const senha = await p.ondeSalvar(nome);
    if (!senha) return { ok: true, gravado: false };
    const pdf = await obterPdf();
    if (!(pdf instanceof Blob)) return { ok: false, erro: pdf.erro };
    try {
      await p.gravar(senha, new Uint8Array(await pdf.arrayBuffer()));
      return { ok: true, gravado: true };
    } catch {
      return { ok: false, erro: 'não foi possível gravar o arquivo escolhido' };
    }
  }
  const janela = window as unknown as JanelaComArquivos;
  let alvo: FileSystemFileHandle | null = null;
  if (typeof janela.showSaveFilePicker === 'function') {
    try {
      alvo = await janela.showSaveFilePicker({
        suggestedName: nome,
        types: [{ description: 'Documento PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return { ok: true, gravado: false };
      alvo = null; // caixa recusada pelo navegador: segue pelo download
    }
  }
  const pdf = await obterPdf();
  if (!(pdf instanceof Blob)) return { ok: false, erro: pdf.erro };
  if (!alvo) {
    baixar(pdf, nome);
    return { ok: true, gravado: true };
  }
  try {
    const escrita = await alvo.createWritable();
    await escrita.write(pdf);
    await escrita.close();
    return { ok: true, gravado: true };
  } catch {
    return { ok: false, erro: 'não foi possível gravar o arquivo escolhido' };
  }
}
