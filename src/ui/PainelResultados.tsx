// ═══════════════════════════════════════════════════════════════════════════
//  ui/PainelResultados.tsx — a coluna da direita: a seção cotada com as
//  propriedades e o quadro de aproveitamento
// ═══════════════════════════════════════════════════════════════════════════

import { useState, type ReactNode } from 'react';
import type { ResultadoDaVerificacao } from '../motor/norma';
import type { ChaveDaVerificacao } from '../motor/norma/memoria';
import type { PropriedadesDaSecao } from '../motor/secao/propriedades';
import type { SecaoGeometrica } from '../motor/secao/tipos';
import type { DesenhoDaSecao } from '../visualizacao/geometriaDaSecao';
import { SecaoPerfil2D } from '../visualizacao/SecaoPerfil2D';
import { CardVerificacao } from './CardVerificacao';
import { PainelPropriedades } from './PainelPropriedades';

interface Props {
  resultado: ResultadoDaVerificacao | null;
  sec: SecaoGeometrica;
  pr: PropriedadesDaSecao;
  desenho: DesenhoDaSecao;
  nome: string;
  /** Os botões da memória, quando houver (etapa 6). */
  acoes?: ReactNode;
}

export function PainelResultados({ resultado, sec, pr, desenho, nome, acoes }: Props) {
  const [aberta, setAberta] = useState<ChaveDaVerificacao | null>(null);
  return (
    <div className="painel-resultados">
      <fieldset className="cad-bloco bloco-secao">
        <legend>Seção</legend>
        <div className="secao-e-props">
          <div className="secao-desenho">
            <SecaoPerfil2D desenho={desenho} nome={nome} />
          </div>
          <PainelPropriedades sec={sec} pr={pr} />
        </div>
      </fieldset>

      <fieldset className={`cad-bloco bloco-aprov${resultado ? '' : ' calculando'}`}>
        <legend>Aproveitamento</legend>
        <div className="aprov-cabeca">
          <span />
          <span />
          <span className="aprov-col">
            S<sub>d</sub>/R<sub>d</sub>
          </span>
          <span className="aprov-col">
            S<sub>d</sub> / R<sub>d</sub>
          </span>
          <span className="aprov-col esq">Governa</span>
        </div>
        {resultado?.lista.map((v) => (
          <CardVerificacao key={v.chave} v={v} aberta={aberta === v.chave} alternar={() => setAberta((a) => (a === v.chave ? null : v.chave))} />
        ))}
      </fieldset>
      {acoes && <div className="acoes">{acoes}</div>}
    </div>
  );
}
