// ═══════════════════════════════════════════════════════════════════════════
//  ui/desenho/QuadroDoDesenho.tsx — o quadro: grade, chapa, nós, mira
// ---------------------------------------------------------------------------
//  Só desenha e repassa o mouse; quem decide o que o clique faz é o editor.
//  As coordenadas vão para a tela aqui, pela vista (`vista.ts`), em pixel —
//  e por isso a espessura da chapa é traço de largura t × escala: o arco do
//  canto com traço grosso dá a coroa da dobra certinha, sem desenhar contorno.
//
//  ⚠️ A CHAPA É A DO MOTOR, não a do desenho. Os nós que o projetista clica
//  são a linha média em canto vivo; o motor arredonda as dobras com
//  rm = ri + t/2. Desenhar a seção que o motor montou é mostrar o que vai
//  para a conta — se o motor entender errado, aparece aqui.
//
//  ⚠️ A RODA PRECISA DE OUVINTE NATIVO com { passive: false }: o onWheel do
//  React é passivo, não segura a rolagem, e a página rolaria junto com o zoom.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, type ReactNode } from 'react';
import type { NoDesenhado, SecaoDesenhada, SecaoGeometrica } from '../../motor/secao/tipos';
import type { AlvoSobCursor } from './encaixe';
import { linhasDaGrade, paraTela, type Tamanho, type Vista } from './vista';

export interface Mira {
  p: NoDesenhado;
  noNo: boolean;
  /** De onde vem o alinhamento (o rastreamento): uma guia de cada um até a mira. */
  guias: NoDesenhado[];
}

interface Props {
  desenho: SecaoDesenhada;
  /** A seção como o motor a entende (null: o motor recusou). */
  sec: SecaoGeometrica | null;
  vista: Vista;
  tam: Tamanho;
  passo: number;
  /** De onde sai o elástico (a ponta da polilinha). */
  ponta: NoDesenhado | null;
  /** O primeiro ponto, ainda sem trecho. */
  pendente: NoDesenhado | null;
  mira: Mira | null;
  realce: AlvoSobCursor | null;
  apagando: boolean;
  medir: (t: Tamanho) => void;
  mover: (s: { x: number; y: number } | null) => void;
  clicar: (s: { x: number; y: number }) => void;
  terminar: () => void;
  arrastar: (dx: number, dy: number) => void;
  rolar: (s: { x: number; y: number }, fator: number) => void;
  ajustar: () => void;
}

const MM_POR_CM = 10;

/** Os traços da chapa do motor, na tela: caminho e largura (t × escala). */
function chapa(sec: SecaoGeometrica, v: Vista, tam: Tamanho) {
  const T = (p: { x: number; y: number }) => paraTela(v, tam, { x: p.x * MM_POR_CM, y: p.y * MM_POR_CM });
  const tracos = sec.trechos.map((tr, k) => {
    const largura = (sec.grafo?.espessuras[k] ?? sec.t) * MM_POR_CM * v.esc;
    if (tr.tipo === 'reta') {
      const [a, b] = [T(tr.a), T(tr.b)];
      return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, largura };
    }
    const ponto = (ang: number) => T({ x: tr.centro.x + tr.raio * Math.cos(ang), y: tr.centro.y + tr.raio * Math.sin(ang) });
    const [a, b] = [ponto(tr.ang0), ponto(tr.ang1)];
    const r = tr.raio * MM_POR_CM * v.esc;
    // anti-horário no plano (ang1 > ang0) é horário na tela, que desce: varredura 1
    const varre = tr.ang1 > tr.ang0 ? 1 : 0;
    const grande = Math.abs(tr.ang1 - tr.ang0) > Math.PI ? 1 : 0;
    return { d: `M ${a.x} ${a.y} A ${r} ${r} 0 ${grande} ${varre} ${b.x} ${b.y}`, largura };
  });
  // Junção e canto vivo do grafo: um disco tapa o dente que o traço de ponta
  // reta deixa onde as chapas se encontram.
  const discos: { x: number; y: number; r: number }[] = [];
  if (sec.grafo) {
    const g = sec.grafo;
    g.nos.forEach((no, k) => {
      const inc = g.extremos.map((e, q) => (e[0] === k || e[1] === k ? q : -1)).filter((q) => q >= 0);
      if (inc.length < 2) return;
      const s = T(no);
      discos.push({ ...s, r: (Math.max(...inc.map((q) => g.espessuras[q])) * MM_POR_CM * v.esc) / 2 });
    });
  }
  return { tracos, discos };
}

export function QuadroDoDesenho(p: Props) {
  const { desenho, sec, vista: v, tam, passo, ponta, pendente, mira, realce, apagando } = p;
  const caixa = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const arrasto = useRef<{ x: number; y: number } | null>(null);
  // os ouvintes nativos leem as funções mais novas por aqui
  const atual = useRef(p);
  atual.current = p;

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(() => atual.current.medir({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      // Um dente da roda (100 px) = 1,2×. Proporcional ao giro: o touchpad
      // manda dezenas de eventos miúdos, e 1,2× por evento disparava o zoom.
      const giro = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const fator = Math.pow(1.2, -Math.max(-300, Math.min(300, giro)) / 100);
      atual.current.rolar({ x: e.clientX - r.left, y: e.clientY - r.top }, fator);
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const T = (q: NoDesenhado) => paraTela(v, tam, q);

  const grade = linhasDaGrade(v, tam, passo);
  const origem = T({ x: 0, y: 0 });
  const motor = sec ? chapa(sec, v, tam) : null;

  let realceSvg: ReactNode = null;
  if (realce?.tipo === 'no' && desenho.nos[realce.k]) {
    const s = T(desenho.nos[realce.k]);
    realceSvg = <rect className="des-realce" x={s.x - 7} y={s.y - 7} width={14} height={14} />;
  } else if (realce?.tipo === 'trecho' && desenho.trechos[realce.k]) {
    const tr = desenho.trechos[realce.k];
    const [a, b] = [desenho.nos[tr.i], desenho.nos[tr.j]];
    if (a && b) {
      const [sa, sb] = [T(a), T(b)];
      realceSvg = <line className="des-realce" x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} />;
    }
  }

  return (
    <div className={`des-quadro${apagando ? ' apagando' : ''}`} ref={caixa}>
      <svg
        ref={svg}
        width={tam.w}
        height={tam.h}
        onPointerDown={(e) => {
          if (e.button === 1) {
            arrasto.current = { x: e.clientX, y: e.clientY };
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // ponteiro que já sumiu: o arrasto segue sem captura
            }
          } else if (e.button === 0) p.clicar(local(e));
        }}
        onPointerMove={(e) => {
          const a = arrasto.current;
          if (a) {
            p.arrastar(e.clientX - a.x, e.clientY - a.y);
            arrasto.current = { x: e.clientX, y: e.clientY };
          } else p.mover(local(e));
        }}
        onPointerUp={(e) => {
          if (e.button === 1) arrasto.current = null;
        }}
        onPointerLeave={() => {
          if (!arrasto.current) p.mover(null);
        }}
        // Nenhum botão do mouse mexe no foco: o teclado fica na linha de
        // comando (o editor devolve o foco a ela). E o botão do meio, no
        // Windows, ligaria a rolagem automática do navegador.
        onMouseDown={(e) => e.preventDefault()}
        onAuxClick={(e) => {
          if (e.button === 1 && e.detail === 2) p.ajustar();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          p.terminar();
        }}
      >
        <g className="des-grade">
          {grade.xs.map((l, k) => (
            <line key={`x${k}`} className={l.principal ? 'principal' : undefined} x1={l.s} y1={0} x2={l.s} y2={tam.h} />
          ))}
          {grade.ys.map((l, k) => (
            <line key={`y${k}`} className={l.principal ? 'principal' : undefined} x1={0} y1={l.s} x2={tam.w} y2={l.s} />
          ))}
        </g>
        <g className="des-eixos">
          <line x1={origem.x} y1={0} x2={origem.x} y2={tam.h} />
          <line x1={0} y1={origem.y} x2={tam.w} y2={origem.y} />
        </g>

        {motor && (
          <g className="des-chapa">
            {motor.tracos.map((t, k) => (
              <path key={k} d={t.d} strokeWidth={Math.max(1, t.largura)} />
            ))}
            {motor.discos.map((d, k) => (
              <circle key={k} cx={d.x} cy={d.y} r={Math.max(0.5, d.r)} />
            ))}
          </g>
        )}
        {motor && (
          <g className="des-linha-media">
            {motor.tracos.map((t, k) => (
              <path key={k} d={t.d} />
            ))}
          </g>
        )}

        <g className={`des-trechos${motor ? '' : ' sem-motor'}`}>
          {desenho.trechos.map((tr, k) => {
            const [a, b] = [desenho.nos[tr.i], desenho.nos[tr.j]];
            if (!a || !b) return null;
            const [sa, sb] = [T(a), T(b)];
            return <line key={k} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} />;
          })}
        </g>

        {realceSvg}

        {ponta && mira && !apagando && (
          <line className="des-elastico" x1={T(ponta).x} y1={T(ponta).y} x2={T(mira.p).x} y2={T(mira.p).y} />
        )}

        <g className="des-nos">
          {desenho.nos.map((n, k) => {
            const s = T(n);
            return (
              <g key={k}>
                <rect x={s.x - 3} y={s.y - 3} width={6} height={6} />
                <text x={s.x + 6} y={s.y - 6}>
                  {k + 1}
                </text>
              </g>
            );
          })}
        </g>

        {pendente && (
          <g className="des-pendente">
            <circle cx={T(pendente).x} cy={T(pendente).y} r={4} />
          </g>
        )}

        {mira && !apagando && mira.guias.length > 0 && (
          <g className="des-guias">
            {mira.guias.map((g, k) => (
              <line key={k} x1={T(g).x} y1={T(g).y} x2={T(mira.p).x} y2={T(mira.p).y} />
            ))}
          </g>
        )}
        {mira && !apagando && (
          <g className="des-mira">
            {mira.noNo ? (
              <rect x={T(mira.p).x - 6} y={T(mira.p).y - 6} width={12} height={12} />
            ) : (
              <>
                <line x1={T(mira.p).x - 5} y1={T(mira.p).y} x2={T(mira.p).x + 5} y2={T(mira.p).y} />
                <line x1={T(mira.p).x} y1={T(mira.p).y - 5} x2={T(mira.p).x} y2={T(mira.p).y + 5} />
              </>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
