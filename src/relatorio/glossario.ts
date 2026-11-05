// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/glossario.ts — o que quer dizer cada letra da memória
// ---------------------------------------------------------------------------
//  O glossário lista os símbolos que ESTA memória escreve: os das premissas,
//  que estão sempre lá, e os que as contas usaram — colhidos das próprias
//  fórmulas do motor, não de uma lista à parte. Memória de barra travada não
//  explica χFLT; a de perfil pelo MRD não explica Aef.
//
//  ⚠️ SÍMBOLO NOVO NO MOTOR PEDE VERBETE AQUI. O selo `glossario.test.ts`
//  roda famílias, métodos e cargas e falha se alguma conta escrever uma letra
//  que o glossário não explica — a memória assinada não pode ter incógnita
//  sem nome. (Mesmo mecanismo da calculadora 8800.)
//
//  Os textos seguem a Seção 3.2 (Simbologia) da NBR 14762:2010.
// ═══════════════════════════════════════════════════════════════════════════

import type { ResultadoDaVerificacao } from '../motor/norma';
import type { Expr } from '../motor/norma/memoria';
import { nota, passo, secao, v } from './pecas';

interface Verbete {
  /** "nome|índice", o mesmo par que o motor escreve em v(nome, índice). */
  chave: string;
  simbolo: string;
  texto: string;
  unidade?: string;
}

const ver = (nome: string, ind: string | undefined, texto: string, unidade?: string): Verbete => ({
  chave: `${nome}|${ind ?? ''}`,
  simbolo: v(nome, ind),
  texto,
  unidade,
});

const GRUPOS: ReadonlyArray<{ titulo: string; verbetes: Verbete[] }> = [
  {
    titulo: 'Seção transversal',
    verbetes: [
      ver('b', 'w', 'largura nominal da alma (dimensão externa)', 'mm'),
      ver('b', 'f', 'largura nominal da mesa (dimensão externa)', 'mm'),
      ver('D', undefined, 'largura nominal do enrijecedor de borda (dimensão externa)', 'mm'),
      ver('t', undefined, 'espessura da chapa', 'mm · cm'),
      ver('r', 'i', 'raio interno de dobramento', 'mm'),
      ver('b', undefined, 'largura plana do elemento, sem os cantos', 'cm'),
      ver('h', undefined, 'largura plana da alma (altura da parte plana)', 'cm'),
      ver('A', undefined, 'área bruta da seção transversal', 'cm²'),
      ver('A', 'n0', 'área líquida da seção fora da região da ligação (sem furos, igual a A)', 'cm²'),
      ver('A', 'n', 'área líquida da seção na região da ligação (9.6.2 c)', 'cm²'),
      ver('C', 't', 'coeficiente de redução da área líquida na região da ligação (9.6.2 c)'),
      ver('I', 'x', 'momento de inércia da seção bruta em relação ao eixo x', 'cm⁴'),
      ver('I', 'y', 'momento de inércia da seção bruta em relação ao eixo y', 'cm⁴'),
      ver('I', '1', 'momento de inércia em relação ao eixo principal de maior inércia', 'cm⁴'),
      ver('I', '2', 'momento de inércia em relação ao eixo principal de menor inércia', 'cm⁴'),
      ver('I', 'xy', 'produto de inércia da seção bruta em relação aos eixos x e y', 'cm⁴'),
      ver('α', undefined, 'ângulo do eixo principal 1 a partir do eixo x, no sentido anti-horário', '°'),
      ver('x', '0,1', 'distância do centro de torção ao centroide, na direção do eixo principal 1', 'cm'),
      ver('y', '0,2', 'distância do centro de torção ao centroide, na direção do eixo principal 2', 'cm'),
      ver('j', undefined, 'parâmetro da seção monossimétrica do Anexo E (E.2.1)', 'cm'),
      ver('r', 'x', 'raio de giração da seção bruta em relação ao eixo x', 'cm'),
      ver('r', 'y', 'raio de giração da seção bruta em relação ao eixo y', 'cm'),
      ver('r', '', 'raio de giração da seção bruta', 'cm'),
      ver('x', '0', 'distância do centro de torção ao centroide, na direção do eixo x', 'cm'),
      ver('y', '0', 'distância do centro de torção ao centroide, na direção do eixo y', 'cm'),
      ver('r', '0', 'raio de giração polar da seção bruta em relação ao centro de torção', 'cm'),
      ver('J', undefined, 'constante de torção da seção', 'cm⁴'),
      ver('C', 'w', 'constante de empenamento da seção', 'cm⁶'),
      ver('W', undefined, 'módulo de resistência elástico da seção bruta em relação à fibra extrema que atinge o escoamento', 'cm³'),
      ver('W', 'c', 'módulo de resistência elástico da seção bruta em relação à fibra extrema comprimida', 'cm³'),
    ],
  },
  {
    titulo: 'Material e coeficientes',
    verbetes: [
      ver('f', 'y', 'resistência ao escoamento do aço', 'kN/cm²'),
      ver('f', 'u', 'resistência à ruptura do aço', 'kN/cm²'),
      ver('E', undefined, 'módulo de elasticidade do aço', 'kN/cm²'),
      ver('G', undefined, 'módulo de elasticidade transversal do aço', 'kN/cm²'),
      ver('ν', undefined, 'coeficiente de Poisson do aço, 0,3'),
      ver('γ', undefined, 'coeficiente de ponderação da resistência (1,20 na compressão; 1,10 na tração, flexão e cortante)'),
    ],
  },
  {
    titulo: 'Esforços e comprimentos',
    verbetes: [
      ver('N', 'Sd', 'força axial solicitante de cálculo (positiva comprime)', 'kN'),
      ver('N', 't,Sd', 'força axial de tração solicitante de cálculo', 'kN'),
      ver('M', 'x,Sd', 'momento fletor solicitante de cálculo em torno do eixo x (positivo comprime em cima)', 'kN·cm'),
      ver('M', 'y,Sd', 'momento fletor solicitante de cálculo em torno do eixo y (positivo comprime o lado +x)', 'kN·cm'),
      ver('M', 'Sd,x', 'momento fletor solicitante de cálculo em torno do eixo x', 'kN·cm'),
      ver('M', 'Sd,y', 'momento fletor solicitante de cálculo em torno do eixo y', 'kN·cm'),
      ver('V', 'x,Sd', 'força cortante solicitante de cálculo na direção x', 'kN'),
      ver('V', 'y,Sd', 'força cortante solicitante de cálculo na direção y', 'kN'),
      ver('V', 'Sd', 'força cortante solicitante de cálculo', 'kN'),
      ver('V', 'Sd,x', 'força cortante solicitante de cálculo na direção x', 'kN'),
      ver('V', 'Sd,y', 'força cortante solicitante de cálculo na direção y', 'kN'),
      ver('K', 'x', 'coeficiente de flambagem por flexão em torno de x (o produto KxLx é o dado)'),
      ver('K', 'y', 'coeficiente de flambagem por flexão em torno de y (o produto KyLy é o dado)'),
      ver('K', 'z', 'coeficiente de flambagem por torção (o produto KzLz é o dado)'),
      ver('K', undefined, 'coeficiente de flambagem do eixo correspondente'),
      ver('L', 'x', 'comprimento de flambagem por flexão em torno de x', 'cm'),
      ver('L', 'y', 'comprimento de flambagem por flexão em torno de y', 'cm'),
      ver('L', 'z', 'comprimento de flambagem por torção e comprimento destravado da FLT', 'cm'),
      ver('L', undefined, 'comprimento de flambagem do eixo correspondente; nas faixas finitas, comprimento de meia-onda', 'cm'),
      ver('K', '1', 'coeficiente de flambagem por flexão em torno do eixo principal 1 (o produto K1L1 vem de KxLx ou KyLy)'),
      ver('K', '2', 'coeficiente de flambagem por flexão em torno do eixo principal 2 (o produto K2L2 vem de KxLx ou KyLy)'),
      ver('L', '1', 'comprimento de flambagem por flexão em torno do eixo principal 1', 'cm'),
      ver('L', '2', 'comprimento de flambagem por flexão em torno do eixo principal 2', 'cm'),
      ver('M', '1,Sd', 'momento fletor solicitante de cálculo em torno do eixo principal 1 (positivo comprime o lado 2 > 0)', 'kN·cm'),
      ver('M', '2,Sd', 'momento fletor solicitante de cálculo em torno do eixo principal 2 (positivo comprime o lado 1 > 0)', 'kN·cm'),
      ver('C', 'b', 'fator de modificação para momento fletor não uniforme'),
      ver('C', 's', 'sinal do momento no Anexo E: +1 quando comprime o lado do centro de torção, −1 quando o traciona'),
      ver('C', 'm', 'fator do Anexo E para momento não uniforme, tomado igual a 1,0 a favor da segurança'),
      ver('s', undefined, 'espaçamento das soldas entre os dois perfis da barra composta', 'cm'),
      ver('a', undefined, 'distância entre enrijecedores transversais da alma', 'cm'),
    ],
  },
  {
    titulo: 'Flambagem elástica',
    verbetes: [
      ver('N', undefined, 'força axial de referência das faixas finitas', 'kN'),
      ver('M', undefined, 'momento fletor de referência das faixas finitas', 'kN·cm'),
      ver('N', 'e', 'força axial de flambagem global elástica', 'kN'),
      ver('N', 'e1', 'força axial de flambagem global elástica por flexão em torno do eixo principal 1', 'kN'),
      ver('N', 'e2', 'força axial de flambagem global elástica por flexão em torno do eixo principal 2', 'kN'),
      ver('N', 'ex', 'força axial de flambagem global elástica por flexão em torno do eixo x', 'kN'),
      ver('N', 'ey', 'força axial de flambagem global elástica por flexão em torno do eixo y', 'kN'),
      ver('N', 'ez', 'força axial de flambagem global elástica por torção', 'kN'),
      ver('N', 'exz', 'força axial de flambagem global elástica por flexo-torção (9.7.2.2)', 'kN'),
      ver('N', 'ℓ', 'força axial de flambagem local elástica', 'kN'),
      ver('N', 'dist', 'força axial de flambagem distorcional elástica', 'kN'),
      ver('M', 'e', 'momento fletor de flambagem lateral com torção, em regime elástico', 'kN·cm'),
      ver('M', 'cr', 'momento fletor crítico das faixas finitas no comprimento KzLz (seção sem simetria)', 'kN·cm'),
      ver('r', 'mín', 'raio de giração mínimo de um perfil da barra composta', 'cm'),
      ver('λ', 'perfil', 'índice de esbeltez de um perfil entre as ligações da barra composta (9.7.5)'),
      ver('λ', 'máx', 'índice de esbeltez máximo do conjunto da barra composta (9.7.5)'),
      ver('M', 'ℓ', 'momento fletor de flambagem local elástica', 'kN·cm'),
      ver('M', 'dist', 'momento fletor de flambagem distorcional elástica', 'kN·cm'),
      ver('k', 'ℓ', 'coeficiente de flambagem local da seção completa (Tabelas 10 e 13)'),
      ver('η', undefined, 'relação bf/bw das tabelas de kℓ'),
    ],
  },
  {
    titulo: 'Resistência',
    verbetes: [
      ver('λ', '0', 'índice de esbeltez reduzido associado à flambagem global'),
      ver('χ', undefined, 'fator de redução da força axial de compressão associado à flambagem global'),
      ver('χ', 'FLT', 'fator de redução do momento fletor associado à flambagem lateral com torção'),
      ver('λ', 'p', 'índice de esbeltez reduzido do elemento ou da seção completa (flambagem local)'),
      ver('λ', 'ℓ', 'índice de esbeltez reduzido associado à flambagem local (MRD)'),
      ver('λ', 'dist', 'índice de esbeltez reduzido associado à flambagem distorcional'),
      ver('χ', 'dist', 'fator de redução associado à flambagem distorcional'),
      ver('σ', undefined, 'tensão normal de compressão para o cálculo da largura efetiva', 'kN/cm²'),
      ver('b', 'ef', 'largura efetiva do elemento', 'cm'),
      ver('A', 'ef', 'área efetiva da seção transversal', 'cm²'),
      ver('W', 'ef', 'módulo de resistência elástico da seção efetiva em relação à fibra extrema que atinge o escoamento', 'cm³'),
      ver('W', 'c,ef', 'módulo de resistência elástico da seção efetiva em relação à fibra extrema comprimida', 'cm³'),
      ver('k', 'v', 'coeficiente de flambagem local por cisalhamento'),
      ver('N', 't,Rd', 'força axial de tração resistente de cálculo', 'kN'),
      ver('N', 'c,Rd', 'força axial de compressão resistente de cálculo', 'kN'),
      ver('N', 'c,Rd,dist', 'força axial de compressão resistente de cálculo, flambagem distorcional', 'kN'),
      ver('N', 'c,Re', 'valor característico da força axial de compressão resistente, flambagem global (MRD)', 'kN'),
      ver('N', 'c,Rℓ', 'valor característico da força axial de compressão resistente, flambagem local (MRD)', 'kN'),
      ver('N', 'Rd', 'força axial resistente de cálculo, de tração ou de compressão', 'kN'),
      ver('M', 'Rd', 'momento fletor resistente de cálculo', 'kN·cm'),
      ver('M', 'Rd,FLT', 'momento fletor resistente de cálculo, flambagem lateral com torção', 'kN·cm'),
      ver('M', 'Rd,dist', 'momento fletor resistente de cálculo, flambagem distorcional', 'kN·cm'),
      ver('M', 'Rd,x', 'momento fletor resistente de cálculo em torno de x, do 9.8.2.1', 'kN·cm'),
      ver('M', 'Rd,y', 'momento fletor resistente de cálculo em torno de y, do 9.8.2.1', 'kN·cm'),
      ver('M', 'x,Rd', 'momento fletor resistente de cálculo em torno de x', 'kN·cm'),
      ver('M', 'y,Rd', 'momento fletor resistente de cálculo em torno de y', 'kN·cm'),
      ver('M', 'Re', 'valor característico do momento fletor resistente, flambagem global (MRD)', 'kN·cm'),
      ver('M', 'Rℓ', 'valor característico do momento fletor resistente, flambagem local (MRD)', 'kN·cm'),
      ver('V', 'Rd', 'força cortante resistente de cálculo', 'kN'),
      ver('V', 'Rd,x', 'força cortante resistente de cálculo na direção x', 'kN'),
      ver('V', 'Rd,y', 'força cortante resistente de cálculo na direção y', 'kN'),
      { chave: 'Sd/Rd', simbolo: `${v('S', 'd')}/${v('R', 'd')}`, texto: 'índice de utilização: solicitante de cálculo sobre resistente de cálculo (atende até 1,0)' },
    ],
  },
];

const VERBETES = new Map(GRUPOS.flatMap((g) => g.verbetes.map((vb) => [vb.chave, vb] as const)));

// As premissas e a flambagem elástica escrevem estes sempre, fora das contas.
const SEMPRE = [
  'b|w', 'b|f', 't|', 'r|i', 'b|', 'A|', 'I|x', 'I|y', 'r|x', 'r|y', 'x|0', 'y|0', 'r|0', 'J|', 'C|w',
  'E|', 'G|', 'γ|', 'f|y', 'f|u',
  'N|Sd', 'M|x,Sd', 'M|y,Sd', 'V|x,Sd', 'V|y,Sd', 'K|x', 'L|x', 'K|y', 'L|y', 'K|z', 'L|z', 'C|b',
  'N|', 'M|', 'Sd/Rd',
];

function colher(e: Expr | undefined, em: Set<string>): void {
  if (!e) return;
  switch (e.t) {
    case 'v':
      em.add(`${e.nome}|${e.ind ?? ''}`);
      return;
    case 'fr':
      colher(e.num, em);
      colher(e.den, em);
      return;
    case 'rz':
    case 'par':
      colher(e.x, em);
      return;
    case 'pot':
      colher(e.base, em);
      colher(e.exp, em);
      return;
    case 'seq':
      for (const p of e.partes) colher(p, em);
      return;
  }
}

/** Os símbolos que a memória deste resultado escreve, como "nome|índice". */
export function simbolosDaMemoria(r: ResultadoDaVerificacao): Set<string> {
  const usados = new Set(SEMPRE);
  if (r.entrada.perfil.D > 0) usados.add('D|');
  if (r.entrada.comprimentos.a > 0) usados.add('a|');
  for (const vf of r.lista)
    for (const p of vf.passos)
      for (const c of p.contas) {
        colher(c.simbolo, usados);
        colher(c.formula, usados);
        colher(c.numeros, usados);
      }
  return usados;
}

/** O que a memória escreve e o glossário não explica (o selo cobra vazio). */
export function semVerbete(r: ResultadoDaVerificacao): string[] {
  return [...simbolosDaMemoria(r)].filter((k) => !VERBETES.has(k));
}

export function capituloGlossario(r: ResultadoDaVerificacao, n: number): string {
  const usados = simbolosDaMemoria(r);
  const grupos = GRUPOS.map((g) => ({ titulo: g.titulo, verbetes: g.verbetes.filter((vb) => usados.has(vb.chave)) })).filter((g) => g.verbetes.length);
  const corpo =
    nota('Unidades das contas: kN, cm e kN/cm². As dimensões do perfil estão em mm, como a NBR 6355 as escreve, e em cm nas contas.') +
    grupos
      .map((g, i) =>
        passo({
          n: `${n}.${i + 1}`,
          titulo: g.titulo,
          corpo:
            `<table class="glossario"><tbody>` +
            g.verbetes.map((vb) => `<tr><td>${vb.simbolo}</td><td>${vb.texto}</td><td>${vb.unidade ?? ''}</td></tr>`).join('') +
            `</tbody></table>`,
        }),
      )
      .join('');
  // Página nova, como anexo: depois da assinatura, o título não fica sozinho
  // no pé da página das conclusões.
  return secao(n, 'Glossário', corpo, 'anexo');
}
