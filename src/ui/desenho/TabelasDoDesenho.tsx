// ═══════════════════════════════════════════════════════════════════════════
//  ui/desenho/TabelasDoDesenho.tsx — as tabelas de nós e de trechos
// ---------------------------------------------------------------------------
//  Para corrigir depois de desenhar: x e y de cada nó, os dois nós e a
//  espessura de cada trecho. A numeração é a mesma do quadro (a partir de 1);
//  o dado guarda a partir de 0, e a troca é só aqui.
//
//  ⚠️ A CÉLULA SEGURA O TEXTO ENQUANTO TEM O FOCO (a lição do CampoNumero):
//  o número só sobe no Enter ou ao sair, e o Esc desiste pela ref. Sem isso,
//  digitar "12," reescreveria a célula com "12" no meio da digitação.
//
//  A espessura vazia é a da seção (o campo t do painel do perfil): só se
//  preenche o trecho que é diferente.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import type { SecaoDesenhada } from '../../motor/secao/tipos';
import { lerNumero, numExato } from '../../relatorio/formatos';
import { apagarNo, apagarTrecho, moverNo, mudarTrecho, novoNo, novoTrecho } from './edicao';
import type { AlvoSobCursor } from './encaixe';

interface PropsDaCelula {
  valor: number | undefined;
  aoMudar: (v: number | undefined) => void;
  /** Aceita a célula vazia (vira `undefined`). */
  vazio?: boolean;
  inteiro?: boolean;
  minimo?: number;
  maximo?: number;
  positivo?: boolean;
  dica?: string;
}

const mostrar = (v: number | undefined) => (v === undefined ? '' : numExato(v, 4));

function Celula({ valor, aoMudar, vazio, inteiro, minimo, maximo, positivo, dica }: PropsDaCelula) {
  const [texto, setTexto] = useState(mostrar(valor));
  const [editando, setEditando] = useState(false);
  const desistiu = useRef(false);
  const mexeu = useRef(false);
  const lido: number | undefined | null = texto.trim() === '' ? (vazio ? undefined : null) : lerNumero(texto);
  const errado =
    lido === null ||
    (lido !== undefined &&
      ((inteiro === true && !Number.isInteger(lido)) || (minimo !== undefined && lido < minimo) || (maximo !== undefined && lido > maximo) || (positivo === true && lido <= 0)));

  useEffect(() => {
    if (!editando) setTexto(mostrar(valor));
  }, [valor, editando]);

  function confirmar() {
    setEditando(false);
    const editou = mexeu.current;
    mexeu.current = false;
    if (desistiu.current || errado || !editou) {
      desistiu.current = false;
      setTexto(mostrar(valor));
      return;
    }
    if (lido !== valor) aoMudar(lido as number | undefined);
  }

  return (
    <input
      className={`campo numero des-celula${editando && errado ? ' errado' : ''}`}
      inputMode="decimal"
      value={texto}
      placeholder={dica}
      onFocus={(e) => {
        setEditando(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        mexeu.current = true;
        setTexto(e.target.value);
      }}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          desistiu.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

interface Props {
  desenho: SecaoDesenhada;
  /** Espessura da seção, mm — a dica da célula vazia. */
  t: number;
  passo: number;
  mudar: (d: SecaoDesenhada) => void;
  realce: AlvoSobCursor | null;
  realcar: (a: AlvoSobCursor | null) => void;
}

export function TabelasDoDesenho({ desenho: d, t, passo, mudar, realce, realcar }: Props) {
  const n = d.nos.length;
  const realcado = (tipo: AlvoSobCursor['tipo'], k: number) => (realce?.tipo === tipo && realce.k === k ? 'realcado' : undefined);
  const novo = novoTrecho(d);

  return (
    <div className="des-tabelas" onMouseLeave={() => realcar(null)}>
      <fieldset className="cad-bloco">
        <legend>Nós</legend>
        <table className="des-tabela">
          <thead>
            <tr>
              <th />
              <th>
                <i>x</i>
              </th>
              <th>
                <i>y</i>
              </th>
              <th className="des-un">mm</th>
            </tr>
          </thead>
          <tbody>
            {d.nos.map((no, k) => (
              <tr key={k} className={realcado('no', k)} onMouseEnter={() => realcar({ tipo: 'no', k })}>
                <td className="des-indice">{k + 1}</td>
                <td>
                  <Celula valor={no.x} aoMudar={(x) => mudar(moverNo(d, k, { x: x!, y: no.y }))} />
                </td>
                <td>
                  <Celula valor={no.y} aoMudar={(y) => mudar(moverNo(d, k, { x: no.x, y: y! }))} />
                </td>
                <td>
                  <button type="button" className="des-tirar" title="Apagar nó" onClick={() => mudar(apagarNo(d, k))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="des-mais" title="Acrescentar nó" onClick={() => mudar(novoNo(d, passo))}>
          +
        </button>
      </fieldset>

      <fieldset className="cad-bloco">
        <legend>Trechos</legend>
        <table className="des-tabela">
          <thead>
            <tr>
              <th />
              <th>
                nó <i>i</i>
              </th>
              <th>
                nó <i>j</i>
              </th>
              <th>
                <i>t</i>
              </th>
              <th className="des-un">mm</th>
            </tr>
          </thead>
          <tbody>
            {d.trechos.map((tr, k) => (
              <tr key={k} className={realcado('trecho', k)} onMouseEnter={() => realcar({ tipo: 'trecho', k })}>
                <td className="des-indice">{k + 1}</td>
                <td>
                  <Celula valor={tr.i + 1} inteiro minimo={1} maximo={n} aoMudar={(v) => mudar(mudarTrecho(d, k, { i: v! - 1 }))} />
                </td>
                <td>
                  <Celula valor={tr.j + 1} inteiro minimo={1} maximo={n} aoMudar={(v) => mudar(mudarTrecho(d, k, { j: v! - 1 }))} />
                </td>
                <td>
                  <Celula valor={tr.t} vazio positivo dica={numExato(t, 4)} aoMudar={(v) => mudar(mudarTrecho(d, k, { t: v }))} />
                </td>
                <td>
                  <button type="button" className="des-tirar" title="Apagar trecho" onClick={() => mudar(apagarTrecho(d, k))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="des-mais" title="Acrescentar trecho" disabled={!novo} onClick={() => novo && mudar(novo)}>
          +
        </button>
      </fieldset>
    </div>
  );
}
