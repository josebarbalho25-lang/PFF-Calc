// ═══════════════════════════════════════════════════════════════════════════
//  motor/secao/grafo.ts — a seção DESENHADA: nós e trechos de chapa
// ---------------------------------------------------------------------------
//  O projetista desenha a seção que quiser, como no painel gráfico do
//  DimPerfil (pedido dele, 01/11/2026). Daqui sai a mesma SecaoGeometrica das
//  famílias: linha média com o canto arredondado (rm = ri + t/2) e os
//  elementos planos.
//
//  O grau de cada nó decide o que ele é:
//  - grau 1: borda livre;
//  - grau 2: dobra — vira arco, como nas famílias (se os dois trechos tiverem
//    a mesma espessura e não forem alinhados);
//  - grau 3 ou mais: junção (ramo em T, encontro de chapas) — canto vivo.
//
//  ⚠️ O DESENHO QUE É UMA CADEIA SIMPLES (sem ramo, sem célula, espessura
//  única) SEGUE O MESMO CAMINHO DAS FAMÍLIAS — a mesma poligonal, o mesmo
//  `arredondar`. Um Ue desenhado dá o Ue da família até a última casa: é o
//  selo de que o caminho genérico não mudou nada do que já foi conferido.
//  Ramo ou célula fechada vão com o grafo (`SecaoGeometrica.grafo`).
// ═══════════════════════════════════════════════════════════════════════════

import { arredondar, GeometriaInvalida, MM, type Poligonal } from './familias';
import type { Borda, DimensoesDoPerfil, ElementoPlano, GrafoDaSecao, PapelDoElemento, Ponto, SecaoDesenhada, SecaoGeometrica, Trecho, TrechoReto } from './tipos';

const sub = (a: Ponto, b: Ponto): Ponto => ({ x: a.x - b.x, y: a.y - b.y });
const soma = (a: Ponto, b: Ponto, k = 1): Ponto => ({ x: a.x + k * b.x, y: a.y + k * b.y });
const norma = (a: Ponto) => Math.hypot(a.x, a.y);
const unit = (a: Ponto): Ponto => {
  const n = norma(a);
  return { x: a.x / n, y: a.y / n };
};

/** Confere o desenho e devolve os graus dos nós. */
function validar(d: SecaoDesenhada, t: number): number[] {
  const n = d.nos.length;
  if (n < 2 || !d.trechos.length) throw new GeometriaInvalida('desenho sem trecho de chapa');
  for (const [k, no] of d.nos.entries()) {
    if (!Number.isFinite(no.x) || !Number.isFinite(no.y)) throw new GeometriaInvalida(`nó ${k + 1}: coordenada inválida`);
  }
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      if (Math.hypot(d.nos[a].x - d.nos[b].x, d.nos[a].y - d.nos[b].y) < 1e-6) throw new GeometriaInvalida(`nós ${a + 1} e ${b + 1} no mesmo lugar`);
  const grau = new Array<number>(n).fill(0);
  const pares = new Set<string>();
  for (const [k, tr] of d.trechos.entries()) {
    if (!(tr.i >= 0 && tr.i < n && tr.j >= 0 && tr.j < n) || tr.i === tr.j) throw new GeometriaInvalida(`trecho ${k + 1}: nós inválidos`);
    const chave = `${Math.min(tr.i, tr.j)}-${Math.max(tr.i, tr.j)}`;
    if (pares.has(chave)) throw new GeometriaInvalida(`trecho ${k + 1}: repetido`);
    pares.add(chave);
    const te = tr.t ?? t;
    if (!(te > 0)) throw new GeometriaInvalida(`trecho ${k + 1}: espessura tem de ser maior que zero`);
    grau[tr.i]++;
    grau[tr.j]++;
  }
  const solto = grau.findIndex((g) => g === 0);
  if (solto >= 0) throw new GeometriaInvalida(`nó ${solto + 1} sem trecho`);
  // ligado: todos os nós alcançáveis a partir do primeiro
  const visto = new Array<boolean>(n).fill(false);
  const pilha = [0];
  visto[0] = true;
  while (pilha.length) {
    const a = pilha.pop()!;
    for (const tr of d.trechos) {
      const b = tr.i === a ? tr.j : tr.j === a ? tr.i : -1;
      if (b >= 0 && !visto[b]) {
        visto[b] = true;
        pilha.push(b);
      }
    }
  }
  const fora = visto.findIndex((v) => !v);
  if (fora >= 0) throw new GeometriaInvalida(`nó ${fora + 1} não está ligado ao resto da seção`);
  return grau;
}

/**
 * O papel de cada elemento, pela ligação. Borda livre presa por uma DOBRA (nó
 * de grau 2) a um elemento sem borda livre é enrijecedor de borda; presa numa
 * junção (grau 3+, a mesa de um I, o T) ou a outra borda livre, é aba (AL).
 * Sem borda livre: alma se vertical, mesa se não.
 *
 * ⚠️ NA JUNÇÃO O VIZINHO NÃO É ÚNICO: a mesa de um I presa à alma não é
 * enrijecedor da alma. Antes desta regra, a Tabela 4 tomava a alma do I por
 * "AA com enrijecedor de borda simples" e lhe dava o limite de 60.
 */
function papeis(elementos: Omit<ElementoPlano, 'papel'>[], trechos: Trecho[], presoPorDobra: (e: number) => boolean): PapelDoElemento[] {
  const livre = (e: Omit<ElementoPlano, 'papel'>) => e.bordas.some((b) => b.tipo === 'livre');
  const apoios = (e: Omit<ElementoPlano, 'papel'>) => e.bordas.flatMap((b) => (b.tipo === 'elemento' ? [b.indice] : []));
  const primeira = elementos.map((e, k): PapelDoElemento => {
    if (livre(e)) {
      const preso = apoios(e)[0];
      if (preso === undefined || !presoPorDobra(k) || livre(elementos[preso])) return 'aba';
      // ⚠️ ENRIJECEDOR SÓ SE O ELEMENTO QUE ELE SEGURA SE APOIA, DO OUTRO LADO,
      // NUM ELEMENTO SEM BORDA LIVRE: a mesa do Ue (presa na alma) tem
      // enrijecedor; a alma do U (entre duas mesas livres) não — as livres são
      // as mesas dela. Antes, o U desenhado saía com "enrijecedores" e a alma
      // ganhava o limite 60 da mesa enrijecida (01/11/2026).
      const doOutroLado = apoios(elementos[preso]).filter((x) => x !== k);
      return doOutroLado.some((x) => !livre(elementos[x])) ? 'enrijecedor' : 'mesa';
    }
    const r = trechos[e.trecho] as TrechoReto;
    return Math.abs(r.b.x - r.a.x) < 1e-6 * Math.max(1, Math.abs(r.b.y - r.a.y)) ? 'alma' : 'mesa';
  });
  // Cantoneira enrijecida: as duas abas seguram cada uma o seu enrijecedor e
  // uma à outra — são abas, como na família Le (o cortante da aba depende
  // disso). Na mesa do Ue o vizinho é a alma, que não segura enrijecedor.
  const seguraEnrijecedor = (i: number) => apoios(elementos[i]).some((x) => primeira[x] === 'enrijecedor');
  return primeira.map((p, k) => {
    if (livre(elementos[k]) || !seguraEnrijecedor(k)) return p;
    return apoios(elementos[k]).some((x) => !livre(elementos[x]) && seguraEnrijecedor(x)) ? 'aba' : p;
  });
}

/** A cadeia simples: os nós na ordem, de uma ponta à outra. */
function ordemDaCadeia(d: SecaoDesenhada, grau: number[]): number[] | undefined {
  if (grau.some((g) => g > 2) || d.trechos.length !== d.nos.length - 1) return undefined;
  const espessuras = new Set(d.trechos.map((tr) => tr.t ?? -1));
  if (espessuras.size > 1) return undefined;
  const ordem = [grau.findIndex((g) => g === 1)];
  while (ordem.length < d.nos.length) {
    const a = ordem[ordem.length - 1];
    const prox = d.trechos.map((tr) => (tr.i === a ? tr.j : tr.j === a ? tr.i : -1)).find((b) => b >= 0 && !ordem.includes(b));
    if (prox === undefined) return undefined;
    ordem.push(prox);
  }
  return ordem;
}

export function montarDoDesenho(dim: DimensoesDoPerfil): SecaoGeometrica {
  const d = dim.desenho;
  if (!d) throw new GeometriaInvalida('seção desenhada sem desenho');
  if (!(dim.t > 0)) throw new GeometriaInvalida(`t = ${dim.t} mm: tem de ser maior que zero`);
  if (!(dim.ri >= 0)) throw new GeometriaInvalida(`ri = ${dim.ri} mm: tem de ser ≥ 0`);
  const grau = validar(d, dim.t);
  const t = dim.t * MM;
  const rm = dim.ri * MM + t / 2;
  const P = (k: number): Ponto => ({ x: d.nos[k].x * MM, y: d.nos[k].y * MM });

  // ── Cadeia simples, espessura única: o caminho das famílias ──
  const ordem = ordemDaCadeia(d, grau);
  if (ordem) {
    const te = (d.trechos[0].t ?? dim.t) * MM;
    const rmc = dim.ri * MM + te / 2;
    // os 'papéis' aqui só nomeiam o trecho na mensagem de erro do arredondamento
    const p: Poligonal = { vertices: ordem.map(P), papeis: ordem.slice(1).map((_, i) => `trecho ${i + 1}` as unknown as PapelDoElemento) };
    const { trechos, retos } = arredondar(p, rmc);
    const ultimo = retos.length - 1;
    const semPapel = retos.map((k, i) => {
      const r = trechos[k] as TrechoReto;
      const borda = (viz: number): Borda => (viz < 0 || viz > ultimo ? { tipo: 'livre' } : { tipo: 'elemento', indice: viz });
      return { trecho: k, b: norma(sub(r.b, r.a)), bordas: [borda(i - 1), borda(i + 1)] as [Borda, Borda] };
    });
    const pap = papeis(semPapel, trechos, () => true);
    return { dimensoes: { ...dim, t: te / MM }, t: te, rm: rmc, trechos, elementos: semPapel.map((e, i) => ({ ...e, papel: pap[i] })) };
  }

  // ── Grafo: ramo, célula fechada ou espessuras diferentes ──
  const n = d.nos.length;
  const tDe = (k: number) => (d.trechos[k].t ?? dim.t) * MM;
  const incidentes: number[][] = Array.from({ length: n }, () => []);
  d.trechos.forEach((tr, k) => {
    incidentes[tr.i].push(k);
    incidentes[tr.j].push(k);
  });
  // Recuo do trecho k junto ao nó v, e os arcos das dobras de grau 2.
  const recuo = new Map<string, number>();
  const arcos: { no: number; k1: number; k2: number; arco: Trecho; t1: Ponto; t2: Ponto }[] = [];
  for (let v = 0; v < n; v++) {
    if (incidentes[v].length !== 2) continue;
    const [k1, k2] = incidentes[v];
    if (Math.abs(tDe(k1) - tDe(k2)) > 1e-12) continue; // espessuras diferentes: canto vivo
    const outro = (k: number) => (d.trechos[k].i === v ? d.trechos[k].j : d.trechos[k].i);
    const u1 = unit(sub(P(v), P(outro(k1))));
    const u2 = unit(sub(P(outro(k2)), P(v)));
    const cruz = u1.x * u2.y - u1.y * u2.x;
    const phi = Math.atan2(Math.abs(cruz), u1.x * u2.x + u1.y * u2.y);
    const rmv = dim.ri * MM + tDe(k1) / 2;
    if (phi < 1e-12 || rmv === 0) continue;
    const dd = rmv * Math.tan(phi / 2);
    recuo.set(`${k1}@${v}`, dd);
    recuo.set(`${k2}@${v}`, dd);
    const t1 = soma(P(v), u1, -dd);
    const t2 = soma(P(v), u2, dd);
    const lado = cruz > 0 ? 1 : -1;
    const normal = { x: -u1.y * lado, y: u1.x * lado };
    const centro = soma(t1, normal, rmv);
    const ang0 = Math.atan2(t1.y - centro.y, t1.x - centro.x);
    arcos.push({ no: v, k1, k2, t1, t2, arco: { tipo: 'arco', centro, raio: rmv, ang0, ang1: ang0 + lado * phi } });
  }

  // Nós do grafo: os nós sem arco ficam; o nó com arco vira dois (as tangentes).
  const nos: Ponto[] = [];
  const noSemArco = new Map<number, number>();
  const noDaTangente = new Map<string, number>(); // `${k}@${v}` → nó do grafo
  for (let v = 0; v < n; v++) {
    const a = arcos.find((x) => x.no === v);
    if (!a) {
      noSemArco.set(v, nos.length);
      nos.push(P(v));
    } else {
      noDaTangente.set(`${a.k1}@${v}`, nos.length);
      nos.push(a.t1);
      noDaTangente.set(`${a.k2}@${v}`, nos.length);
      nos.push(a.t2);
    }
  }
  const noDoGrafo = (k: number, v: number) => noDaTangente.get(`${k}@${v}`) ?? noSemArco.get(v)!;

  const trechos: Trecho[] = [];
  const extremos: [number, number][] = [];
  const espessuras: number[] = [];
  const trechoDoSegmento: number[] = [];
  d.trechos.forEach((tr, k) => {
    const a = P(tr.i);
    const b = P(tr.j);
    const u = unit(sub(b, a));
    const ra = recuo.get(`${k}@${tr.i}`) ?? 0;
    const rb = recuo.get(`${k}@${tr.j}`) ?? 0;
    if (norma(sub(b, a)) - ra - rb <= 1e-9) throw new GeometriaInvalida(`trecho ${k + 1}: a parte plana some na dobra — curto demais para o raio de dobramento`);
    trechoDoSegmento.push(trechos.length);
    trechos.push({ tipo: 'reta', a: soma(a, u, ra), b: soma(b, u, -rb) });
    extremos.push([noDoGrafo(k, tr.i), noDoGrafo(k, tr.j)]);
    espessuras.push(tDe(k));
  });
  for (const a of arcos) {
    trechos.push(a.arco);
    extremos.push([noDoGrafo(a.k1, a.no), noDoGrafo(a.k2, a.no)]);
    espessuras.push(tDe(a.k1));
  }

  // Elementos planos: um por segmento desenhado.
  const semPapel = d.trechos.map((tr, k) => {
    const r = trechos[trechoDoSegmento[k]] as TrechoReto;
    // Na junção, o vizinho preferido é um elemento sem borda livre (a alma do I
    // para a mesa): é o que diz em que o elemento se apoia.
    const semLivre = (x: number) => grau[d.trechos[x].i] > 1 && grau[d.trechos[x].j] > 1;
    const borda = (v: number): Borda => {
      if (incidentes[v].length === 1) return { tipo: 'livre' };
      const outros = incidentes[v].filter((x) => x !== k);
      return { tipo: 'elemento', indice: outros.find(semLivre) ?? outros[0] };
    };
    const te = tDe(k);
    return { trecho: trechoDoSegmento[k], b: norma(sub(r.b, r.a)), bordas: [borda(tr.i), borda(tr.j)] as [Borda, Borda], ...(Math.abs(te - t) > 1e-12 ? { t: te } : {}) };
  });
  // presa por dobra: a ponta não livre do elemento está num nó de grau 2
  const presoPorDobra = (k: number) => [d.trechos[k].i, d.trechos[k].j].some((v) => grau[v] === 2);
  const pap = papeis(semPapel, trechos, presoPorDobra);
  const grafo: GrafoDaSecao = { nos, extremos, espessuras };
  return { dimensoes: dim, t, rm, trechos, elementos: semPapel.map((e, i) => ({ ...e, papel: pap[i] })), grafo };
}
