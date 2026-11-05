# Instalador do PFF Calc

`npm run instalador` gera `instalador/saida/PFF Calc Setup <versão>.exe`, que fica fora do git.

## O que sai

- Um instalador NSIS por usuário, que não pede administrador e instala em
  `%LOCALAPPDATA%\Programs\<nome>`.
- A tela de licença mostra o `TERMO-DE-RESPONSABILIDADE.md` da raiz, com aceite. É o
  mesmo termo do `ABRIR.bat`.
- Atalhos no menu Iniciar e na área de trabalho.
- O desinstalador apaga também o que o programa guarda (última entrada, tema,
  projetista), em `%APPDATA%\<nome>`.
- O programa abre o build de produção do Vite numa janela própria (Electron), sem
  servidor, sem internet e sem Node na máquina do usuário.
- O PDF da memória sai pelo `printToPDF` do próprio programa, e a caixa "Salvar como" é
  a do Windows.
- Os links externos abrem no navegador padrão.
- Não há atualização automática.

## Arquivos

| Arquivo | O que é |
| --- | --- |
| `config.json` | nome, título da janela, descrição, appId, nome do pacote, ícone, termo, autor |
| `icone.ico` | o ícone do programa, do instalador e dos atalhos |
| `principal.cjs` | a janela, o endereço `app://calc/`, o PDF e os links externos |
| `ponte.cjs` | o que a página enxerga do programa (`window.programa`) |
| `construir.mjs` | build do Vite → montagem → termo em texto → electron-builder |

A página só muda num lugar: `src/relatorio/exportarPdf.ts` usa `window.programa` quando
ele existe; sem ele, segue pelo servidor do Vite, como no navegador.

## Para a PLS Calc

1. Copie a pasta `instalador/` inteira.
2. Troque o `config.json` (nome "PLS Calc", título "PLS Calc · NBR 8800", appId, pacote)
   e o `icone.ico`.
3. Copie o trecho de `window.programa` de `src/relatorio/exportarPdf.ts` para o
   exportador de PDF dela.
4. No `package.json`, ponha o script `"instalador": "node instalador/construir.mjs"` e
   instale, como devDependencies, `electron` e `electron-builder`.
5. Ponha `instalador/saida/` no `.gitignore`.

## Cuidados

- **Versão:** a versão é a do `package.json`. Mude lá antes de gerar.
- **Sem assinatura digital:** o instalador não tem certificado, e o Windows pode avisar
  "editor desconhecido" na primeira vez que for aberto depois de baixado.
- **Cópia do instalador:** o electron-builder guarda uma cópia do instalador (~120 MB)
  em `%LOCALAPPDATA%\<pacote>-updater`, para atualização automática. Como aqui não há
  atualização automática, o `por-usuario.nsh` gerado apaga essa pasta ao instalar e ao
  desinstalar.
