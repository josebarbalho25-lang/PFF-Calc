// ═══════════════════════════════════════════════════════════════════════════
//  scripts/servidorDePdf.ts — a rota /pdf: a memória vai ao Edge e volta PDF
// ---------------------------------------------------------------------------
//  O mesmo caminho do A-PORT (`solver/imprimir_pdf.py`), trazido para dentro
//  do servidor do Vite: aqui não há motor em Python de pé, e o servidor da
//  página já está rodando. A memória é um HTML com a regra de impressão
//  inteira no CSS (A4, margens, "página / total" nas margens da folha); quem
//  sabe imprimir isso fielmente é o próprio motor do Chrome, que o Edge do
//  Windows já traz. Nada a instalar.
//
//  ⚠️ UM PERFIL DE NAVEGADOR POR IMPRESSÃO, numa pasta temporária. Com o Edge
//  dele aberto, o processo novo entregaria o pedido à janela de pé e sairia
//  sem imprimir nada.
//
//  ⚠️ SEM CABEÇALHO E RODAPÉ DO NAVEGADOR (`--no-pdf-header-footer`): eles
//  poriam o endereço do arquivo temporário e a data por cima do carimbo.
//
//  ⚠️ AS FONTES SÃO RELATIVAS na página (`fontes/…`): aqui ela ganha um
//  `<base>` apontando para `public/relatorio/` no disco.
// ═══════════════════════════════════════════════════════════════════════════

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';

const NAVEGADORES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

const TEMPO_MAXIMO_MS = 120_000;

function navegador(): string | null {
  return NAVEGADORES.find((c) => existsSync(c)) ?? null;
}

/** O primeiro `<base>` da página é o que vale — este entra logo depois do `<head>`. */
function comBase(html: string, pasta: string): string {
  const base = `<base href="${pathToFileURL(pasta).href}/">`;
  const i = html.indexOf('<head>');
  return i >= 0 ? html.slice(0, i + 6) + base + html.slice(i + 6) : base + html;
}

/** Memória com folga: a de um perfil passa pouco de 60 kB. */
const CORPO_MAXIMO = 8 * 1024 * 1024;

function lerCorpo(req: IncomingMessage): Promise<string> {
  return new Promise((ok, falha) => {
    const partes: Buffer[] = [];
    let total = 0;
    req.on('data', (p: Buffer) => {
      total += p.length;
      if (total > CORPO_MAXIMO) {
        req.destroy();
        falha(new Error('página grande demais para imprimir'));
        return;
      }
      partes.push(p);
    });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf-8')));
    req.on('error', falha);
  });
}

/**
 * ⚠️ SÓ A PRÓPRIA CALCULADORA MANDA IMPRIMIR. Sem esta trava, qualquer site
 * aberto no navegador podia postar uma página em localhost:5180 e fazer a
 * máquina abrir um Edge invisível com o conteúdo dele, quantas vezes quisesse
 * (achado da revisão de 01/11/2026). Dois portões: o pedido tem de dizer que
 * é JSON — o que um site alheio só consegue pedindo licença ao servidor
 * antes, e aqui a licença não é dada — e, se vier com origem, a origem tem de
 * ser este mesmo servidor.
 */
function pedidoDaPropriaPagina(req: IncomingMessage): boolean {
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return false;
  const origem = req.headers.origin;
  if (!origem) return true;
  try {
    return new URL(origem).host === req.headers.host;
  } catch {
    return false;
  }
}

/** Uma impressão por vez: dez pedidos seguidos não abrem dez Edges. */
let fila: Promise<unknown> = Promise.resolve();
function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const vez = fila.then(tarefa, tarefa);
  fila = vez.catch(() => undefined);
  return vez;
}

function rodar(exe: string, args: string[]): Promise<void> {
  return new Promise((ok) => {
    const p = spawn(exe, args, { windowsHide: true, stdio: 'ignore' });
    const relogio = setTimeout(() => p.kill(), TEMPO_MAXIMO_MS);
    p.on('exit', () => {
      clearTimeout(relogio);
      ok();
    });
    p.on('error', () => {
      clearTimeout(relogio);
      ok();
    });
  });
}

/** Imprime a página e devolve os bytes do PDF; lança com a frase para a tela. */
export async function imprimirPdf(html: string, pastaDoRelatorio: string): Promise<Buffer> {
  const exe = navegador();
  if (!exe) throw new Error('sem Edge nem Chrome na máquina para imprimir o PDF');
  const pasta = mkdtempSync(join(tmpdir(), 'nbr14762-pdf-'));
  try {
    const entrada = join(pasta, 'memoria.html');
    const saida = join(pasta, 'memoria.pdf');
    writeFileSync(entrada, comBase(html, pastaDoRelatorio), 'utf-8');
    await rodar(exe, [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      `--user-data-dir=${join(pasta, 'perfil')}`,
      '--no-pdf-header-footer',
      `--print-to-pdf=${saida}`,
      pathToFileURL(entrada).href,
    ]);
    if (!existsSync(saida) || statSync(saida).size === 0) throw new Error('o navegador não gerou o PDF');
    return readFileSync(saida);
  } finally {
    // Um processo filho do navegador ainda segura o perfil por um instante.
    // ⚠️ A LIMPEZA É ASSÍNCRONA: com as tentativas, a versão síncrona parava o
    // servidor inteiro (página, recarga) por até um segundo a cada PDF.
    rm(pasta, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {
      /* fica para a limpeza do Windows */
    });
  }
}

function rota(pastaDoRelatorio: string) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end();
      return;
    }
    if (!pedidoDaPropriaPagina(req)) {
      res.statusCode = 403;
      res.end();
      return;
    }
    try {
      const { html } = JSON.parse(await lerCorpo(req)) as { html?: string };
      if (typeof html !== 'string' || !html) throw new Error('página vazia');
      const pdf = await naFila(() => imprimirPdf(html, pastaDoRelatorio));
      res.setHeader('Content-Type', 'application/pdf');
      res.end(pdf);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ erro: (e as Error).message }));
    }
  };
}

/** A rota /pdf no servidor de desenvolvimento e no de pré-visualização. */
export function servidorDePdf(raiz: string): Plugin {
  const pasta = resolve(raiz, 'public', 'relatorio');
  return {
    name: 'servidor-de-pdf',
    configureServer(server) {
      server.middlewares.use('/pdf', rota(pasta));
    },
    configurePreviewServer(server) {
      server.middlewares.use('/pdf', rota(pasta));
    },
  };
}
