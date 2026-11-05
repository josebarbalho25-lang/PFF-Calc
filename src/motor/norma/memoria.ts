// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/memoria.ts — a memória de cálculo como DADO, não como página
// ---------------------------------------------------------------------------
//  Cada verificação devolve, junto com o número, os passos que levaram a ele:
//  a fórmula literal, a mesma fórmula com os números no lugar das letras, e o
//  resultado. Quem desenha (a memória A4, a tela, o A-PORT um dia) recebe isso
//  e escreve do jeito dele.
//
//  ⚠️ A CONTA E O TEXTO SAEM DO MESMO LUGAR. Se a memória fosse montada à
//  parte, refazendo a conta para escrever, uma correção no motor deixaria a
//  memória mostrando a conta velha com o resultado novo — e o papel assinado
//  não fecharia na calculadora de quem confere. Aqui o número da substituição
//  é a mesma variável que entrou na conta, na mesma linha.
// ═══════════════════════════════════════════════════════════════════════════

/** Um pedaço de fórmula. */
export type Expr =
  | { t: 'v'; nome: string; ind?: string }
  | { t: 'n'; v: number; casas?: number }
  | { t: 'txt'; s: string }
  | { t: 'fr'; num: Expr; den: Expr }
  | { t: 'rz'; x: Expr }
  | { t: 'pot'; base: Expr; exp: Expr }
  | { t: 'par'; x: Expr }
  | { t: 'seq'; partes: Expr[] };

type Peca = Expr | string | number;

/** Texto vira operador; número vira número. */
function peca(p: Peca): Expr {
  if (typeof p === 'string') return { t: 'txt', s: p };
  if (typeof p === 'number') return { t: 'n', v: p };
  return p;
}

/** Variável em itálico, com índice: v('A', 'g') → Ag. */
export const v = (nome: string, ind?: string): Expr => (ind ? { t: 'v', nome, ind } : { t: 'v', nome });
/** Número, com casas fixas quando importa (γa1 = 1,10). */
export const n = (valor: number, casas?: number): Expr => (casas === undefined ? { t: 'n', v: valor } : { t: 'n', v: valor, casas });
/** Sequência: x(v('A','g'), '·', v('f','y')). */
export const x = (...partes: Peca[]): Expr => ({ t: 'seq', partes: partes.map(peca) });
export const fr = (num: Peca, den: Peca): Expr => ({ t: 'fr', num: peca(num), den: peca(den) });
export const rz = (r: Peca): Expr => ({ t: 'rz', x: peca(r) });
export const pot = (base: Peca, exp: Peca): Expr => ({ t: 'pot', base: peca(base), exp: peca(exp) });
export const par = (r: Peca): Expr => ({ t: 'par', x: peca(r) });

/**
 * Uma linha da memória: `símbolo = fórmula = números = resultado unidade`.
 * Linha sem fórmula é dado (fy = 34,5 kN/cm²); com `texto`, é a decisão
 * escrita no lugar do número ("seção compacta").
 */
export interface Conta {
  simbolo: Expr;
  formula?: Expr;
  numeros?: Expr;
  valor?: number;
  /** Casas do resultado; sem isto, o desenho escolhe pelo tamanho. */
  casas?: number;
  unidade?: string;
  /** Comparação que decide o ramo: "λ ≤ λp". Vai à direita, apagada. */
  rotulo?: string;
  texto?: string;
}

/** Um passo da memória: o item da norma à esquerda, as contas à direita. */
export interface Passo {
  /** O item da NBR 14762:2010 — "9.7.2", "Tabela 5", "C.3.3". */
  ref: string;
  titulo: string;
  contas: Conta[];
  /** Uma frase curta, só quando a conta sozinha não diz o que foi decidido. */
  nota?: string;
}

/** Como a verificação terminou — as mesmas três palavras do relatório do A-PORT. */
export type Situacao = 'atende' | 'avaliar' | 'naoAtende';

export type ChaveDaVerificacao =
  | 'larguraEspessura'
  | 'tracao'
  | 'compressao'
  | 'flexaoX'
  | 'flexaoY'
  | 'cortanteY'
  | 'cortanteX'
  | 'momentoCortante'
  | 'combinada'
  | 'barraComposta';

/** O resumo que a tela e a capa da memória leem, igual para toda verificação. */
export interface Verificacao {
  chave: ChaveDaVerificacao;
  titulo: string;
  /** O item da norma que a governa. */
  item: string;
  /** Solicitante e resistente de cálculo (na combinada, a razão já é a soma). */
  sd: number;
  rd: number;
  unidade: string;
  /** Sd/Rd — o índice de utilização. */
  razao: number;
  situacao: Situacao;
  /** O estado-limite que comanda, quando há mais de um (FLT, distorcional…). */
  governa?: string;
  passos: Passo[];
  /** Ressalvas que não reprovam mas pedem o olho do engenheiro: acendem "avaliar". */
  avisos: string[];
  /**
   * O que a conta decidiu e o engenheiro precisa saber, sem ser alerta (o MLE
   * que caiu para o MRD, o Cs do Anexo E, o que esta versão não verifica).
   * Aparece no card e na memória; NÃO acende "avaliar".
   */
  notas?: string[];
  /**
   * A norma não traz a conta deste caso (cortante sem alma paralela): razão
   * sem número, situação "avaliar", fora do índice máximo.
   */
  naoVerificada?: boolean;
}

/** Situação pela razão, com espaço para o "avaliar" quando há ressalva. */
export function situacaoPelaRazao(razao: number, avisos: readonly string[] = []): Situacao {
  if (!(razao <= 1)) return 'naoAtende';
  return avisos.length ? 'avaliar' : 'atende';
}
