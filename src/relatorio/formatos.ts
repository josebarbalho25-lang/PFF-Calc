// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/formatos.ts — como o número e o texto se escrevem, na tela e no papel
// ---------------------------------------------------------------------------
//  As regras do relatório do A-PORT (`relatorio/formatos.ts` de lá), sem mudar
//  o resultado: vírgula decimal, espaço fino inseparável no milhar a partir de
//  10 000 (o padrão SI — 4 dígitos ficam juntos: 5483,3), o sinal de menos
//  tipográfico. A tela usa as mesmas, para o número da barra e o da memória
//  serem o mesmo número.
//
//  ⚠️ TODO TEXTO LIVRE PASSA POR `esc` — o nome da obra, do elemento. A
//  memória é HTML: um "<" no nome quebraria a página, ou viraria marcação.
// ═══════════════════════════════════════════════════════════════════════════

const MILHAR = ' ';

/** Número no padrão brasileiro; "—" sem número, "∞" no infinito. */
export function num(v: number | null | undefined, casas = 2, sinal = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  // Acima de 10¹⁵ o toFixed vira notação científica e o milhar sai torto:
  // escreve em potência de dez, que é como se lê número desse tamanho.
  if (Math.abs(v) >= 1e15) {
    const [m, e] = Math.abs(v).toExponential(casas).split('e') as [string, string];
    return `${v < 0 ? '−' : ''}${m.replace('.', ',')}·10^${Number(e)}`;
  }
  const s = Math.abs(v).toFixed(casas);
  const [inteiro, frac] = s.split('.') as [string, string | undefined];
  let parte = inteiro;
  if (inteiro.length > 4) parte = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, MILHAR);
  const texto = parte + (frac ? `,${frac}` : '');
  const zero = Number(s) === 0;
  if (v < 0 && !zero) return `−${texto}`;
  if (sinal && v > 0 && !zero) return `+${texto}`;
  return texto;
}

/** Número com as casas que ele TEM, até `casas`: 34,5 e não 34,500. */
export function numExato(v: number | null | undefined, casas = 4): string {
  const s = num(v, casas);
  return s.includes(',') ? s.replace(/0+$/, '').replace(/,$/, '') : s;
}

/**
 * Quantas casas um resultado merece pelo tamanho: 1 555,6 · 295,82 · 0,382.
 * É o que a memória usa quando a conta não pede casas fixas.
 */
export function casasPeloTamanho(v: number): number {
  const a = Math.abs(v);
  if (!Number.isFinite(a) || a === 0) return 0;
  if (a >= 1000) return 1;
  if (a >= 10) return 2;
  if (a >= 1) return 3;
  return 4;
}

/** Número com as casas pelo tamanho, sem zero sobrando à direita (dado de entrada). */
export function numAuto(v: number): string {
  return numExato(v, casasPeloTamanho(v));
}

/**
 * Lê o número como o engenheiro digita: vírgula ou ponto decimal, espaço de
 * milhar ignorado. Devolve null se não for número — e TAMBÉM se for ambíguo.
 *
 * ⚠️ NA DÚVIDA ENTRE MIL E UM, RECUSA. "12.500" é doze mil e quinhentos no
 * papel brasileiro e doze e meio no teclado de quem usa ponto decimal; ler um
 * no lugar do outro é esforço mil vezes errado, calado. Então:
 *  · "1.234,5" — ponto de milhar em grupos de 3 E vírgula decimal: aceita;
 *  · "12.500", "1.250" — só ponto, em grupos de 3 exatos: recusa (o campo
 *    acende vermelho e volta ao valor de antes);
 *  · "1,234.5", "1.2,3", "1,2,3" — separadores trocados ou repetidos: recusa;
 *  · "12,5", "12.5", "1e3": aceita.
 */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(/−/g, '-');
  if (!limpo) return null;
  let normal: string;
  if (limpo.includes(',')) {
    if (/^[-+]?\d{1,3}(\.\d{3})+,\d*$/.test(limpo)) normal = limpo.replace(/\./g, '').replace(',', '.');
    else if (/^[^.,]*,[^.,]*$/.test(limpo)) normal = limpo.replace(',', '.');
    else return null;
  } else {
    if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(limpo)) return null;
    normal = limpo;
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(normal)) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

export function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A data de hoje como se escreve no carimbo: 01/11/2026. */
export function dataDeHoje(hoje = new Date()): string {
  const dd = String(hoje.getDate()).padStart(2, '0');
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${hoje.getFullYear()}`;
}
