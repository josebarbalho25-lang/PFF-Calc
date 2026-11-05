// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/modais/PainelCisalhamento.tsx — a alma sob cortante, com e sem
//  enrijecedores
// ---------------------------------------------------------------------------
//  A vista de frente de um trecho de viga: mesas em cima e embaixo, a alma no
//  meio, a cortante empurrando. Com enrijecedores, a alma se divide em painéis
//  de largura a, cada um distorce como um quadro e mostra o CAMPO DE TRAÇÃO
//  na diagonal (os traços que acendem). Sem enrijecedores, a alma inteira
//  ondula em diagonal — a flambagem por cisalhamento que o kv mede.
//
//  A proporção a/h é a da entrada (h = d' do perfil), com teto no desenho:
//  a/h muito grande desenha um painel só, que é o que ele é para a norma
//  (acima de 3, kv = 5,34 como sem enrijecedor).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

interface Props {
  /** a/h da entrada; undefined = sem enrijecedores. */
  aSobreH: number | undefined;
}

const W = 680;
const H = 340;

export function PainelCisalhamento({ aSobreH }: Props) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let quadro = 0;
    const passo = (agora: number) => {
      setT(agora / 1000);
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, []);

  const amp = (1 - Math.cos(t * 1.6)) / 2;
  const x0 = 60;
  const x1 = W - 60;
  const yTopo = 70;
  const h = 180;
  const mesa = 16;
  const comEnrij = aSobreH !== undefined && aSobreH <= 3;
  const nPaineis = comEnrij ? Math.max(1, Math.min(6, Math.round((x1 - x0) / (aSobreH! * h)))) : 1;
  const largura = (x1 - x0) / nPaineis;
  const desliza = 14 * amp;

  // A alma distorce como um quadro: o topo de cada painel anda mais que a base.
  const quina = (x: number, y: number) => {
    const f = (y - yTopo) / h;
    return [x + desliza * (1 - f), y] as const;
  };

  const paineis = Array.from({ length: nPaineis }, (_, i) => {
    const xa = x0 + i * largura;
    const xb = xa + largura;
    const p = [quina(xa, yTopo), quina(xb, yTopo), quina(xb, yTopo + h), quina(xa, yTopo + h)];
    return { xa, xb, p };
  });

  return (
    <svg className="painel-cisalhamento" viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {paineis.map(({ xa, xb, p }, i) => (
        <g key={i}>
          <polygon points={p.map((q) => q.join(',')).join(' ')} className="cis-alma" />
          {comEnrij
            ? // Campo de tração: traços paralelos à diagonal que alonga.
              Array.from({ length: 7 }, (_, k) => {
                const f = (k + 1) / 8;
                const [ax, ay] = quina(xa + f * (xb - xa) * 0.9, yTopo);
                const [bx, by] = quina(xa + (xb - xa) * (f * 0.9 + 0.1), yTopo + h);
                return <line key={k} x1={ax} y1={ay} x2={bx} y2={by} className="cis-tracao" style={{ opacity: 0.15 + 0.85 * amp }} />;
              })
            : // Sem enrijecedor: ondas diagonais de flambagem por toda a alma.
              Array.from({ length: 9 }, (_, k) => {
                const xs = x0 + ((k + 0.5) * (x1 - x0)) / 9;
                const fase = Math.sin(t * 1.6 + k) * 0.5 + 0.5;
                return (
                  <path
                    key={k}
                    d={`M ${xs - 30 + desliza} ${yTopo + 8} Q ${xs + 18 * fase} ${yTopo + h / 2} ${xs + 30} ${yTopo + h - 8}`}
                    className="cis-onda"
                    style={{ opacity: 0.2 + 0.8 * amp }}
                  />
                );
              })}
        </g>
      ))}
      {/* Mesas. */}
      <rect x={x0 - 10 + desliza} y={yTopo - mesa} width={x1 - x0 + 20} height={mesa} className="cis-mesa" />
      <rect x={x0 - 10} y={yTopo + h} width={x1 - x0 + 20} height={mesa} className="cis-mesa" />
      {/* Enrijecedores nas divisas dos painéis (e nas pontas). */}
      {comEnrij &&
        Array.from({ length: nPaineis + 1 }, (_, i) => {
          const x = x0 + i * largura;
          const [xa, ya] = quina(x, yTopo);
          const [xb, yb] = quina(x, yTopo + h);
          return <line key={i} x1={xa} y1={ya} x2={xb} y2={yb} className="cis-enrijecedor" />;
        })}
      {/* Cota de a no primeiro painel, e h. */}
      {comEnrij && (
        <g>
          <line x1={x0} y1={yTopo + h + mesa + 22} x2={x0 + largura} y2={yTopo + h + mesa + 22} className="cis-cota" />
          <text x={x0 + largura / 2} y={yTopo + h + mesa + 40} className="cis-cota-texto" textAnchor="middle">
            a
          </text>
        </g>
      )}
      <line x1={x1 + 28} y1={yTopo} x2={x1 + 28} y2={yTopo + h} className="cis-cota" />
      <text x={x1 + 36} y={yTopo + h / 2 + 5} className="cis-cota-texto">
        h
      </text>
      {/* As setas da cortante nas pontas. */}
      <path d={`M ${x0 - 30} ${yTopo + 20} L ${x0 - 30} ${yTopo + h - 20}`} className="cis-seta" markerEnd="url(#ponta)" />
      <path d={`M ${x1 + 10} ${yTopo + h - 20} L ${x1 + 10} ${yTopo + 20}`} className="cis-seta" markerEnd="url(#ponta)" />
      <defs>
        <marker id="ponta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="cis-ponta" />
        </marker>
      </defs>
    </svg>
  );
}
