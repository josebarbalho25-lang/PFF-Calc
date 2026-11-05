// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/modais/JanelaDidatica.tsx — a janela do (?)
// ---------------------------------------------------------------------------
//  Três famílias de abas: os comprimentos (Lx, Ly, Lz, Cb, a), os esforços (N,
//  Mx, My, Vx, Vy) e a flambagem elástica da seção (a curva de assinatura com
//  o vale local e o distorcional, e o modo animado). O (?) de cada campo abre
//  a família dele. O palco à esquerda, os números da barra à direita. Sem
//  texto corrido — a animação diz o que é, os rótulos dizem onde mora.
//
//  Copiada da calculadora 8800 e adaptada: a barra 3D é o contorno do perfil
//  formado a frio extrudado (`pecas3D.formaDoPerfil`), qualquer família.
//
//  Carrega sob demanda (App.tsx): o three.js só vem quando a janela abre.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CriticosElasticos } from '../../motor/faixas/criticos';
import type { ResultadoDaVerificacao } from '../../motor/norma';
import { E } from '../../motor/norma/compressao';
import { num, numExato } from '../../relatorio/formatos';
import { PainelFlambagem } from '../../ui/PainelFlambagem';
import { CenaEsforco3D } from '../CenaEsforco3D';
import { CenaFlambagem3D } from '../CenaFlambagem3D';
import type { Esforco } from '../deformadaDoEsforco';
import { cbDoDiagrama, DiagramaCb, type FormaDoDiagrama } from './DiagramaCb';
import { PainelCisalhamento } from './PainelCisalhamento';

export type ChaveDaAjuda = 'Lx' | 'Ly' | 'Lz' | 'Cb' | 'a' | 'dist' | Esforco;

interface Props {
  chave: ChaveDaAjuda;
  trocar: (c: ChaveDaAjuda) => void;
  fechar: () => void;
  resultado: ResultadoDaVerificacao;
  criticos: CriticosElasticos;
  nome: string;
  usarCb: (Cb: number) => void;
}

const COMPRIMENTOS: ChaveDaAjuda[] = ['Lx', 'Ly', 'Lz', 'Cb', 'a'];
const ESFORCOS: Esforco[] = ['N', 'Mx', 'My', 'Vx', 'Vy'];
const eEsforco = (c: ChaveDaAjuda): c is Esforco => (ESFORCOS as string[]).includes(c);
const TITULO: Record<ChaveDaAjuda, string> = {
  Lx: 'Flambagem por flexão em torno de X',
  Ly: 'Flambagem por flexão em torno de Y',
  Lz: 'Torção e flambagem lateral com torção',
  Cb: 'Fator de momento não uniforme',
  a: 'Enrijecedores transversais da alma',
  dist: 'Flambagem local e distorcional',
  N: 'Força axial',
  Mx: 'Momento fletor em torno de X',
  My: 'Momento fletor em torno de Y',
  Vx: 'Força cortante na direção X',
  Vy: 'Força cortante na direção Y',
};

function Dado({ rotulo, valor, unidade }: { rotulo: ReactNode; valor: string; unidade?: string }) {
  return (
    <div className="cad-linha">
      <label>
        <span>{rotulo}</span>
      </label>
      <div className="cad-valor">
        <span className="valor-derivado">{valor}</span>
        <span className="unidade">{unidade ?? ''}</span>
      </div>
    </div>
  );
}

// Num span só: dentro de botão ou rótulo flex, letra e índice soltos viram
// dois itens separados pelo vão ("C  b").
const s = (b: string, i: string) => (
  <span>
    <i>{b}</i>
    <sub>{i}</sub>
  </span>
);
// O comprimento de flambagem como a 14762:2010 escreve: KxLx (o dado é o produto).
const kl = (e: string) => (
  <span>
    <i>K</i>
    <sub>{e}</sub>
    <i>L</i>
    <sub>{e}</sub>
  </span>
);
const ROTULO_DA_ABA: Partial<Record<ChaveDaAjuda, ReactNode>> = { Lx: kl('x'), Ly: kl('y'), Lz: kl('z'), Cb: s('C', 'b') };

function Seg<T extends string | number | boolean>({ opcoes, valor, mudar }: { opcoes: Array<[T, ReactNode]>; valor: T; mudar: (v: T) => void }) {
  return (
    <div className="seg">
      {opcoes.map(([v, r]) => (
        <button key={String(v)} type="button" className={v === valor ? 'on' : ''} onClick={() => mudar(v)}>
          {r}
        </button>
      ))}
    </div>
  );
}

export default function JanelaDidatica({ chave, trocar, fechar, resultado, criticos, nome, usarCb }: Props) {
  const r = resultado;
  const L = r.entrada.comprimentos;
  const pr = r.propriedades;
  const perfil = useMemo(() => ({ sec: r.secao, pr }), [r.secao, pr]);
  const [ondasPilar, setOndasPilar] = useState<1 | 2>(1);
  const [ondasViga, setOndasViga] = useState<0 | 1 | 2>(1);
  const [forma, setForma] = useState<FormaDoDiagrama>('distribuida');
  const [psi, setPsi] = useState(0);
  const [comEnrij, setComEnrij] = useState(L.a > 0);
  const [compressao, setCompressao] = useState(r.entrada.esforcos.N >= 0);
  const cb = useMemo(() => cbDoDiagrama(forma, psi), [forma, psi]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [fechar]);

  // A alma do cortante em y: a primeira alma da verificação (largura plana).
  const alma = r.cortanteY.almas[0];
  const h = alma ? alma.h : NaN;
  const aSobreH = comEnrij ? (L.a > 0 ? L.a / h : 1.5) : undefined;

  let palco: ReactNode;
  let controles: ReactNode = null;
  let dados: ReactNode;
  if (chave === 'dist') {
    palco = <PainelFlambagem estado={{ estado: 'pronto', criticos }} com3D />;
    dados = (
      <>
        <Dado rotulo={s('N', 'ℓ')} valor={num(criticos.P.pos.local?.lam ?? NaN, 1)} unidade="kN" />
        <Dado rotulo={s('N', 'dist')} valor={num(criticos.P.pos.distorcional?.lam ?? NaN, 1)} unidade="kN" />
        <Dado rotulo={<>{s('N', 'c,Rd')}</>} valor={num(r.compressao.NcRd, 1)} unidade="kN" />
        <Dado rotulo={<>{s('M', 'x,Rd')}</>} valor={num(r.flexaoX.MRd, 0)} unidade="kN·cm" />
      </>
    );
  } else if (eEsforco(chave)) {
    const f = r.entrada.esforcos;
    const razao = (sd: number, rd: number) => num(Math.abs(sd) / rd, 3);
    palco = <CenaEsforco3D key={chave} perfil={perfil} esforco={chave} compressao={compressao} />;
    if (chave === 'N') {
      controles = (
        <Seg
          opcoes={[
            [true, 'Positivo · compressão'],
            [false, 'Negativo · tração'],
          ]}
          valor={compressao}
          mudar={setCompressao}
        />
      );
      const NRd = f.N >= 0 ? r.compressao.NcRd : r.tracao.NtRd;
      dados = (
        <>
          <Dado rotulo={s('N', 'Sd')} valor={num(f.N, 2)} unidade="kN" />
          <Dado rotulo={f.N >= 0 ? s('N', 'c,Rd') : s('N', 't,Rd')} valor={num(NRd, 1)} unidade="kN" />
          <Dado rotulo={<>{s('N', 'Sd')}/{s('N', 'Rd')}</>} valor={razao(f.N, NRd)} />
        </>
      );
    } else if (chave === 'Mx' || chave === 'My') {
      const emX = chave === 'Mx';
      const e = emX ? 'x' : 'y';
      const MRd = emX ? r.flexaoX.MRd : r.flexaoY.MRd;
      const MSd = emX ? f.Mx : f.My;
      dados = (
        <>
          <Dado rotulo={s('M', `${e},Sd`)} valor={num(MSd, 1)} unidade="kN·cm" />
          <Dado rotulo={s('I', e)} valor={num(emX ? pr.Ix : pr.Iy, 1)} unidade="cm⁴" />
          <Dado rotulo={s('M', `${e},Rd`)} valor={num(MRd, 1)} unidade="kN·cm" />
          <Dado rotulo={<>{s('M', `${e},Sd`)}/{s('M', `${e},Rd`)}</>} valor={razao(MSd, MRd)} />
        </>
      );
    } else {
      const emY = chave === 'Vy';
      const e = emY ? 'y' : 'x';
      const c = emY ? r.cortanteY : r.cortanteX;
      const VSd = emY ? f.Vy : f.Vx;
      dados = (
        <>
          <Dado rotulo={s('V', `${e},Sd`)} valor={num(VSd, 2)} unidade="kN" />
          <Dado rotulo="almas" valor={String(c.almas.length)} />
          <Dado rotulo={s('V', `${e},Rd`)} valor={num(c.VRd, 1)} unidade="kN" />
          <Dado rotulo={<>{s('V', `${e},Sd`)}/{s('V', `${e},Rd`)}</>} valor={c.VRd > 0 ? razao(VSd, c.VRd) : '—'} />
        </>
      );
    }
  } else if (chave === 'Lx' || chave === 'Ly') {
    const eixo = chave === 'Lx' ? 'x' : 'y';
    const rr = eixo === 'x' ? pr.rx : pr.ry;
    const LL = eixo === 'x' ? L.Lx : L.Ly;
    const Ne = LL > 0 ? (Math.PI ** 2 * E * (eixo === 'x' ? pr.Ix : pr.Iy)) / LL ** 2 : Infinity;
    palco = <CenaFlambagem3D key={chave} perfil={perfil} modo={eixo} ondas={ondasPilar} rotulo={`K${eixo}L${eixo}`} />;
    controles = (
      <Seg
        opcoes={[
          [1, 'Sem contenção'],
          [2, 'Contenção no meio'],
        ]}
        valor={ondasPilar}
        mudar={setOndasPilar}
      />
    );
    dados = (
      <>
        <Dado rotulo={kl(eixo)} valor={numExato(LL, 1)} unidade="cm" />
        <Dado rotulo={s('r', eixo)} valor={numExato(rr, 2)} unidade="cm" />
        <Dado rotulo={<>λ = {kl(eixo)}/{s('r', eixo)}</>} valor={LL > 0 ? num(LL / rr, 1) : '—'} />
        <Dado rotulo={s('N', `e${eixo}`)} valor={num(Ne, 1)} unidade="kN" />
        <Dado rotulo={s('N', 'e')} valor={num(r.compressao.global.Ne, 1)} unidade="kN" />
      </>
    );
  } else if (chave === 'Lz') {
    const fx = r.flexaoX;
    palco = <CenaFlambagem3D key={chave} perfil={perfil} modo="flt" ondas={ondasViga} rotulo="Lz" />;
    controles = (
      <Seg
        opcoes={[
          [1, 'Contenção nas pontas'],
          [2, 'Contenção no meio'],
          [0, 'Contínua'],
        ]}
        valor={ondasViga}
        mudar={setOndasViga}
      />
    );
    dados = (
      <>
        <Dado rotulo={kl('z')} valor={numExato(L.Lz, 1)} unidade="cm" />
        <Dado rotulo={s('C', 'b')} valor={numExato(L.Cb, 3)} />
        <Dado rotulo={s('N', 'ez')} valor={num(r.compressao.global.Nez, 1)} unidade="kN" />
        <Dado rotulo={s('M', 'e')} valor={num(fx.Me, 0)} unidade="kN·cm" />
        <Dado rotulo={s('λ', '0')} valor={num(fx.lambda0, 3)} />
        <Dado rotulo={s('χ', 'FLT')} valor={num(fx.chiFLT, 3)} />
      </>
    );
  } else if (chave === 'Cb') {
    palco = (
      <div className="palco-cb">
        <DiagramaCb forma={forma} psi={psi} />
        {forma === 'balanco' ? (
          <div className="formula-cb">
            {s('C', 'b')} = <b>{num(cb.Cb, 2)}</b>
            <span className="ref">NBR 14762:2010, 9.8.2.2</span>
          </div>
        ) : (
          <div className="formula-cb">
            {s('C', 'b')} =
            <span className="frac">
              <span>12,5 · {num(cb.Mmax, 2)}</span>
              <span>
                2,5 · {num(cb.Mmax, 2)} + 3 · {num(cb.MA, 2)} + 4 · {num(cb.MB, 2)} + 3 · {num(cb.MC, 2)}
              </span>
            </span>
            = <b>{num(cb.Cb, 3)}</b>
          </div>
        )}
      </div>
    );
    controles = (
      <Seg
        opcoes={[
          ['distribuida', 'Distribuída'],
          ['concentrada', 'Concentrada no meio'],
          ['pontas', 'Momentos nas pontas'],
          ['balanco', 'Balanço'],
        ]}
        valor={forma}
        mudar={setForma}
      />
    );
    dados = (
      <>
        {forma === 'pontas' && (
          <div className="cad-linha">
            <label>
              <span>
                ψ = {s('M', '2')}/{s('M', '1')}
              </span>
            </label>
            <div className="cad-valor">
              <input type="range" min={-1} max={1} step={0.05} value={psi} onChange={(e) => setPsi(Number(e.target.value))} />
              <span className="unidade mono">{num(psi, 2)}</span>
            </div>
          </div>
        )}
        <Dado rotulo={s('C', 'b')} valor={num(cb.Cb, 3)} />
        <Dado rotulo={<>{s('C', 'b')} na verificação</>} valor={numExato(L.Cb, 3)} />
        <div className="acoes">
          <button type="button" className="btn-primario" onClick={() => usarCb(Math.round(cb.Cb * 1000) / 1000)}>
            Usar {s('C', 'b')} = {num(cb.Cb, 3)}
          </button>
        </div>
      </>
    );
  } else {
    palco = <PainelCisalhamento aSobreH={aSobreH} />;
    controles = (
      <Seg
        opcoes={[
          [false, 'Sem enrijecedores'],
          [true, 'Com enrijecedores'],
        ]}
        valor={comEnrij}
        mudar={setComEnrij}
      />
    );
    dados = (
      <>
        <Dado rotulo={<i>h</i>} valor={numExato(h * 10, 1)} unidade="mm" />
        <Dado rotulo={<i>t</i>} valor={numExato(r.secao.t * 10, 2)} unidade="mm" />
        <Dado rotulo={<i>a</i>} valor={L.a > 0 ? numExato(L.a, 1) : '—'} unidade="cm" />
        <Dado rotulo={<i>a/h</i>} valor={L.a > 0 ? num(L.a / h, 2) : '—'} />
        <Dado rotulo={s('k', 'v')} valor={alma ? num(alma.kv, 2) : '—'} />
        <Dado rotulo={<i>h/t</i>} valor={alma ? num(alma.ht, 1) : '—'} />
        <Dado rotulo={s('V', 'y,Rd')} valor={num(r.cortanteY.VRd, 1)} unidade="kN" />
      </>
    );
  }

  const familia = chave === 'dist' ? null : eEsforco(chave) ? ESFORCOS : COMPRIMENTOS;
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className="modal-caixa janela-didatica" role="dialog" aria-label={TITULO[chave]}>
        <div className="modal-cabeca">
          <h3>{TITULO[chave]}</h3>
          {familia && <Seg opcoes={familia.map((a) => [a, ROTULO_DA_ABA[a] ?? a] as [ChaveDaAjuda, ReactNode])} valor={chave} mudar={trocar} />}
          <button type="button" className="btn-icone" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)">
            ✕
          </button>
        </div>
        {controles && <div className="didatica-abas">{controles}</div>}
        <div className={`didatica-corpo${chave === 'dist' ? ' larga' : ''}`}>
          <div className="didatica-palco">{palco}</div>
          <div className="didatica-lado">
            <fieldset className="cad-bloco">
              <legend>{nome}</legend>
              {dados}
            </fieldset>
          </div>
        </div>
      </div>
    </div>
  );
}
