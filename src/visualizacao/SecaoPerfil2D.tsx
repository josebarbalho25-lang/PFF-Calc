// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/SecaoPerfil2D.tsx — o corte do perfil na tela
// ---------------------------------------------------------------------------
//  Só desenha o que `geometriaDaSecao.ts` calculou; as cores vêm dos tokens
//  do tema pelas classes (.sec-*), em `calculadora.css`.
// ═══════════════════════════════════════════════════════════════════════════

import type { DesenhoDaSecao } from './geometriaDaSecao';

export function SecaoPerfil2D({ desenho: g, nome }: { desenho: DesenhoDaSecao; nome: string }) {
  return (
    <svg className="secao-perfil" viewBox={`0 0 ${g.largura} ${g.altura}`} role="img" aria-label={`Seção ${nome}`}>
      {g.linhas
        .filter((l) => l.classe === 'eixo' || l.classe === 'eixo-principal')
        .map((l, i) => (
          <line key={`e${i}`} className={`sec-${l.classe}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
      <path className={g.emendas ? 'sec-corpo emendado' : 'sec-corpo'} d={g.contorno} />
      {g.emendas && <path className="sec-miolo" d={g.contorno} />}
      {g.linhas
        .filter((l) => l.classe !== 'eixo' && l.classe !== 'eixo-principal')
        .map((l, i) => (
          <line key={i} className={`sec-${l.classe}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
      {g.marcas.map((m, i) =>
        m.tipo === 'centroide' ? (
          <g key={`m${i}`} className="sec-centroide">
            <circle cx={m.x} cy={m.y} r={5} />
            <path d={`M ${m.x - 5} ${m.y} A 5 5 0 0 1 ${m.x} ${m.y - 5} L ${m.x} ${m.y} Z M ${m.x + 5} ${m.y} A 5 5 0 0 1 ${m.x} ${m.y + 5} L ${m.x} ${m.y} Z`} />
          </g>
        ) : (
          <g key={`m${i}`} className="sec-torcao">
            <circle cx={m.x} cy={m.y} r={4} />
            <line x1={m.x - 7} y1={m.y} x2={m.x + 7} y2={m.y} />
            <line x1={m.x} y1={m.y - 7} x2={m.x} y2={m.y + 7} />
          </g>
        ),
      )}
      {g.textos.map((t, i) => (
        <text
          key={`t${i}`}
          className={`sec-texto-${t.classe}`}
          x={t.x}
          y={t.y}
          textAnchor={t.ancora}
          transform={t.rot ? `rotate(${t.rot} ${t.x} ${t.y})` : undefined}
        >
          <tspan className="simbolo">{t.texto}</tspan>
          {t.indice && (
            <tspan className="indice" dy={3}>
              {t.indice}
            </tspan>
          )}
          {t.valor && <tspan dy={t.indice ? -3 : 0}>{` = ${t.valor}`}</tspan>}
        </text>
      ))}
    </svg>
  );
}
