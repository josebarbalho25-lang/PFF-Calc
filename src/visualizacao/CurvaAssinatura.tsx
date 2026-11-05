// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/CurvaAssinatura.tsx — a curva do esforço crítico contra o
//  comprimento de meia-onda, com o mínimo local e o distorcional marcados
// ---------------------------------------------------------------------------
//  Só desenha o que `desenhoDaCurva.ts` calculou. Clicar num mínimo escolhe o
//  modo que o desenho da seção deformada mostra.
// ═══════════════════════════════════════════════════════════════════════════

import type { MouseEvent } from 'react';
import type { DesenhoDaCurva, ModoDoMinimo } from './desenhoDaCurva';
import { num } from '../relatorio/formatos';

const ROTULO: Record<ModoDoMinimo, string> = { local: 'local', distorcional: 'distorcional', global: 'global' };

interface Props {
  desenho: DesenhoDaCurva;
  unidade: string;
  escolhido?: number;
  escolher?: (indice: number) => void;
  /** O ponto da curva escolhido fora dos mínimos (índice do L). */
  ponto?: number;
  escolherPonto?: (indiceDoL: number) => void;
}

export function CurvaAssinatura({ desenho: g, unidade, escolhido, escolher, ponto, escolherPonto }: Props) {
  const { area } = g;
  // Clique na área do gráfico: o ponto da curva de abscissa mais próxima.
  const clicar = (ev: MouseEvent<SVGRectElement>) => {
    if (!escolherPonto) return;
    const r = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * g.largura;
    let melhor = -1;
    g.pontos.forEach((p, k) => {
      if (Number.isFinite(p.y) && (melhor < 0 || Math.abs(p.x - x) < Math.abs(g.pontos[melhor].x - x))) melhor = k;
    });
    if (melhor >= 0) escolherPonto(melhor);
  };
  const marcado = ponto !== undefined ? g.pontos[ponto] : undefined;
  return (
    <svg className="curva-assinatura" viewBox={`0 0 ${g.largura} ${g.altura}`} role="img" aria-label="Curva de assinatura">
      {g.eixoY.map((t, i) => (
        <g key={`y${i}`}>
          <line className="curva-grade" x1={area.x0} x2={area.x1} y1={t.y} y2={t.y} />
          <text className="curva-tique" x={area.x0 - 6} y={t.y + 4} textAnchor="end">
            {t.rotulo}
          </text>
        </g>
      ))}
      {g.eixoX.map((t, i) => (
        <g key={`x${i}`}>
          <line className="curva-grade" x1={t.x} x2={t.x} y1={area.y0} y2={area.y1} />
          <text className="curva-tique" x={t.x} y={area.y1 + 16} textAnchor="middle">
            {t.rotulo}
          </text>
        </g>
      ))}
      <text className="curva-eixo" x={area.x1} y={g.altura - 2} textAnchor="end">
        L (cm)
      </text>
      <text className="curva-eixo" x={area.x0 + 6} y={area.y0 + 13}>
        {unidade}
      </text>
      <rect className="curva-moldura" x={area.x0} y={area.y0} width={area.x1 - area.x0} height={area.y1 - area.y0} onClick={clicar} />
      {g.caminhoInverso && <path className="curva-linha inversa" d={g.caminhoInverso} />}
      <path className="curva-linha" d={g.caminho} />
      {marcado && <circle className="curva-ponto" cx={marcado.x} cy={marcado.y} r={4.5} />}
      {g.minimos.map((m, i) => (
        <g key={`m${i}`} className={`curva-minimo ${m.modo}${i === escolhido ? ' escolhido' : ''}`} onClick={() => escolher?.(i)}>
          <circle cx={m.x} cy={m.y} r={5} />
          <text x={m.x} y={m.y + 18} textAnchor="middle">
            {`${ROTULO[m.modo]}${m.ombro ? ' (ombro)' : ''} ${num(m.lam, m.lam >= 1000 ? 0 : 1)}`}
          </text>
          <text className="curva-meiaonda" x={m.x} y={m.y + 30} textAnchor="middle">
            {`L = ${num(m.L, 1)}`}
          </text>
        </g>
      ))}
    </svg>
  );
}
