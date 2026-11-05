// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/composta.ts — barra composta comprimida (NBR 14762:2010, 9.7.5)
// ---------------------------------------------------------------------------
//  Dois Ue boca com boca com SOLDA INTERMITENTE: os perfis se tocam e a solda
//  os liga em trechos espaçados de s. É o caso a) de 9.7.5 — perfis ligados
//  por presilhas: o índice de esbeltez de cada perfil, entre as ligações, deve
//  ser inferior à METADE do índice de esbeltez máximo do conjunto.
//
//  ⚠️ O EN 1993-1-1 NÃO ENTRA AQUI. O texto de 9.7.5 o cita só para o
//  travejamento em quadro com talas (chapas regularmente espaçadas), que "não
//  é previsto nesta Norma". Perfis em contato soldados em trechos não são
//  travejamento em quadro; são o caso a). (O manual do DimPerfil, p. 6, item
//  16, resume diferente — vale o texto da norma.)
// ═══════════════════════════════════════════════════════════════════════════

import type { PropriedadesDaSecao } from '../secao/propriedades';
import { fr, n, situacaoPelaRazao, v, x, type Verificacao } from './memoria';
import type { Comprimentos } from './tipos';

/**
 * 9.7.5 a): λ de um perfil entre as ligações (s / r mínimo do Ue) contra a
 * metade do λ máximo do conjunto (KxLx/rx e KyLy/ry). `s` em cm.
 */
export function verificarBarraComposta(conjunto: PropriedadesDaSecao, perfil: PropriedadesDaSecao, L: Comprimentos, s: number, NcSd: number): Verificacao {
  const rmin = Math.sqrt(perfil.I2 / perfil.A);
  const lambdaPerfil = s / rmin;
  const lx = L.Lx > 0 ? L.Lx / conjunto.rx : 0;
  const ly = L.Ly > 0 ? L.Ly / conjunto.ry : 0;
  const lambdaConjunto = Math.max(lx, ly);
  const limite = 0.5 * lambdaConjunto;
  const comprimida = NcSd > 0;
  const razao = comprimida ? (limite > 0 ? lambdaPerfil / limite : Infinity) : 0;
  return {
    chave: 'barraComposta',
    titulo: 'Barra composta',
    item: '9.7.5',
    sd: lambdaPerfil,
    rd: limite,
    unidade: '',
    razao,
    situacao: situacaoPelaRazao(razao),
    governa: comprimida ? 'esbeltez de cada perfil entre as soldas' : undefined,
    passos: [
      {
        ref: '9.7.5 a)',
        titulo: 'Esbeltez de cada perfil entre as ligações (solda intermitente)',
        contas: [
          { simbolo: v('s'), valor: s, unidade: 'cm', rotulo: 'espaçamento das soldas' },
          { simbolo: v('r', 'mín'), valor: rmin, unidade: 'cm', rotulo: 'raio de giração mínimo de um Ue' },
          { simbolo: v('λ', 'perfil'), formula: fr(v('s'), v('r', 'mín')), numeros: fr(n(s), n(rmin)), valor: lambdaPerfil, casas: 1 },
          { simbolo: v('λ', 'máx'), formula: x('máx(', fr(x(v('K', 'x'), v('L', 'x')), v('r', 'x')), '; ', fr(x(v('K', 'y'), v('L', 'y')), v('r', 'y')), ')'), valor: lambdaConjunto, casas: 1, rotulo: 'do conjunto' },
          { simbolo: v('λ', 'perfil'), valor: lambdaPerfil, casas: 1, rotulo: `≤ 0,5·λmáx = ${limite.toFixed(1).replace('.', ',')}` },
        ],
      },
    ],
    avisos: [],
    notas: comprimida ? ['solda intermitente: a barra é composta (9.7.5); a solda contínua faria dela um tubo'] : ['só para barra comprimida (9.7.5): sem força de compressão'],
  };
}
