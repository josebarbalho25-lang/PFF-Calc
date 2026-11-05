// ═══════════════════════════════════════════════════════════════════════════
//  motor/faixas/assinatura.ts — a curva de assinatura e os seus mínimos
// ---------------------------------------------------------------------------
//  Especificação, "Curva de assinatura e registro": 100 comprimentos em escala
//  logarítmica; mínimo = ponto mais baixo que os dois vizinhos, refinado por
//  seção áurea em log L chamando o próprio solver.
//
//  ⚠️ MÍNIMO NA BORDA: se a curva já começa subindo, o vale do local está
//  antes do primeiro ponto (foi o que apareceu no print do FStr, com o local
//  em L = 10). O intervalo desce uma década e roda de novo, até 2 vezes; se
//  persistir, fica o aviso.
//
//  Quem decide qual mínimo é local e qual é distorcional NÃO é esta função:
//  ela só acha os vales. A classificação vem depois (etapa 3, `modos`).
// ═══════════════════════════════════════════════════════════════════════════

import type { Malha } from './malha';
import { MotorDeFaixas } from './motor';

export interface Minimo {
  L: number;
  lam: number;
}

export interface Assinatura {
  L: number[];
  lamPos: number[];
  lamNeg: number[];
  minimosPos: Minimo[];
  minimosNeg: Minimo[];
  avisos: string[];
}

/** Comprimentos dos trechos planos: faixas colineares em sequência somadas. */
export function trechosPlanos(m: Malha): number[] {
  const pai = m.faixas.map((_, k) => k);
  const raiz = (a: number): number => {
    while (pai[a] !== a) {
      pai[a] = pai[pai[a]];
      a = pai[a];
    }
    return a;
  };
  const dir = m.faixas.map(({ i, j }) => {
    const a = m.nos[i];
    const b = m.nos[j];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    return { L, c: (b.x - a.x) / L, s: (b.y - a.y) / L };
  });
  const porNo = new Map<number, number[]>();
  m.faixas.forEach(({ i, j }, k) => {
    for (const no of [i, j]) porNo.set(no, [...(porNo.get(no) ?? []), k]);
  });
  for (const ks of porNo.values()) {
    if (ks.length !== 2) continue;
    const [p, q] = ks.map((k) => dir[k]);
    if (Math.abs(p.c * q.s - p.s * q.c) < 1e-9) pai[raiz(ks[0])] = raiz(ks[1]);
  }
  const soma = new Map<number, number>();
  dir.forEach((d, k) => soma.set(raiz(k), (soma.get(raiz(k)) ?? 0) + d.L));
  return [...soma.values()].sort((a, b) => a - b);
}

/** Mínimo de f em [a, b] por seção áurea em log L. */
function secaoAurea(f: (L: number) => number, a: number, b: number, tol = 1e-4, itmax = 60): Minimo {
  let la = Math.log(a);
  let lb = Math.log(b);
  const g = (Math.sqrt(5) - 1) / 2;
  let c = lb - g * (lb - la);
  let d = la + g * (lb - la);
  let fc = f(Math.exp(c));
  let fd = f(Math.exp(d));
  for (let it = 0; it < itmax; it++) {
    if (Math.abs(lb - la) < tol) break;
    if (fc < fd) {
      lb = d;
      d = c;
      fd = fc;
      c = lb - g * (lb - la);
      fc = f(Math.exp(c));
    } else {
      la = c;
      c = d;
      fc = fd;
      d = la + g * (lb - la);
      fd = f(Math.exp(d));
    }
  }
  const x = Math.exp((la + lb) / 2);
  return { L: x, lam: f(x) };
}

function minimos(motor: MotorDeFaixas, L: number[], lam: number[], sentido: 1 | -1): Minimo[] {
  const achados: Minimo[] = [];
  for (let i = 1; i < L.length - 1; i++) {
    if (Number.isFinite(lam[i]) && lam[i] < lam[i - 1] && lam[i] <= lam[i + 1]) {
      achados.push(secaoAurea((a) => motor.critico(a, sentido), L[i - 1], L[i + 1]));
    }
  }
  return achados;
}

export interface OpcoesDaAssinatura {
  Lmin?: number;
  Lmax?: number;
  n?: number;
  /** Quantas décadas o início pode descer se o mínimo estiver na borda. */
  estender?: number;
}

export function logspace(a: number, b: number, n: number): number[] {
  const la = Math.log10(a);
  const lb = Math.log10(b);
  return Array.from({ length: n }, (_, k) => 10 ** (la + ((lb - la) * k) / (n - 1)));
}

export function curvaDeAssinatura(malha: Malha, tensoes: Float64Array, op: OpcoesDaAssinatura = {}): Assinatura {
  const motor = new MotorDeFaixas(malha, tensoes);
  let Lmin = op.Lmin ?? 0.5 * trechosPlanos(malha)[0];
  let Lmax = op.Lmax;
  if (Lmax === undefined) {
    const xs = malha.nos.map((p) => p.x);
    const ys = malha.nos.map((p) => p.y);
    Lmax = 100 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  }
  const n = op.n ?? 100;
  const estender = op.estender ?? 2;
  const avisos: string[] = [];
  let L: number[] = [];
  let r = { lamPos: [] as number[], lamNeg: [] as number[] };
  for (let tentativa = 0; tentativa <= estender; tentativa++) {
    L = logspace(Lmin, Lmax, n);
    r = motor.resolver(L);
    const comecaSubindo = [r.lamPos, r.lamNeg].some((lam) => Number.isFinite(lam[0]) && Number.isFinite(lam[1]) && lam[0] < lam[1]);
    if (comecaSubindo && tentativa < estender) {
      Lmin /= 10;
      continue;
    }
    if (comecaSubindo) avisos.push('mínimo na borda inferior da varredura');
    break;
  }
  const minimosPos = minimos(motor, L, r.lamPos, 1);
  const minimosNeg = minimos(motor, L, r.lamNeg, -1);
  if (!minimosPos.length) avisos.push('sem mínimo nítido no sentido aplicado');
  return { L, lamPos: r.lamPos, lamNeg: r.lamNeg, minimosPos, minimosNeg, avisos };
}
