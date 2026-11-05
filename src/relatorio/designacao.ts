// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/designacao.ts — o nome do perfil, como a tela e o papel escrevem
// ---------------------------------------------------------------------------
//  "Ue 150 x 60 x 20 x 2,00": família, dimensões externas em mm e a
//  espessura com duas casas, como a NBR 6355 designa. A cartola também é
//  bw × bf × D, com bw a altura das paredes (resposta do José, 01/11/2026).
// ═══════════════════════════════════════════════════════════════════════════

import type { DimensoesDoPerfil } from '../motor/secao/tipos';
import { num, numExato } from './formatos';

export function designacao(p: DimensoesDoPerfil): string {
  if (p.familia === 'Desenho') return `Seção desenhada, t = ${num(p.t, 2)}`;
  if (p.familia === 'Ue2') return `2 Ue ${[p.bw, p.bf, p.D].map((v) => numExato(v, 2)).join(' x ')} x ${num(p.t, 2)} boca com boca`;
  const dims = [p.bw, p.bf];
  const partes = [...dims, ...(p.D > 0 ? [p.D] : [])].map((v) => numExato(v, 2));
  const ang = p.familia === 'Ze' && p.anguloEnrijecedor === 45 ? ' 45°' : '';
  return `${p.familia}${ang} ${partes.join(' x ')} x ${num(p.t, 2)}`;
}
