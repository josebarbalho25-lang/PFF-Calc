// ═══════════════════════════════════════════════════════════════════════════
//  instalador/ponte.cjs — o que a página enxerga do programa instalado
// ---------------------------------------------------------------------------
//  Quatro portas, e só elas: imprimir a memória em PDF, perguntar onde salvar,
//  gravar no lugar escolhido e pintar os botões do Windows no cabeçalho. A
//  página testa `window.programa`: existe no instalado, não existe no
//  navegador (aí o PDF vai pelo servidor do Vite).
// ═══════════════════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('programa', {
  imprimirPdf: (html) => ipcRenderer.invoke('pdf:imprimir', html),
  ondeSalvar: (nome) => ipcRenderer.invoke('pdf:onde-salvar', nome),
  gravar: (senha, bytes) => ipcRenderer.invoke('pdf:gravar', senha, bytes),
  // a cor e a altura dos botões do Windows no cabeçalho (ui/barraDaJanela.ts)
  barraDaJanela: (b) => ipcRenderer.send('janela:barra', b),
});
