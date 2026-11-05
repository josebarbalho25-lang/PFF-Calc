// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/modais/DiagramaCb.tsx — o Cb pelo diagrama de momento do trecho
// ---------------------------------------------------------------------------
//  O trecho destravado entre duas contenções, o diagrama de momento embaixo,
//  as três seções de cálculo (A a 1/4, B no meio, C a 3/4) e o Mmáx, com a
//  fórmula do 5.4.2.3-a escrita com os números do diagrama. Rm = 1 (perfil
//  duplamente simétrico).
//
//  A forma do diagrama é escolhida no lado (distribuída, concentrada no
//  meio, momentos nas pontas com a razão ψ, balanço) e o Cb sai na hora — e
//  vai para o campo com um clique. É ferramenta, não ilustração.
//
//  ⚠️ A NORMA DE 2024 NÃO TEM MAIS O "≤ 3,0" NO Cb DA ALÍNEA a): o fator é
//  o da fórmula vezes Rm. Ver 5.4.2.3.
//
//  ⚠️ BALANÇO É FORMA PRÓPRIA, NÃO "MOMENTOS NAS PONTAS COM ψ = 0": o
//  triângulo é o mesmo, mas a fórmula da alínea a) pede as duas pontas
//  travadas e daria 1,67. Com engaste e ponta livre, o 5.4.2.3-b) fixa 1,0.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { num } from '../../relatorio/formatos';

export type FormaDoDiagrama = 'distribuida' | 'concentrada' | 'pontas' | 'balanco';

/** O momento normalizado no trecho, ξ de 0 a 1 (positivo traciona embaixo).
 *  O balanço tem o engaste em ξ = 0 e traciona em cima. */
export function momentoNoTrecho(forma: FormaDoDiagrama, psi: number, xi: number): number {
  if (forma === 'distribuida') return 4 * xi * (1 - xi);
  if (forma === 'concentrada') return xi <= 0.5 ? 2 * xi : 2 * (1 - xi);
  if (forma === 'balanco') return -((1 - xi) ** 2);
  return 1 + (psi - 1) * xi;
}

export interface CalculoDoCb {
  Mmax: number;
  MA: number;
  MB: number;
  MC: number;
  Cb: number;
}

export function cbDoDiagrama(forma: FormaDoDiagrama, psi: number): CalculoDoCb {
  let Mmax = 0;
  for (let i = 0; i <= 200; i++) Mmax = Math.max(Mmax, Math.abs(momentoNoTrecho(forma, psi, i / 200)));
  const MA = Math.abs(momentoNoTrecho(forma, psi, 0.25));
  const MB = Math.abs(momentoNoTrecho(forma, psi, 0.5));
  const MC = Math.abs(momentoNoTrecho(forma, psi, 0.75));
  // No balanço a fórmula daria 2,33 (carga distribuída) — contra a segurança.
  const Cb = forma === 'balanco' ? 1 : (12.5 * Mmax) / (2.5 * Mmax + 3 * MA + 4 * MB + 3 * MC);
  return { Mmax, MA, MB, MC, Cb };
}

interface Props {
  forma: FormaDoDiagrama;
  psi: number;
}

const W = 640;
const H = 360;

export function DiagramaCb({ forma, psi }: Props) {
  // O diagrama "cresce" ao trocar de forma: dá para ver o que mudou.
  const [fase, setFase] = useState(0);
  useEffect(() => {
    setFase(0);
    let quadro = 0;
    const inicio = performance.now();
    const passo = (t: number) => {
      const f = Math.min(1, (t - inicio) / 600);
      setFase(1 - (1 - f) ** 3);
      if (f < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [forma, psi]);

  const balanco = forma === 'balanco';
  const x0 = 70;
  const x1 = W - 50;
  const yViga = 80;
  // O balanço traciona em cima: o diagrama sobe, e o eixo desce para caber.
  const yEixo = balanco ? 290 : 200;
  const escala = 105;
  const c = useMemo(() => cbDoDiagrama(forma, psi), [forma, psi]);
  const pts = useMemo(() => {
    const p: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const xi = i / 120;
      p.push(`${x0 + xi * (x1 - x0)},${yEixo + momentoNoTrecho(forma, psi, xi) * escala * fase}`);
    }
    return p;
  }, [forma, psi, fase, x1, yEixo]);
  const xs = (xi: number) => x0 + xi * (x1 - x0);
  const marcas: Array<[string, number, number]> = [
    ['A', 0.25, c.MA],
    ['B', 0.5, c.MB],
    ['C', 0.75, c.MC],
  ];
  // Onde mora o Mmáx (o primeiro, se houver dois).
  let xiMax = 0;
  for (let i = 0; i <= 200; i++) if (Math.abs(momentoNoTrecho(forma, psi, i / 200)) >= c.Mmax - 1e-9) {
    xiMax = i / 200;
    break;
  }
  const aEsquerda = !balanco && (xiMax > 0.8 || [0.25, 0.5, 0.75].some((m) => Math.abs(xiMax - m) < 1e-9));

  return (
    <svg className="diagrama-cb" viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {/* A viga e as contenções laterais: nas duas pontas do trecho, ou só no
          engaste do balanço (a ponta fica livre). */}
      <rect x={x0} y={yViga - 9} width={x1 - x0} height={18} className="cb-viga" />
      {balanco && (
        <g className="cb-engaste">
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={x0} y1={yViga - 28 + i * 11} x2={x0 - 12} y2={yViga - 16 + i * 11} />
          ))}
        </g>
      )}
      {(balanco ? [x0] : [x0, x1]).map((x) => (
        <g key={x}>
          <line x1={x} y1={yViga - 28} x2={x} y2={yViga + 28} className="cb-trava" />
          <text x={x} y={yViga - 34} className="cb-rotulo" textAnchor="middle">
            ×
          </text>
        </g>
      ))}
      <line x1={x0} y1={yViga + 44} x2={x1} y2={yViga + 44} className="cb-cota" />
      <text x={(x0 + x1) / 2} y={yViga + 40} className="cb-cota-texto" textAnchor="middle">
        Lb
      </text>
      {/* O diagrama. */}
      <line x1={x0 - 10} y1={yEixo} x2={x1 + 10} y2={yEixo} className="cb-eixo" />
      <polygon points={`${x0},${yEixo} ${pts.join(' ')} ${x1},${yEixo}`} className="cb-diagrama" />
      <polyline points={pts.join(' ')} className="cb-contorno" />
      {/* As seções A, B e C só entram onde a fórmula vale. */}
      {!balanco && marcas.map(([nome, xi, M]) => {
        const y = yEixo + momentoNoTrecho(forma, psi, xi) * escala * fase;
        return (
          <g key={nome}>
            <line x1={xs(xi)} y1={yViga + 9} x2={xs(xi)} y2={Math.max(y, yEixo) + 4} className="cb-secao" />
            <circle cx={xs(xi)} cy={y} r={4} className="cb-ponto" />
            <text x={xs(xi) + 6} y={y + (y >= yEixo ? 18 : -8)} className="cb-rotulo">
              M<tspan dy={3} fontSize="10">{nome}</tspan>
              <tspan dy={-3}> = {num(M, 2)}</tspan>
            </text>
          </g>
        );
      })}
      <circle cx={xs(xiMax)} cy={yEixo + momentoNoTrecho(forma, psi, xiMax) * escala * fase} r={5.5} className="cb-max" />
      {/* O rótulo do Mmáx ao lado do próprio ponto. Quando o máximo cai numa
          das seções A, B ou C (distribuída, concentrada), o rótulo dela já
          está à direita: o do Mmáx vai para a esquerda. */}
      <text
        x={xs(xiMax) + (aEsquerda ? -12 : 12)}
        y={yEixo + momentoNoTrecho(forma, psi, xiMax) * escala * fase + (balanco ? -10 : 22)}
        className="cb-rotulo max"
        textAnchor={aEsquerda ? 'end' : 'start'}
      >
        M<tspan dy={3} fontSize="10">máx</tspan>
        <tspan dy={-3}> = {num(c.Mmax, 2)}</tspan>
      </text>
      {!balanco && [0.25, 0.5, 0.75].map((xi, i) => (
        <text key={xi} x={xs(xi)} y={yViga - 16} className="cb-cota-texto" textAnchor="middle">
          {['Lb/4', 'Lb/2', '3Lb/4'][i]}
        </text>
      ))}
    </svg>
  );
}
