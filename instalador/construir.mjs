// ═══════════════════════════════════════════════════════════════════════════
//  instalador/construir.mjs — do código ao "PFF Calc Setup x.y.z.exe"
//  Uso: npm run instalador
// ---------------------------------------------------------------------------
//  1. o build de produção do Vite (dist/);
//  2. uma pasta de montagem só com o que o programa precisa (o build, a
//     janela, a ponte, o config e o ícone) e um package.json sem
//     dependências — o build do Vite já traz tudo dentro; levar o
//     node_modules inteiro só engordaria o instalador;
//  3. o termo de responsabilidade, em texto, para a tela de licença;
//  4. o electron-builder com o instalador NSIS, por usuário, sem pedir
//     administrador.
//
//  A saída vai para instalador/saida/ (fora do git). A PLS Calc copia esta
//  pasta e troca config.json e icone.ico.
// ═══════════════════════════════════════════════════════════════════════════

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const SAIDA = join(AQUI, 'saida');
const MONTAGEM = join(SAIDA, 'montagem');
const exigir = createRequire(import.meta.url);

const config = JSON.parse(readFileSync(join(AQUI, 'config.json'), 'utf-8'));
const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf-8'));
const versaoDoElectron = exigir('electron/package.json').version;

// 1. build
execSync('npm run build', { cwd: RAIZ, stdio: 'inherit' });

// 2. montagem
rmSync(SAIDA, { recursive: true, force: true });
mkdirSync(MONTAGEM, { recursive: true });
cpSync(join(RAIZ, 'dist'), join(MONTAGEM, 'dist'), { recursive: true });
for (const f of ['principal.cjs', 'ponte.cjs', 'config.json', config.icone]) cpSync(join(AQUI, f), join(MONTAGEM, f));
writeFileSync(
  join(MONTAGEM, 'package.json'),
  JSON.stringify({ name: config.pacote, productName: config.nome, version: pacote.version, description: config.descricao, author: config.autor, license: pacote.license, main: 'principal.cjs' }, null, 2),
);

// 3. o termo, do Markdown para texto corrido (a tela de licença do NSIS não
//    lê Markdown). ⚠️ UTF-8 COM BOM: sem ele o NSIS lê os acentos como
//    Windows-1252 e o termo sai com "Ã©" no lugar de "é".
//    As linhas quebradas no meio do parágrafo (o Markdown é escrito a 90
//    colunas) são juntadas: a caixa do NSIS quebra sozinha, e a quebra fixa
//    deixava "ferramenta" sozinha no fim de uma linha curta.
const termo = readFileSync(resolve(AQUI, config.termo), 'utf-8')
  .replace(/\r\n/g, '\n')
  .replace(/\*\*/g, '')
  .replace(/`/g, '')
  .replace(/^#+\s*/gm, '')
  .replace(/\n {2,}/g, ' ') // continuação de item de lista
  .replace(/([^\n])\n(?!\n|- )/g, '$1 ') // continuação de parágrafo
  .replace(/\n/g, '\r\n');
writeFileSync(join(SAIDA, 'termo.txt'), String.fromCharCode(0xfeff) + termo, 'utf-8');

// O NSIS do electron-builder só instala por usuário sem perguntar se o
// modo for forçado aqui; sem isto, o instalador assistido oferece "para
// todos os usuários", que pede administrador.
//
// ⚠️ A CÓPIA DO INSTALADOR: o NSIS do electron-builder guarda o instalador
// inteiro (~120 MB) em %LOCALAPPDATA%\<pacote>-updater, para a atualização
// automática. Sem atualização automática, ela só ocupa disco e sobrava depois
// de desinstalar: apagada ao fim da instalação e na desinstalação.
const atualizador = `$LOCALAPPDATA\\${config.pacote}-updater`;
const nsh = [
  '!macro customInstallMode',
  '  StrCpy $isForceCurrentInstall "1"',
  '!macroend',
  '!macro customInstall',
  `  RMDir /r "${atualizador}"`,
  '!macroend',
  '!macro customUnInstall',
  `  RMDir /r "${atualizador}"`,
  '!macroend',
  '',
];
writeFileSync(join(SAIDA, 'por-usuario.nsh'), nsh.join('\r\n'), 'utf-8');

// 4. o instalador
const { Arch, build, Platform } = await import('electron-builder');
await build({
  targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
  projectDir: MONTAGEM,
  config: {
    appId: config.appId,
    productName: config.nome,
    copyright: `© ${new Date().getFullYear()} ${config.autor}`,
    electronVersion: versaoDoElectron,
    directories: { output: SAIDA },
    files: ['**/*'],
    asar: true,
    npmRebuild: false,
    win: { icon: join(MONTAGEM, config.icone), target: 'nsis' },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowElevation: false,
      allowToChangeInstallationDirectory: false,
      license: join(SAIDA, 'termo.txt'),
      include: join(SAIDA, 'por-usuario.nsh'),
      installerIcon: join(MONTAGEM, config.icone),
      uninstallerIcon: join(MONTAGEM, config.icone),
      createDesktopShortcut: 'always',
      createStartMenuShortcut: true,
      shortcutName: config.nome,
      uninstallDisplayName: config.nome,
      // desinstalar apaga também o guardado (última entrada, tema,
      // projetista); numa atualização por cima, o guardado fica
      deleteAppDataOnUninstall: true,
      artifactName: `${config.nome} Setup ${pacote.version}.exe`,
    },
    publish: null,
  },
});

rmSync(MONTAGEM, { recursive: true, force: true });
console.log(`\nPronto: ${join(SAIDA, `${config.nome} Setup ${pacote.version}.exe`)}`);
