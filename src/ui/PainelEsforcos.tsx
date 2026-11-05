// ═══════════════════════════════════════════════════════════════════════════
//  ui/PainelEsforcos.tsx — esforços, comprimentos e o método do local, na
//  coluna da esquerda
// ---------------------------------------------------------------------------
//  Rótulo, valor, unidade; o (?) abre a janela animada do esforço ou do
//  comprimento — é a animação que mostra em que plano cada esforço age (Mx e
//  Vy no plano da alma, My e Vx no das mesas). Copiado da calculadora 8800.
// ═══════════════════════════════════════════════════════════════════════════

import type { Comprimentos, Esforcos, MetodoDoLocal } from '../motor/norma/tipos';
import type { ChaveDaAjuda } from '../visualizacao/modais/JanelaDidatica';
import { CampoNumero } from './CampoNumero';
import type { EstadoDoAnexoF } from './guardarEntrada';

interface Props {
  esforcos: Esforcos;
  comprimentos: Comprimentos;
  metodo: MetodoDoLocal;
  anexoF: EstadoDoAnexoF;
  mudarAnexoF: (a: EstadoDoAnexoF) => void;
  mudarEsforcos: (f: Esforcos) => void;
  mudarComprimentos: (L: Comprimentos) => void;
  mudarMetodo: (m: MetodoDoLocal) => void;
  abrirAjuda: (c: ChaveDaAjuda) => void;
}

function Ajuda({ chave, abrir }: { chave: ChaveDaAjuda; abrir: (c: ChaveDaAjuda) => void }) {
  return (
    <button type="button" className="btn-ajuda" onClick={() => abrir(chave)} title={`${chave}: ver a animação`} aria-label={`Ajuda de ${chave}`}>
      ?
    </button>
  );
}

const sub = (base: string, indice: string) => (
  <span>
    <i>{base}</i>
    <sub>{indice}</sub>
  </span>
);

// A 14762:2010 escreve o comprimento de flambagem como KxLx, KyLy, KzLz (a
// 8800:2024 tirou o K; aqui a norma é outra). O dado é o produto.
const kl = (e: string) => (
  <span>
    <i>K</i>
    <sub>{e}</sub>
    <i>L</i>
    <sub>{e}</sub>
  </span>
);

const METODOS: [MetodoDoLocal, string][] = [
  ['MLE', 'Largura efetiva'],
  ['MSE', 'Seção efetiva'],
  ['MRD', 'Resistência direta'],
];

// As condições de F.1 que dependem da obra: o engenheiro marca. Rótulo curto,
// com a letra da norma — o texto inteiro está na norma e na memória.
const DECLARADAS: [keyof EstadoDoAnexoF['declaradas'], string][] = [
  ['f', 'f) Traspasse ≥ 1,5·bw'],
  ['h', 'h) Mesas travadas nos apoios'],
  ['i', 'i) Painel'],
  ['j', 'j) Conectores'],
  ['k', 'k) Sem conector não padronizado'],
  ['l', 'l) Conectores a ≤ 300 mm'],
  ['F4', 'F.4) Fora de balanço e de inflexão'],
];

function PainelAnexoF({ a, mudar }: { a: EstadoDoAnexoF; mudar: (a: EstadoDoAnexoF) => void }) {
  const seg = <K extends 'mesaComTelha' | 'barra'>(k: K, opcoes: [EstadoDoAnexoF[K], string][]) => (
    <div className="segmentado">
      {opcoes.map(([v, nome]) => (
        <button key={v} type="button" className={a[k] === v ? 'ativo' : ''} onClick={() => mudar({ ...a, [k]: v })}>
          {nome}
        </button>
      ))}
    </div>
  );
  return (
    <fieldset className="cad-bloco anexo-f">
      <legend>
        <label className="marca">
          <input type="checkbox" checked={a.ligado} onChange={(ev) => mudar({ ...a, ligado: ev.target.checked })} />
          Anexo F · telha na mesa tracionada
        </label>
      </legend>
      {a.ligado && (
        <>
          <div className="cad-linha">
            <label>Telha na mesa</label>
            {seg('mesaComTelha', [['superior', 'Superior'], ['inferior', 'Inferior']])}
          </div>
          <div className="cad-linha">
            <label>Barra</label>
            {seg('barra', [['biapoiada', 'Biapoiada'], ['continua', 'Contínua']])}
          </div>
          {a.barra === 'continua' && <CampoNumero rotulo="Relação entre vãos" valor={a.relacaoVaos} positivo aoMudar={(relacaoVaos) => mudar({ ...a, relacaoVaos })} />}
          <CampoNumero rotulo="Vão" valor={a.vao} unidade="cm" positivo aoMudar={(vao) => mudar({ ...a, vao })} />
          <div className="declaradas">
            {DECLARADAS.filter(([k]) => k !== 'f' || a.barra === 'continua').map(([k, rotulo]) => (
              <label key={k} className="marca">
                <input type="checkbox" checked={a.declaradas[k]} onChange={(ev) => mudar({ ...a, declaradas: { ...a.declaradas, [k]: ev.target.checked } })} />
                {rotulo}
              </label>
            ))}
          </div>
        </>
      )}
    </fieldset>
  );
}

export function PainelEsforcos({ esforcos: f, comprimentos: L, metodo, anexoF, mudarAnexoF, mudarEsforcos, mudarComprimentos, mudarMetodo, abrirAjuda }: Props) {
  const esforco = (k: keyof Esforcos) => (v: number) => mudarEsforcos({ ...f, [k]: v });
  const comp = (k: keyof Comprimentos) => (v: number) => mudarComprimentos({ ...L, [k]: v });

  return (
    <>
      <fieldset className="cad-bloco">
        <legend>Flambagem local</legend>
        <div className="cad-linha">
          <label>
            <span>Método</span>
            <Ajuda chave="dist" abrir={abrirAjuda} />
          </label>
          <select className="campo texto" value={metodo} onChange={(ev) => mudarMetodo(ev.target.value as MetodoDoLocal)}>
            {METODOS.map(([m, nome]) => (
              <option key={m} value={m}>
                {m} · {nome}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="cad-bloco">
        <legend>Esforços solicitantes de cálculo</legend>
        <CampoNumero rotulo={sub('N', 'Sd')} valor={f.N} unidade="kN" aoMudar={esforco('N')} ajuda={<Ajuda chave="N" abrir={abrirAjuda} />} titulo="Positivo comprime, negativo traciona" />
        <CampoNumero rotulo={sub('M', 'x,Sd')} valor={f.Mx} unidade="kN·cm" aoMudar={esforco('Mx')} ajuda={<Ajuda chave="Mx" abrir={abrirAjuda} />} titulo="Positivo comprime em cima" />
        <CampoNumero rotulo={sub('M', 'y,Sd')} valor={f.My} unidade="kN·cm" aoMudar={esforco('My')} ajuda={<Ajuda chave="My" abrir={abrirAjuda} />} titulo="Positivo comprime o lado +x" />
        <CampoNumero rotulo={sub('V', 'x,Sd')} valor={f.Vx} unidade="kN" aoMudar={esforco('Vx')} ajuda={<Ajuda chave="Vx" abrir={abrirAjuda} />} />
        <CampoNumero rotulo={sub('V', 'y,Sd')} valor={f.Vy} unidade="kN" aoMudar={esforco('Vy')} ajuda={<Ajuda chave="Vy" abrir={abrirAjuda} />} />
      </fieldset>

      <fieldset className="cad-bloco">
        <legend>Comprimentos de flambagem</legend>
        <CampoNumero rotulo={kl('x')} valor={L.Lx} unidade="cm" minimo={0} aoMudar={comp('Lx')} ajuda={<Ajuda chave="Lx" abrir={abrirAjuda} />} titulo="Zero: travada em x" />
        <CampoNumero rotulo={kl('y')} valor={L.Ly} unidade="cm" minimo={0} aoMudar={comp('Ly')} ajuda={<Ajuda chave="Ly" abrir={abrirAjuda} />} titulo="Zero: travada em y" />
        <CampoNumero rotulo={kl('z')} valor={L.Lz} unidade="cm" minimo={0} aoMudar={comp('Lz')} ajuda={<Ajuda chave="Lz" abrir={abrirAjuda} />} titulo="Zero: travada à torção" />
        <CampoNumero rotulo={sub('C', 'b')} valor={L.Cb} minimo={1} aoMudar={comp('Cb')} ajuda={<Ajuda chave="Cb" abrir={abrirAjuda} />} />
        <CampoNumero rotulo={<i>a</i>} valor={L.a} unidade="cm" minimo={0} aoMudar={comp('a')} ajuda={<Ajuda chave="a" abrir={abrirAjuda} />} titulo="Zero: sem enrijecedores" />
      </fieldset>

      <PainelAnexoF a={anexoF} mudar={mudarAnexoF} />
    </>
  );
}
