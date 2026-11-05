// ═══════════════════════════════════════════════════════════════════════════
//  ui/PainelFlambagem.tsx — a flambagem elástica da seção: a curva de
//  assinatura de cada esforço, os mínimos e o modo animado
// ---------------------------------------------------------------------------
//  SINAL DO MOMENTO NA TELA: positivo comprime o lado positivo do eixo
//  perpendicular — Mx > 0 comprime em cima (traciona embaixo, a convenção do
//  A-PORT); My > 0 comprime o lado x > 0 (o das pontas das mesas no U). No
//  motor de faixas (F6) é o contrário: Mx_F6 > 0 TRACIONA y > 0. Por isso o
//  "+" daqui lê o sentido "neg" de lá.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import type { CriticosDoSentido, CriticosElasticos } from '../motor/faixas/criticos';
import { MotorDeFaixas } from '../motor/faixas/motor';
import { num } from '../relatorio/formatos';
import { CurvaAssinatura } from '../visualizacao/CurvaAssinatura';
import { desenhoDaCurva } from '../visualizacao/desenhoDaCurva';
import { ModoDaBarra3D } from '../visualizacao/ModoDaBarra3D';
import { ModoDaSecao } from '../visualizacao/ModoDaSecao';
import type { EstadoDosCriticos } from './usarCriticos';

type Caso = 'P' | 'Mx' | 'My';
type Sentido = '+' | '-';

const SIMBOLO: Record<Caso, string> = { P: 'N', Mx: 'M', My: 'M' };
const INDICE: Record<Caso, string> = { P: '', Mx: 'x', My: 'y' };
const UNIDADE: Record<Caso, string> = { P: 'kN', Mx: 'kN·cm', My: 'kN·cm' };

function doSentido(c: CriticosElasticos, caso: Caso, s: Sentido): { este: CriticosDoSentido; outro: CriticosDoSentido } {
  const k = c[caso];
  if (caso === 'P') return { este: k.pos, outro: k.neg };
  return s === '+' ? { este: k.neg, outro: k.pos } : { este: k.pos, outro: k.neg };
}

/** O caso inicial pelo endereço (`&caso=Mx`), para os prints sem janela. */
function casoDoEndereco(): Caso {
  const achado = typeof location === 'undefined' ? null : /[#&]caso=(P|Mx|My)\b/.exec(location.hash);
  return (achado?.[1] as Caso | undefined) ?? 'P';
}

export function PainelFlambagem({ estado, com3D }: { estado: EstadoDosCriticos; com3D?: boolean }) {
  const [caso, setCaso] = useState<Caso>(casoDoEndereco);
  const [sentido, setSentido] = useState<Sentido>('+');
  const [escolhido, setEscolhido] = useState<number | null>(null);
  // Um ponto qualquer da curva (índice do L), clicado fora dos mínimos.
  const [ponto, setPonto] = useState<number | null>(null);
  const trocar = (f: () => void) => {
    f();
    setEscolhido(null);
    setPonto(null);
  };

  const visto = useMemo(() => {
    if (estado.estado !== 'pronto') return null;
    const c = estado.criticos;
    const { este, outro } = doSentido(c, caso, sentido);
    const desenho = desenhoDaCurva(
      c[caso].L,
      este.lam,
      este.minimos.map((m) => ({ L: m.L, lam: m.lam, modo: m.modo, ombro: m.ombro })),
      caso === 'P' ? {} : { lamInverso: outro.lam },
    );
    // o sentido do motor: o "pos" de lá é 1, o "neg" é −1 (ver doSentido)
    return { c, este, desenho, sentidoDoMotor: (este === c[caso].pos ? 1 : -1) as 1 | -1 };
  }, [estado, caso, sentido]);

  // O modo no L clicado: resolvido na hora (uma conta só, milissegundos).
  const modoDoPonto = useMemo(() => {
    if (!visto || ponto === null) return null;
    const L = visto.c[caso].L[ponto];
    const [modo] = new MotorDeFaixas(visto.c.malha, visto.c[caso].tensoes).modos(L, visto.sentidoDoMotor, 1);
    return modo ? { L, deslocamentos: modo.deslocamentos } : null;
  }, [visto, caso, ponto]);

  if (estado.estado === 'erro') return <div className="secao-erro">{estado.erro}</div>;

  const este = visto?.este;
  const padrao = este ? Math.max(0, este.minimos.findIndex((m) => m.modo === 'distorcional')) : 0;
  const indice = escolhido !== null && este && escolhido < este.minimos.length ? escolhido : padrao;
  const minimo = este?.minimos[indice];
  const rot = (qual: string) => (
    <>
      <i>{SIMBOLO[caso]}</i>
      <sub>{[qual, INDICE[caso]].filter(Boolean).join(',')}</sub>
    </>
  );

  return (
    <div className={`flambagem${estado.estado === 'calculando' ? ' calculando' : ''}`}>
      <div className="flambagem-controles">
        <div className="segmentado">
          {(['P', 'Mx', 'My'] as Caso[]).map((k) => (
            <button key={k} type="button" className={k === caso ? 'ativo' : ''} onClick={() => trocar(() => setCaso(k))}>
              {k === 'P' ? 'N' : k}
            </button>
          ))}
        </div>
        {caso !== 'P' && (
          <div className="segmentado">
            {(['+', '-'] as Sentido[]).map((s) => (
              <button key={s} type="button" className={s === sentido ? 'ativo' : ''} onClick={() => trocar(() => setSentido(s))}>
                {s === '+' ? '+' : '−'}
              </button>
            ))}
          </div>
        )}
      </div>
      {visto && (
        <div className="flambagem-corpo">
          <div className="flambagem-curva">
            <CurvaAssinatura
              desenho={visto.desenho}
              unidade={UNIDADE[caso]}
              escolhido={modoDoPonto ? undefined : indice}
              escolher={(i) => (setEscolhido(i), setPonto(null))}
              ponto={modoDoPonto ? ponto ?? undefined : undefined}
              escolherPonto={setPonto}
            />
            {com3D && (modoDoPonto ?? minimo) && (
              <ModoDaBarra3D malha={visto.c.malha} deslocamentos={(modoDoPonto ?? minimo)!.deslocamentos} L={(modoDoPonto ?? minimo)!.L} />
            )}
          </div>
          <div className="flambagem-lado">
            {(modoDoPonto ?? minimo) && <ModoDaSecao malha={visto.c.malha} deslocamentos={(modoDoPonto ?? minimo)!.deslocamentos} />}
            <div className="props uma-coluna">
              {(['local', 'distorcional'] as const).map((qual) => {
                const m = visto.este[qual];
                return (
                  <div className="prop largo" key={qual}>
                    <span className="prop-rotulo">{rot(qual === 'local' ? 'ℓ' : 'dist')}</span>
                    <span className="prop-valor">{m ? num(m.lam, m.lam >= 1000 ? 1 : 2) : '—'}</span>
                    <span className="prop-un">{m ? `${UNIDADE[caso]} · L ${num(m.L, 1)}` : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
