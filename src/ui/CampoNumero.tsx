// ═══════════════════════════════════════════════════════════════════════════
//  ui/CampoNumero.tsx — o campo de número: rótulo, valor, unidade
// ---------------------------------------------------------------------------
//  ⚠️ O TEXTO DIGITADO É DO CAMPO ENQUANTO ELE TEM O FOCO. Reescrever o campo
//  com o número formatado a cada tecla joga o cursor para o fim e come a
//  vírgula do meio ("1," vira "1"). O número só sobe no Enter ou ao sair; aí o
//  campo volta a mostrar o valor arrumado, com vírgula.
//
//  ⚠️ O Esc DESISTE PELA REF, não pelo estado: ele tira o foco, e o blur
//  roda na mesma volta com o texto ainda editado — pelo estado, o blur
//  confirmaria justamente o que o Esc mandou largar.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { lerNumero, numExato } from '../relatorio/formatos';

interface Props {
  rotulo: ReactNode;
  valor: number;
  unidade?: string;
  /** Menor valor aceito; abaixo disso o campo recusa e volta ao anterior. */
  minimo?: number;
  /** Recusa também o zero (fy e fu: com zero a norma não tem conta). */
  positivo?: boolean;
  casas?: number;
  aoMudar: (v: number) => void;
  /** O (?) da janela didática, quando houver. */
  ajuda?: ReactNode;
  titulo?: string;
}

export function CampoNumero({ rotulo, valor, unidade, minimo, positivo, casas = 4, aoMudar, ajuda, titulo }: Props) {
  const [texto, setTexto] = useState(numExato(valor, casas));
  const [editando, setEditando] = useState(false);
  const desistiu = useRef(false);
  const mexeu = useRef(false);
  const lido = lerNumero(texto);
  const errado = lido === null || (minimo !== undefined && lido < minimo) || (positivo === true && lido <= 0);

  useEffect(() => {
    if (!editando) setTexto(numExato(valor, casas));
  }, [valor, casas, editando]);

  // ⚠️ SÓ SOBE O QUE FOI DIGITADO. O campo mostra o valor arredondado em
  // `casas`; sem esta trava, passar pelo campo com o Tab devolvia o número
  // arredondado como se fosse novo (1,23456 virava 1,2346; 0,00001 virava 0).
  function confirmar() {
    setEditando(false);
    const editou = mexeu.current;
    mexeu.current = false;
    if (desistiu.current || errado || !editou) {
      desistiu.current = false;
      setTexto(numExato(valor, casas));
      return;
    }
    if (lido !== valor) aoMudar(lido);
  }

  return (
    <div className="cad-linha" title={titulo}>
      {/* O rótulo num span só: o label é flex (para o (?) ir à direita), e
          letra e índice soltos virariam dois itens separados pelo vão. */}
      <label>
        <span className="rotulo">{rotulo}</span>
        {ajuda}
      </label>
      <div className="cad-valor">
        <input
          className={`campo numero${editando && errado ? ' errado' : ''}`}
          inputMode="decimal"
          value={texto}
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
        <span className="unidade">{unidade ?? ''}</span>
      </div>
    </div>
  );
}
