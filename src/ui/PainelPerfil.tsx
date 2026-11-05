// ═══════════════════════════════════════════════════════════════════════════
//  ui/PainelPerfil.tsx — o perfil e o aço, na coluna da esquerda
// ---------------------------------------------------------------------------
//  ENTRADA LIVRE (decisão dele, 01/11/2026): o projetista digita as dimensões
//  que quiser. O catálogo da NBR 6355 é atalho — escolher um perfil só
//  preenche os campos, e mexer num campo depois já é perfil livre.
// ═══════════════════════════════════════════════════════════════════════════

import { ACOS } from '../motor/catalogos/acos';
import { PERFIS_PADRONIZADOS } from '../motor/catalogos/perfisPadronizados';
import { desenhoDaFamilia } from '../motor/secao/familias';
import type { DimensoesDoPerfil, FamiliaDePerfil, SecaoDesenhada } from '../motor/secao/tipos';
import { num } from '../relatorio/formatos';
import { CampoNumero } from './CampoNumero';

export const NOMES_DAS_FAMILIAS: Record<FamiliaDePerfil, string> = {
  U: 'U simples',
  Ue: 'U enrijecido',
  Z: 'Z simples',
  Ze: 'Z enrijecido',
  Cr: 'Cartola',
  L: 'Cantoneira',
  Le: 'Cantoneira enrijecida',
  Ue2: 'Dois Ue boca com boca',
  Desenho: 'Seção desenhada',
};

const COM_ENRIJECEDOR: FamiliaDePerfil[] = ['Ue', 'Ue2', 'Ze', 'Cr', 'Le'];

/** Espaçamento de partida das soldas intermitentes, cm. */
const S_DE_PARTIDA = 50;

/** A família do catálogo: os dois Ue escolhem o Ue da NBR 6355. */
const familiaDoCatalogo = (f: FamiliaDePerfil): FamiliaDePerfil => (f === 'Ue2' ? 'Ue' : f);

/** Ao trocar de família: o que a nova pede e a velha não tinha. */
export function trocarFamilia(p: DimensoesDoPerfil, familia: FamiliaDePerfil): DimensoesDoPerfil {
  const D = COM_ENRIJECEDOR.includes(familia) ? p.D || 20 : 0;
  let desenho: SecaoDesenhada | undefined = p.desenho;
  if (familia === 'Desenho' && !desenho) {
    try {
      desenho = desenhoDaFamilia(p);
    } catch {
      desenho = { nos: [], trechos: [] };
    }
  }
  return {
    ...p,
    familia,
    D,
    anguloEnrijecedor: familia === 'Ze' ? p.anguloEnrijecedor ?? 90 : undefined,
    solda: familia === 'Ue2' ? p.solda ?? { tipo: 'continua' } : undefined,
    // o desenho fica guardado ao passear por outra família: voltar não apaga
    desenho,
  };
}

/** Aço da lista pelo nome, ou "outro" com fy e fu digitados. */
export interface EscolhaDoAco {
  nome: string;
  fy: number;
  fu: number;
}

export const OUTRO_ACO = 'Outro';

interface Props {
  perfil: DimensoesDoPerfil;
  mudarPerfil: (p: DimensoesDoPerfil) => void;
  aco: EscolhaDoAco;
  mudarAco: (a: EscolhaDoAco) => void;
}

const sub = (base: string, indice: string) => (
  <span>
    <i>{base}</i>
    <sub>{indice}</sub>
  </span>
);

/** O nome do catálogo que tem exatamente estas dimensões, se houver. */
function nomeNoCatalogo(p: DimensoesDoPerfil): string {
  const achado = PERFIS_PADRONIZADOS.find(
    (c) =>
      c.familia === familiaDoCatalogo(p.familia) &&
      c.bw === p.bw &&
      c.bf === p.bf &&
      c.D === p.D &&
      c.t === p.t &&
      (c.ang ?? 90) === (p.anguloEnrijecedor ?? 90),
  );
  return achado?.nome ?? '';
}

export function PainelPerfil({ perfil, mudarPerfil, aco, mudarAco }: Props) {
  const f = perfil.familia;
  const dim = (k: 'bw' | 'bf' | 'D' | 't' | 'ri') => (v: number) => mudarPerfil({ ...perfil, [k]: v });
  const doCatalogo = f === 'Desenho' ? [] : PERFIS_PADRONIZADOS.filter((c) => c.familia === familiaDoCatalogo(f));
  const atual = nomeNoCatalogo(perfil);
  const outro = aco.nome === OUTRO_ACO;

  return (
    <>
      <fieldset className="cad-bloco">
        <legend>Perfil</legend>
        <div className="cad-linha">
          <label>Família</label>
          <select
            className="campo texto"
            value={f}
            onChange={(ev) => mudarPerfil(trocarFamilia(perfil, ev.target.value as FamiliaDePerfil))}
          >
            {(Object.keys(NOMES_DAS_FAMILIAS) as FamiliaDePerfil[]).map((k) => (
              <option key={k} value={k}>
                {NOMES_DAS_FAMILIAS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="cad-linha">
          <label>NBR 6355</label>
          <select
            className="campo texto"
            value={atual}
            disabled={doCatalogo.length === 0}
            onChange={(ev) => {
              const c = PERFIS_PADRONIZADOS.find((p) => p.nome === ev.target.value);
              if (c) mudarPerfil({ ...perfil, bw: c.bw, bf: c.bf, D: c.D, t: c.t, ri: c.t, anguloEnrijecedor: c.familia === 'Ze' ? c.ang ?? 90 : undefined });
            }}
          >
            <option value="">{doCatalogo.length ? 'livre' : '—'}</option>
            {doCatalogo.map((c) => (
              <option key={c.nome} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        {f !== 'Desenho' && <CampoNumero rotulo={sub('b', 'w')} valor={perfil.bw} unidade="mm" minimo={0} aoMudar={dim('bw')} />}
        {f !== 'Desenho' && <CampoNumero rotulo={sub('b', 'f')} valor={perfil.bf} unidade="mm" minimo={0} aoMudar={dim('bf')} />}
        {COM_ENRIJECEDOR.includes(f) && <CampoNumero rotulo={<i>D</i>} valor={perfil.D} unidade="mm" minimo={0} aoMudar={dim('D')} />}
        <CampoNumero rotulo={<i>t</i>} valor={perfil.t} unidade="mm" minimo={0} aoMudar={dim('t')} />
        <CampoNumero rotulo={sub('r', 'i')} valor={perfil.ri} unidade="mm" minimo={0} aoMudar={dim('ri')} />
        {f === 'Ze' && (
          <div className="cad-linha">
            <label>θ</label>
            <div className="cad-valor">
              <select
                className="campo texto"
                value={perfil.anguloEnrijecedor ?? 90}
                onChange={(ev) => mudarPerfil({ ...perfil, anguloEnrijecedor: Number(ev.target.value) })}
              >
                <option value={90}>90</option>
                <option value={45}>45</option>
              </select>
              <span className="unidade">°</span>
            </div>
          </div>
        )}
        {f === 'Ue2' && (
          <div className="cad-linha">
            <label>Solda</label>
            <select
              className="campo texto"
              value={perfil.solda?.tipo ?? 'continua'}
              onChange={(ev) =>
                mudarPerfil({ ...perfil, solda: ev.target.value === 'intermitente' ? { tipo: 'intermitente', s: S_DE_PARTIDA } : { tipo: 'continua' } })
              }
            >
              <option value="continua">contínua</option>
              <option value="intermitente">intermitente</option>
            </select>
          </div>
        )}
        {f === 'Ue2' && perfil.solda?.tipo === 'intermitente' && (
          <CampoNumero rotulo={<i>s</i>} valor={perfil.solda.s} unidade="cm" positivo aoMudar={(s) => mudarPerfil({ ...perfil, solda: { tipo: 'intermitente', s } })} />
        )}
      </fieldset>

      <fieldset className="cad-bloco">
        <legend>Aço</legend>
        <select
          className="campo texto"
          value={aco.nome}
          onChange={(ev) => {
            const a = ACOS.find((x) => x.nome === ev.target.value);
            mudarAco(a ? { nome: a.nome, fy: a.fy, fu: a.fu } : { ...aco, nome: OUTRO_ACO });
          }}
        >
          {ACOS.map((a) => (
            <option key={a.nome} value={a.nome}>
              {a.nome}
            </option>
          ))}
          <option value={OUTRO_ACO}>{OUTRO_ACO}</option>
        </select>
        {outro ? (
          <>
            <CampoNumero rotulo={sub('f', 'y')} valor={aco.fy} unidade="kN/cm²" positivo aoMudar={(fy) => mudarAco({ ...aco, fy })} />
            <CampoNumero rotulo={sub('f', 'u')} valor={aco.fu} unidade="kN/cm²" positivo aoMudar={(fu) => mudarAco({ ...aco, fu })} />
          </>
        ) : (
          <>
            <div className="cad-linha">
              <label>{sub('f', 'y')}</label>
              <div className="cad-valor">
                <span className="valor-derivado">{num(aco.fy, 1)}</span>
                <span className="unidade">kN/cm²</span>
              </div>
            </div>
            <div className="cad-linha">
              <label>{sub('f', 'u')}</label>
              <div className="cad-valor">
                <span className="valor-derivado">{num(aco.fu, 1)}</span>
                <span className="unidade">kN/cm²</span>
              </div>
            </div>
          </>
        )}
      </fieldset>
    </>
  );
}
