// ═══════════════════════════════════════════════════════════════════════════
//  motor/quadratura.ts — Gauss-Legendre em [0, 1]
// ---------------------------------------------------------------------------
//  Os pontos saem da iteração de Newton nas raízes do polinômio de Legendre,
//  não de tabela digitada: tabela digitada é onde mora o erro de transcrição,
//  e assim serve para qualquer número de pontos. Com n pontos a regra é exata
//  para polinômio de grau até 2n − 1.
// ═══════════════════════════════════════════════════════════════════════════

export interface Quadratura {
  xi: number[];
  w: number[];
}

export function gauss(n: number): Quadratura {
  const xi: number[] = [];
  const w: number[] = [];
  for (let i = 1; i <= n; i++) {
    let z = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
    let dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1;
      let p1 = z;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-16) break;
    }
    xi.push((1 - z) / 2);
    w.push(1 / ((1 - z * z) * dp * dp));
  }
  return { xi, w };
}
