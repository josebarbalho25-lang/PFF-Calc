// ═══════════════════════════════════════════════════════════════════════════
//  ui/barraDaJanela.ts — no programa instalado, os botões do Windows
//  (minimizar, maximizar, fechar) moram dentro do cabeçalho, na cor do tema
// ---------------------------------------------------------------------------
//  Pedido dele (04/11/2026), igual ao Pró-Viga 3D: a barra de título branca
//  do Windows sai e o cabeçalho escuro vai até o alto da janela. O programa
//  (instalador/principal.cjs) desenha os três botões por cima do cabeçalho;
//  aqui a página diz a cor e a altura deles, a cada troca de tema.
//
//  ⚠️ A ALTURA É A DO CABEÇALHO SEM A LINHA DE BAIXO (clientHeight): com a
//  linha, os botões cobririam o fio que separa o cabeçalho das colunas.
//
//  No navegador `window.programa` não existe e nada disto roda.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { usarTema } from './tema';

interface ProgramaComBarra {
  barraDaJanela?: (b: { color: string; symbolColor: string; height: number }) => void;
}

const programa = () => (typeof window === 'undefined' ? undefined : (window as unknown as { programa?: ProgramaComBarra }).programa);

/** rgb(23, 23, 27) → #17171b: o Electron quer a cor em hexadecimal. */
function hex(cor: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(cor);
  return m ? '#' + m.slice(1, 4).map((c) => Number(c).toString(16).padStart(2, '0')).join('') : cor;
}

export function usarBarraDaJanela(): void {
  const tema = usarTema();
  useEffect(() => {
    const p = programa();
    if (!p?.barraDaJanela) return;
    // a marca no <html>: as regras de arrastar e a folga dos botões (calculadora.css)
    document.documentElement.classList.add('programa');
    const topo = document.querySelector<HTMLElement>('.topbar');
    if (!topo) return;
    const estilo = getComputedStyle(topo);
    const tinta = getComputedStyle(document.body).getPropertyValue('--ink').trim() || estilo.color;
    p.barraDaJanela({ color: hex(estilo.backgroundColor), symbolColor: hex(tinta), height: topo.clientHeight });
  }, [tema]);
}
