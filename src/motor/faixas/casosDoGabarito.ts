// Os casos do gabarito do motor de faixas finitas: a seção, a malha, as cargas
// de referência, os comprimentos e a varredura da assinatura. O selo
// `motor.test.ts` e o script do protótipo (oraculos/scripts/gabaritoFaixas.py)
// trabalham sobre ESTA lista — mudou um caso, regravar o gabarito.
import type { DimensoesDoPerfil } from '../secao/tipos';
import { logspace } from './assinatura';
import type { EsforcoDeReferencia, OpcoesDaMalha } from './malha';

export interface Caso {
  nome: string;
  dim: DimensoesDoPerfil;
  cantoVivo?: boolean;
  malha?: OpcoesDaMalha;
  cargas: Record<string, EsforcoDeReferencia>;
  L: number[];
  assinatura: { Lmin: number; Lmax: number; n: number };
}

const P = { P: 1 };
const MX = { Mx: 1 };
const MY = { My: 1 };

export const CASOS: Caso[] = [
  {
    nome: 'Ue print do FStr (canto vivo, 2-3-6 faixas)',
    dim: { familia: 'Ue', bw: 202.25, bf: 77.25, D: 21.125, t: 2.25, ri: 0 },
    cantoVivo: true,
    malha: { porPapel: { enrijecedor: 2, mesa: 3, alma: 6 } },
    cargas: { P, Mx: MX },
    L: logspace(1, 1e4, 100),
    assinatura: { Lmin: 10, Lmax: 1e4, n: 100 },
  },
  {
    nome: 'Ue 150x60x20x2,00 ri 2',
    dim: { familia: 'Ue', bw: 150, bf: 60, D: 20, t: 2, ri: 2 },
    cargas: { P, Mx: MX, My: MY },
    L: logspace(1, 3000, 40),
    assinatura: { Lmin: 1, Lmax: 3000, n: 80 },
  },
  {
    nome: 'U 100x50x2,00 ri 2',
    dim: { familia: 'U', bw: 100, bf: 50, D: 0, t: 2, ri: 2 },
    cargas: { P, Mx: MX, My: MY },
    L: logspace(1, 2000, 40),
    assinatura: { Lmin: 1, Lmax: 2000, n: 80 },
  },
  {
    nome: 'Z 200x75x2,65 ri 2,65',
    dim: { familia: 'Z', bw: 200, bf: 75, D: 0, t: 2.65, ri: 2.65 },
    cargas: { P, Mx: MX, My: MY },
    L: logspace(1, 3000, 40),
    assinatura: { Lmin: 1, Lmax: 3000, n: 80 },
  },
  {
    nome: 'Ze 200x75x25x2,25 ri 2,25',
    dim: { familia: 'Ze', bw: 200, bf: 75, D: 25, t: 2.25, ri: 2.25 },
    cargas: { P, Mx: MX },
    L: logspace(1, 3000, 40),
    assinatura: { Lmin: 1, Lmax: 3000, n: 80 },
  },
  {
    nome: 'Ze 45° 200x75x20x2,25 ri 2,25',
    dim: { familia: 'Ze', bw: 200, bf: 75, D: 20, t: 2.25, ri: 2.25, anguloEnrijecedor: 45 },
    cargas: { P, Mx: MX },
    L: logspace(1, 3000, 40),
    assinatura: { Lmin: 1, Lmax: 3000, n: 80 },
  },
  {
    nome: 'Cartola 100x50x20x2,00 ri 2',
    dim: { familia: 'Cr', bw: 50, bf: 100, D: 20, t: 2, ri: 2 },
    cargas: { P, Mx: MX, My: MY },
    L: logspace(1, 2000, 40),
    assinatura: { Lmin: 1, Lmax: 2000, n: 80 },
  },
  {
    nome: 'Cantoneira 60x40x3,00 ri 3',
    dim: { familia: 'L', bw: 60, bf: 40, D: 0, t: 3, ri: 3 },
    cargas: { P, Mx: MX },
    L: logspace(1, 1000, 40),
    assinatura: { Lmin: 1, Lmax: 1000, n: 80 },
  },
  {
    nome: 'Cantoneira enrijecida 60x60x15x2,00 ri 2',
    dim: { familia: 'Le', bw: 60, bf: 60, D: 15, t: 2, ri: 2 },
    cargas: { P },
    L: logspace(1, 1000, 40),
    assinatura: { Lmin: 1, Lmax: 1000, n: 80 },
  },
];
