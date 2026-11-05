// ═══════════════════════════════════════════════════════════════════════════
//  motor/faixas/modos.ts — a forma do modo diz se ele é local, distorcional ou
//  global
// ---------------------------------------------------------------------------
//  As definições mecânicas são as do cFSM (Ádány e Schafer, 2006), lidas na
//  forma do modo em vez de impostas como restrição:
//   · LOCAL — as dobras (linhas de canto) não saem do lugar no plano da
//     seção; só as chapas ondulam entre elas;
//   · GLOBAL — a seção anda inteira no plano, como corpo rígido (translação
//     e giro), sem se deformar;
//   · DISTORCIONAL — as dobras andam e a seção se deforma (a mesa com o
//     enrijecedor gira em torno da dobra mesa–alma).
//
//  Duas medidas, as duas entre 0 e 1:
//   · `dobras` = deslocamento no plano das dobras ÷ maior deslocamento de
//     qualquer nó. Perto de zero: local.
//   · `deformacao` = o que sobra do deslocamento das dobras depois de tirar
//     o melhor movimento de corpo rígido, ÷ o deslocamento das dobras. Perto
//     de zero: global.
//
//  ⚠️ AS PONTAS LIVRES NÃO SÃO DOBRA. No U simples, a mesa que gira em torno
//  da alma é flambagem local (a norma dispensa o distorcional do U simples,
//  9.3); se a ponta livre contasse como dobra, esse modo sairia distorcional.
//
//  O juiz desta classificação é o cFSM do pyCUFSM, rodado em lote nos perfis
//  da NBR 6355 (oraculos/scripts/loteCfsm.py); os limites saem de lá.
// ═══════════════════════════════════════════════════════════════════════════

import type { Malha } from './malha';
import type { Modo } from './motor';

/** Nós de dobra: onde duas faixas vizinhas mudam de direção (cantos vivos e arcos). */
export function nosDeDobra(m: Malha): number[] {
  const vizinhas = new Map<number, number[]>();
  m.faixas.forEach(({ i, j }, k) => {
    for (const no of [i, j]) vizinhas.set(no, [...(vizinhas.get(no) ?? []), k]);
  });
  const dir = (k: number) => {
    const { i, j } = m.faixas[k];
    const a = m.nos[i];
    const b = m.nos[j];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    return { c: (b.x - a.x) / L, s: (b.y - a.y) / L };
  };
  const dobras: number[] = [];
  for (const [no, ks] of vizinhas) {
    if (ks.length < 2) continue; // ponta livre
    if (ks.length > 2) {
      dobras.push(no); // ramificação
      continue;
    }
    const p = dir(ks[0]);
    const q = dir(ks[1]);
    if (Math.abs(p.c * q.s - p.s * q.c) > 1e-6) dobras.push(no);
  }
  return dobras.sort((a, b) => a - b);
}

export interface MedidasDoModo {
  dobras: number;
  deformacao: number;
}

/** As duas medidas do modo (ver o cabeçalho). Deslocamentos [U V W Θ] por nó. */
export function medirModo(m: Malha, modo: Modo): MedidasDoModo {
  const d = modo.deslocamentos;
  const plano = (no: number) => ({ u: d[4 * no], w: d[4 * no + 2] });
  let maior = 0;
  m.nos.forEach((_, no) => {
    const { u, w } = plano(no);
    maior = Math.max(maior, Math.hypot(u, w));
  });
  const dobras = nosDeDobra(m);
  if (!dobras.length || maior === 0) return { dobras: 0, deformacao: 0 };

  let nasDobras = 0;
  for (const no of dobras) {
    const { u, w } = plano(no);
    nasDobras = Math.max(nasDobras, Math.hypot(u, w));
  }

  // Corpo rígido no plano: u = a − θ·(y − yc), w = b + θ·(x − xc), mínimos
  // quadrados nas dobras. Com o centro na média dos pontos, as três incógnitas
  // se separam.
  const xs = dobras.map((no) => m.nos[no].x);
  const ys = dobras.map((no) => m.nos[no].y);
  const xc = xs.reduce((s, v) => s + v, 0) / xs.length;
  const yc = ys.reduce((s, v) => s + v, 0) / ys.length;
  let su = 0, sw = 0, num = 0, den = 0;
  dobras.forEach((no, k) => {
    const { u, w } = plano(no);
    su += u;
    sw += w;
    const dx = xs[k] - xc;
    const dy = ys[k] - yc;
    num += -u * dy + w * dx;
    den += dx * dx + dy * dy;
  });
  const a = su / dobras.length;
  const b = sw / dobras.length;
  const th = den > 0 ? num / den : 0;
  let resto = 0;
  dobras.forEach((no, k) => {
    const { u, w } = plano(no);
    const ur = u - (a - th * (ys[k] - yc));
    const wr = w - (b + th * (xs[k] - xc));
    resto = Math.max(resto, Math.hypot(ur, wr));
  });
  return { dobras: nasDobras / maior, deformacao: nasDobras > 0 ? resto / nasDobras : 0 };
}
