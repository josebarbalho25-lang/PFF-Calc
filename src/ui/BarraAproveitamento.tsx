// ═══════════════════════════════════════════════════════════════════════════
//  ui/BarraAproveitamento.tsx — o índice Sd/Rd como barra
// ---------------------------------------------------------------------------
//  A régua vai de 0 a 1,0 — o fim da trilha É o limite. Passou de 1,0, a
//  barra enche e fica vermelha, e o número diz quanto passou: esticar a régua
//  até o valor faria a barra de 1,30 parecer menos cheia que a de 0,98 de
//  outra verificação, que é o contrário do que importa.
//
//  Cor só para o dado: verde atende, âmbar "avaliar" (atende com ressalva),
//  vermelho não atende — os tokens --ok, --warn, --err do A-PORT.
// ═══════════════════════════════════════════════════════════════════════════

import type { Situacao } from '../motor/norma/memoria';

interface Props {
  razao: number;
  situacao: Situacao;
}

export function BarraAproveitamento({ razao, situacao }: Props) {
  const cheio = Number.isFinite(razao) ? Math.min(Math.max(razao, 0), 1) : 1;
  return (
    <div className={`barra-aprov ${situacao}`} role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={razao}>
      <div className="trilha">
        <div className="enchimento" style={{ width: `${cheio * 100}%` }} />
      </div>
    </div>
  );
}
