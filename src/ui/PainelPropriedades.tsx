// ═══════════════════════════════════════════════════════════════════════════
//  ui/PainelPropriedades.tsx — as propriedades da seção bruta, ao lado do corte
// ---------------------------------------------------------------------------
//  Rótulo, valor, unidade. Os símbolos são os da norma (3.2): J é a constante
//  de torção, Cw a de empenamento, x0 e y0 o centro de torção a partir do
//  centroide, r0 o raio de giração polar em relação ao centro de torção.
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { secaoDoPerfil } from '../motor/norma/compressao';
import type { PropriedadesDaSecao } from '../motor/secao/propriedades';
import type { SecaoGeometrica } from '../motor/secao/tipos';
import { num } from '../relatorio/formatos';

const PAPEL = { alma: 'alma', mesa: 'mesa', enrijecedor: 'enrij.', aba: 'aba' } as const;

function Prop({ rotulo, valor, un }: { rotulo: ReactNode; valor: string; un?: string }) {
  return (
    <div className="prop">
      <span className="prop-rotulo">{rotulo}</span>
      <span className="prop-valor">{valor}</span>
      <span className="prop-un">{un ?? ''}</span>
    </div>
  );
}

const s = (base: string, indice: string) => (
  <>
    <i>{base}</i>
    <sub>{indice}</sub>
  </>
);

/** Casas pelo tamanho, para o número da tabela caber e ainda dizer algo. */
function v(x: number): string {
  const a = Math.abs(x);
  return num(x, a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 3 : 4);
}

export function PainelPropriedades({ sec, pr }: { sec: SecaoGeometrica; pr: PropriedadesDaSecao }) {
  const girado = Math.abs(pr.Ixy) > 1e-9 * Math.max(pr.Ix, pr.Iy);
  const wxIgual = Math.abs(pr.Wx.sup - pr.Wx.inf) < 1e-9 * pr.Wx.sup;
  const wyIgual = Math.abs(pr.Wy.esq - pr.Wy.dir) < 1e-9 * pr.Wy.esq;
  // Massa linear: A (cm²) × 7 850 kg/m³ (4.6) × 10⁻⁴ m²/cm².
  const massa = pr.A * 0.785;

  return (
    <div className="props">
      <Prop rotulo={<i>A</i>} valor={v(pr.A)} un="cm²" />
      <Prop rotulo={<i>m</i>} valor={v(massa)} un="kg/m" />
      <Prop rotulo={s('I', 'x')} valor={v(pr.Ix)} un="cm⁴" />
      <Prop rotulo={s('I', 'y')} valor={v(pr.Iy)} un="cm⁴" />
      {girado && (
        <>
          <Prop rotulo={s('I', 'xy')} valor={v(pr.Ixy)} un="cm⁴" />
          <Prop rotulo={<i>α</i>} valor={num((pr.alfa * 180) / Math.PI, 2)} un="°" />
          <Prop rotulo={s('I', '1')} valor={v(pr.I1)} un="cm⁴" />
          <Prop rotulo={s('I', '2')} valor={v(pr.I2)} un="cm⁴" />
        </>
      )}
      <Prop rotulo={s('r', 'x')} valor={v(pr.rx)} un="cm" />
      <Prop rotulo={s('r', 'y')} valor={v(pr.ry)} un="cm" />
      {wxIgual ? (
        <Prop rotulo={s('W', 'x')} valor={v(pr.Wx.sup)} un="cm³" />
      ) : (
        <>
          <Prop rotulo={s('W', 'x,sup')} valor={v(pr.Wx.sup)} un="cm³" />
          <Prop rotulo={s('W', 'x,inf')} valor={v(pr.Wx.inf)} un="cm³" />
        </>
      )}
      {wyIgual ? (
        <Prop rotulo={s('W', 'y')} valor={v(pr.Wy.esq)} un="cm³" />
      ) : (
        <>
          <Prop rotulo={s('W', 'y,esq')} valor={v(pr.Wy.esq)} un="cm³" />
          <Prop rotulo={s('W', 'y,dir')} valor={v(pr.Wy.dir)} un="cm³" />
        </>
      )}
      <Prop rotulo={s('x', '0')} valor={v(pr.x0)} un="cm" />
      <Prop rotulo={s('y', '0')} valor={v(pr.y0)} un="cm" />
      <Prop rotulo={s('r', '0')} valor={v(pr.r0)} un="cm" />
      <Prop rotulo={<i>J</i>} valor={v(pr.J)} un="cm⁴" />
      <Prop rotulo={s('C', 'w')} valor={v(pr.Cw)} un="cm⁶" />
      {/* os elementos que a flambagem local lê: na solda intermitente, os de um Ue */}
      {secaoDoPerfil(sec).sec.elementos
        .filter((el, i, todos) => todos.findIndex((o) => o.papel === el.papel && Math.abs(o.b - el.b) < 1e-9) === i)
        .map((el, i) => (
        <Prop
          key={i}
          rotulo={
            <>
              <i>b</i>/<i>t</i>
            </>
          }
          valor={num(el.b / (el.t ?? sec.t), 1)}
          un={PAPEL[el.papel]}
        />
      ))}
    </div>
  );
}
