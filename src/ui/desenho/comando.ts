// ═══════════════════════════════════════════════════════════════════════════
//  ui/desenho/comando.ts — a linha de comando do editor, como a do CAD
// ---------------------------------------------------------------------------
//  O que se digita:
//    x,y   ou  x;y        ponto absoluto
//    @dx,dy ou @dx;dy     relativo ao último ponto
//    @L<a                 polar relativo (a em graus, anti-horário a partir de +x)
//    L<a                  polar a partir da origem (como o AutoCAD)
//    #n                   o nó n (começa dele ou liga a ele)
//    F / fechar           liga a ponta ao primeiro nó da polilinha
//    D / desfazer         desfaz o último passo
//    (vazio)              termina a polilinha
//
//  ⚠️ A REGRA DA VÍRGULA (o Brasil escreve 12,5; o AutoCAD separa x,y com
//  vírgula). Uma regra só, sem adivinhar:
//    - COM ponto e vírgula, ele separa x de y, e a vírgula volta a ser
//      decimal: "12,5;30" = (12,5; 30). O ponto decimal também vale ali.
//    - SEM ponto e vírgula, a vírgula separa x de y, e o decimal é o ponto,
//      como no AutoCAD: "12.5,30" = (12,5; 30) e "12,5" = (12; 5).
//    - Duas vírgulas sem ponto e vírgula ("12,5,30") é ambíguo: recusa.
//    - No polar não há separador de coordenadas: "@12,5<30" = 12,5 a 30°.
//  Separador de milhar não existe aqui: "1.000" é um.
//  O editor ecoa o ponto lido na barra de estado, com ";" — quem digitou
//  "12,5" querendo 12,5 vê "(12; 5)" na hora.
// ═══════════════════════════════════════════════════════════════════════════

import type { NoDesenhado } from '../../motor/secao/tipos';

export type Comando =
  | { tipo: 'fim' }
  | { tipo: 'ponto'; p: NoDesenhado }
  /** Nó existente, índice a partir de zero. */
  | { tipo: 'no'; k: number }
  | { tipo: 'fechar' }
  | { tipo: 'desfazer' }
  | { tipo: 'erro'; mensagem: string };

const NUMERO = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/;

/** Um número da linha de comando: vírgula ou ponto decimal, sem milhar. */
export function lerCoordenada(s: string): number | null {
  const limpo = s.trim().replace(/−/g, '-');
  if (!NUMERO.test(limpo)) return null;
  const n = Number(limpo.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Tira o ruído da conta em ponto flutuante (cos 90° = 6·10⁻¹⁷; 0,1 + 0,2):
 * arredonda ao milionésimo de milímetro. Sem isto, "@100<90" deixaria um nó
 * em x = 6·10⁻¹⁵, que a tabela mostra como lixo e o encaixe não reconhece.
 */
export function limpar(v: number): number {
  const r = Math.round(v * 1e6) / 1e6;
  return r === 0 ? 0 : r; // sem −0
}

const FECHAR = new Set(['f', 'fechar', 'c']);
const DESFAZER = new Set(['d', 'desfazer', 'u']);

/**
 * Lê o que foi digitado. `ultimo` é o ponto de onde sai o relativo (a ponta
 * da polilinha, ou o último ponto usado; sem nenhum, a origem — como o
 * LASTPOINT do AutoCAD). `nNos` confere o "#n".
 */
export function interpretar(texto: string, ultimo: NoDesenhado | null, nNos: number): Comando {
  const s = texto.replace(/\s+/g, '').replace(/−/g, '-');
  if (s === '') return { tipo: 'fim' };
  const minusculo = s.toLowerCase();
  if (FECHAR.has(minusculo)) return { tipo: 'fechar' };
  if (DESFAZER.has(minusculo)) return { tipo: 'desfazer' };

  if (s.startsWith('#')) {
    const m = /^#(\d+)$/.exec(s);
    if (!m) return { tipo: 'erro', mensagem: 'nó inválido' };
    const n = Number(m[1]);
    if (n < 1 || n > nNos) return { tipo: 'erro', mensagem: `nó ${n} não existe` };
    return { tipo: 'no', k: n - 1 };
  }

  const relativo = s.startsWith('@');
  const corpo = relativo ? s.slice(1) : s;
  const base = relativo ? (ultimo ?? { x: 0, y: 0 }) : { x: 0, y: 0 };

  if (corpo.includes('<')) {
    const partes = corpo.split('<');
    if (partes.length !== 2) return { tipo: 'erro', mensagem: 'polar inválido' };
    const L = lerCoordenada(partes[0]);
    const a = lerCoordenada(partes[1]);
    if (L === null || a === null) return { tipo: 'erro', mensagem: 'polar inválido' };
    const rad = (a * Math.PI) / 180;
    return { tipo: 'ponto', p: { x: limpar(base.x + L * Math.cos(rad)), y: limpar(base.y + L * Math.sin(rad)) } };
  }

  let partes: string[];
  if (corpo.includes(';')) partes = corpo.split(';');
  else {
    const virgulas = corpo.split(',').length - 1;
    if (virgulas > 1) return { tipo: 'erro', mensagem: 'ambíguo: use ; entre x e y' };
    if (virgulas === 0) return { tipo: 'erro', mensagem: 'falta y' };
    partes = corpo.split(',');
  }
  if (partes.length !== 2) return { tipo: 'erro', mensagem: 'coordenada inválida' };
  const x = lerCoordenada(partes[0]);
  const y = lerCoordenada(partes[1]);
  if (x === null || y === null) return { tipo: 'erro', mensagem: 'coordenada inválida' };
  return { tipo: 'ponto', p: { x: limpar(base.x + x), y: limpar(base.y + y) } };
}
