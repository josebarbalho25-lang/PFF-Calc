// ═══════════════════════════════════════════════════════════════════════════
//  ui/CardVerificacao.tsx — uma linha do quadro de aproveitamento
// ---------------------------------------------------------------------------
//  Fechada: nome, item da norma, barra, Sd/Rd, os dois números e o
//  estado-limite que governa. Aberta (clique): as contas da memória daquela
//  verificação, as mesmas linhas que vão para o papel — o engenheiro confere
//  na tela sem abrir o relatório inteiro.
// ═══════════════════════════════════════════════════════════════════════════

import type { Verificacao } from '../motor/norma/memoria';
import { contasHtml } from '../relatorio/expr';
import { num } from '../relatorio/formatos';
import { BarraAproveitamento } from './BarraAproveitamento';

interface Props {
  v: Verificacao;
  aberta: boolean;
  alternar: () => void;
}

const casas = (u: string) => (u === 'kN·cm' ? 0 : 1);

export function CardVerificacao({ v, aberta, alternar }: Props) {
  const combinada = v.chave === 'combinada';
  return (
    <div className={`card-verif ${v.situacao}${aberta ? ' aberta' : ''}`}>
      <button type="button" className="card-cabeca" onClick={alternar} aria-expanded={aberta}>
        <span className="card-nome">
          {v.titulo}
          <span className="card-item">{v.item}</span>
        </span>
        <BarraAproveitamento razao={v.naoVerificada ? 0 : v.razao} situacao={v.situacao} />
        <span className="card-razao">{num(v.razao, 3)}</span>
        <span className="card-valores">
          {combinada ? (
            <span className="nevoa">—</span>
          ) : (
            <>
              {num(v.sd, casas(v.unidade))}
              <span className="nevoa"> / </span>
              {num(v.rd, casas(v.unidade))}
              <span className="unidade"> {v.unidade}</span>
            </>
          )}
        </span>
        <span className="card-governa">{v.governa}</span>
      </button>
      {aberta && (
        <div className="card-corpo">
          {v.avisos.map((a) => (
            <div key={a} className="card-aviso">
              {a}
            </div>
          ))}
          {v.notas?.map((a) => (
            <div key={a} className="card-nota">
              {a}
            </div>
          ))}
          {v.passos.map((p, i) => (
            <div key={i} className="card-passo">
              <div className="card-passo-ref">{p.ref}</div>
              <div className="card-passo-conteudo">
                <div className="card-passo-titulo">{p.titulo}</div>
                {/* HTML montado só com texto escapado (relatorio/expr.ts). */}
                <div dangerouslySetInnerHTML={{ __html: contasHtml(p) }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
