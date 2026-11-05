// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/ModoDaSecao.tsx — a seção parada e a deformada de um modo,
//  animada (as chapas ondulando no local; a mesa com o enrijecedor girando
//  em volta da dobra no distorcional)
// ---------------------------------------------------------------------------
//  A amplitude oscila com sen(ωt) — é a meia-onda vista de frente, passando
//  por cima e por baixo da posição de equilíbrio. Sem animação (`parado`), o
//  desenho fica no pico, como no papel.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import type { Malha } from '../motor/faixas/malha';
import { escalaDoModo, linhaDeformada } from './desenhoDoModo';

interface Props {
  malha: Malha;
  deslocamentos: Float64Array;
  parado?: boolean;
  largura?: number;
  altura?: number;
}

export function ModoDaSecao({ malha, deslocamentos, parado, largura = 220, altura = 200 }: Props) {
  const [fase, setFase] = useState(Math.PI / 2);
  // Quem pede menos movimento ao sistema (e o print sem janela) vê o modo
  // parado no pico — fotografado no meio da oscilação, sai a seção indeformada.
  const quieto = parado || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (quieto) return;
    let quadro = 0;
    const t0 = performance.now();
    const passo = (agora: number) => {
      setFase(((agora - t0) / 1400) * 2 * Math.PI);
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [quieto]);

  const geo = useMemo(() => {
    const escala = escalaDoModo(malha, deslocamentos);
    const xs = malha.nos.map((p) => p.x);
    const ys = malha.nos.map((p) => p.y);
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);
    const ymin = Math.min(...ys);
    const ymax = Math.max(...ys);
    const tam = Math.max(xmax - xmin, ymax - ymin);
    const folga = 0.28 * tam; // cabe a deformada (18 % do tamanho) com sobra
    const s = Math.min(largura / (xmax - xmin + 2 * folga), altura / (ymax - ymin + 2 * folga));
    const cx = (xmin + xmax) / 2;
    const cy = (ymin + ymax) / 2;
    return { escala, X: (x: number) => largura / 2 + s * (x - cx), Y: (y: number) => altura / 2 - s * (y - cy) };
  }, [malha, deslocamentos, largura, altura]);

  const caminho = (linhas: { x: number; y: number }[][]) =>
    linhas.map((l) => l.map((p, k) => `${k ? 'L' : 'M'} ${geo.X(p.x).toFixed(1)} ${geo.Y(p.y).toFixed(1)}`).join(' ')).join(' ');

  const parada = caminho(malha.faixas.map(({ i, j }) => [malha.nos[i], malha.nos[j]]));
  const deformada = caminho(linhaDeformada(malha, deslocamentos, geo.escala * Math.sin(fase)));

  return (
    <svg className="modo-secao" viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label="Modo de flambagem">
      <path className="modo-parada" d={parada} />
      <path className="modo-deformada" d={deformada} />
    </svg>
  );
}
