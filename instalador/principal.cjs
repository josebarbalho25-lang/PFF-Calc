// ═══════════════════════════════════════════════════════════════════════════
//  instalador/principal.cjs — o programa instalado: uma janela com o build
//  de produção do Vite, sem servidor e sem internet
// ---------------------------------------------------------------------------
//  Os dados que mudam de uma calculadora para a outra (nome, título, ícone)
//  moram em config.json, ao lado deste arquivo. A PLS Calc copia a pasta e
//  troca só o config.json e o ícone.
//
//  ⚠️ A PÁGINA É SERVIDA POR UM ENDEREÇO PRÓPRIO (app://calc/), NÃO POR
//  file://. Por file:// os caminhos que começam em "/" (o glifo, as fontes da
//  memória) apontariam para a raiz do disco, e o navegador trata cada arquivo
//  como uma origem à parte — o que fica guardado (última entrada, tema,
//  projetista) podia não voltar. Com um endereço fixo, a origem é sempre a
//  mesma e o guardado mora na pasta do usuário (%APPDATA%\<nome>).
//
//  ⚠️ O PDF É IMPRESSO AQUI (printToPDF), numa janela escondida, com a mesma
//  regra de impressão da memória (A4 e margens no CSS). A versão de navegador
//  continua imprimindo pelo Edge, no servidor do Vite.
//
//  ⚠️ LINK EXTERNO VAI PARA O NAVEGADOR PADRÃO. Dentro do programa, um site
//  alheio rodaria com a mesma ponte que grava arquivos.
// ═══════════════════════════════════════════════════════════════════════════

const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } = require('electron');
const { randomUUID } = require('node:crypto');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const CONFIG = require('./config.json');
const ESQUEMA = 'app';
const HOSPEDEIRO = 'calc';
const ORIGEM = `${ESQUEMA}://${HOSPEDEIRO}`;
const DIST = path.join(__dirname, 'dist');

protocol.registerSchemesAsPrivileged([{ scheme: ESQUEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

// As memórias a imprimir, servidas em app://calc/relatorio/… para que as
// fontes relativas (fontes/…) resolvam como na prévia da tela.
const memorias = new Map();

function servir(pedido) {
  const url = new URL(pedido.url);
  if (url.host !== HOSPEDEIRO) return new Response(null, { status: 404 });
  const caminho = decodeURIComponent(url.pathname);
  const memoria = memorias.get(caminho);
  if (memoria !== undefined) return new Response(memoria, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const arquivo = path.normalize(path.join(DIST, caminho === '/' ? 'index.html' : caminho));
  // nada fora da pasta do build
  if (!arquivo.startsWith(DIST + path.sep)) return new Response(null, { status: 403 });
  return net.fetch(pathToFileURL(arquivo).href);
}

function deFora(url) {
  return /^https?:\/\//i.test(url) && !url.startsWith(ORIGEM);
}

function criarJanela() {
  const janela = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: CONFIG.titulo,
    icon: path.join(__dirname, CONFIG.icone),
    backgroundColor: '#1b1c20',
    show: false,
    // Sem a barra de título branca do Windows (pedido dele, igual ao Pró-Viga
    // 3D): os botões minimizar, maximizar e fechar são desenhados por cima do
    // cabeçalho da calculadora, que vira a área de arrastar (calculadora.css).
    // A cor e a altura certas chegam da página (janela:barra) a cada tema.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#17171b', symbolColor: '#e8e8ee', height: 49 },
    webPreferences: {
      preload: path.join(__dirname, 'ponte.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // o visualizador de PDF da janela da memória
      plugins: true,
    },
  });
  janela.on('page-title-updated', (ev) => ev.preventDefault());
  janela.once('ready-to-show', () => janela.show());
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (deFora(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (ev, url) => {
    if (url.startsWith(ORIGEM)) return;
    ev.preventDefault();
    if (deFora(url)) shell.openExternal(url);
  });
  janela.loadURL(`${ORIGEM}/`);
  return janela;
}

// ── a ponte com a página ────────────────────────────────────────────────────

// Só grava onde a caixa "Salvar como" respondeu: a página recebe uma senha,
// não um caminho livre.
const destinos = new Map();

ipcMain.handle('pdf:onde-salvar', async (ev, nome) => {
  const dono = BrowserWindow.fromWebContents(ev.sender);
  const r = await dialog.showSaveDialog(dono, {
    title: 'Salvar a memória em PDF',
    defaultPath: path.join(app.getPath('documents'), String(nome || 'memoria.pdf')),
    filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const senha = randomUUID();
  destinos.set(senha, r.filePath);
  return senha;
});

ipcMain.handle('pdf:gravar', async (_ev, senha, bytes) => {
  const destino = destinos.get(senha);
  destinos.delete(senha);
  if (!destino) throw new Error('destino desconhecido');
  await writeFile(destino, Buffer.from(bytes));
  return true;
});

ipcMain.on('janela:barra', (ev, b) => {
  const janela = BrowserWindow.fromWebContents(ev.sender);
  if (!janela || !b) return;
  const cor = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined);
  const altura = Math.round(Number(b.height));
  try {
    janela.setTitleBarOverlay({ color: cor(b.color), symbolColor: cor(b.symbolColor), height: altura >= 24 && altura <= 120 ? altura : undefined });
  } catch {
    // fora do Windows não há sobreposição
  }
});

// Uma impressão por vez, como no servidor do Vite.
let fila = Promise.resolve();
ipcMain.handle('pdf:imprimir', (_ev, html) => {
  const vez = fila.then(() => imprimir(String(html)));
  fila = vez.catch(() => undefined);
  return vez;
});

async function imprimir(html) {
  const caminho = `/relatorio/__memoria-${randomUUID()}.html`;
  memorias.set(caminho, html);
  const folha = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  try {
    await folha.loadURL(`${ORIGEM}${caminho}`);
    // as fontes da memória têm de estar carregadas antes de imprimir
    await folha.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true).catch(() => true);
    const pdf = await folha.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
    return new Uint8Array(pdf);
  } finally {
    memorias.delete(caminho);
    folha.destroy();
  }
}

// ── o programa ──────────────────────────────────────────────────────────────

// Dois cliques no atalho com o programa aberto: volta a janela que já existe.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [janela] = BrowserWindow.getAllWindows();
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle(ESQUEMA, servir);
    criarJanela();
  });
  app.on('window-all-closed', () => app.quit());
}
