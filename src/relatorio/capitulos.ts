// ═══════════════════════════════════════════════════════════════════════════
//  relatorio/capitulos.ts — os capítulos da memória: premissas, a flambagem
//  elástica da seção, uma seção por verificação e as conclusões
// ---------------------------------------------------------------------------
//  Cada verificação vira um capítulo com os PASSOS que o motor devolveu, na
//  ordem em que a conta foi feita: o item da norma na coluna da esquerda, a
//  fórmula, a substituição e o resultado à direita. Nada é recalculado aqui —
//  o número da página é o da conta (`motor/norma/memoria.ts`).
// ═══════════════════════════════════════════════════════════════════════════

import type { CriticosDoSentido } from '../motor/faixas/criticos';
import type { ResultadoDaVerificacao } from '../motor/norma';
import { E, G, GAMA_COMPRESSAO, secaoDoPerfil } from '../motor/norma/compressao';
import { contasDosMomentosPrincipais, eixosGirados } from '../motor/norma/eixosPrincipais';
import { GAMA_FLEXAO } from '../motor/norma/flexao';
import type { Verificacao } from '../motor/norma/memoria';
import { desenhoDaCurva } from '../visualizacao/desenhoDaCurva';
import { desenhoDaSecao } from '../visualizacao/geometriaDaSecao';
import { designacao } from './designacao';
import { contaHtml, contasHtml } from './expr';
import { esc, num, numExato } from './formatos';
import { kv, nota, passo, secao, situacao, tabela, v } from './pecas';

const NORMA = 'NBR 14762:2010';
const NOME_DO_METODO = { MLE: 'método da largura efetiva (MLE)', MSE: 'método da seção efetiva (MSE)', MRD: 'método da resistência direta (MRD, Anexo C)' } as const;
const PAPEL = { alma: 'alma', mesa: 'mesa', enrijecedor: 'enrijecedor', aba: 'aba' } as const;

/** O corte da seção como SVG em texto, da mesma geometria da tela, com G e CT. */
export function svgDaSecao(r: ResultadoDaVerificacao): string {
  const g = desenhoDaSecao(r.secao, r.propriedades);
  const linhas = g.linhas.map((l) => `<line class="sec-${l.classe}" x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"/>`).join('');
  const textos = g.textos
    .map((t) => {
      const rot = t.rot ? ` transform="rotate(${t.rot} ${t.x} ${t.y})"` : '';
      const indice = t.indice ? `<tspan class="indice" dy="3">${esc(t.indice)}</tspan>` : '';
      const valor = t.valor ? `<tspan dy="${t.indice ? -3 : 0}"> = ${esc(t.valor)}</tspan>` : '';
      return `<text class="sec-texto-${t.classe}" x="${t.x}" y="${t.y}" text-anchor="${t.ancora}"${rot}><tspan class="simbolo">${esc(t.texto)}</tspan>${indice}${valor}</text>`;
    })
    .join('');
  const marcas = g.marcas
    .map((m) =>
      m.tipo === 'centroide'
        ? `<circle class="sec-marca-g" cx="${m.x}" cy="${m.y}" r="4"/>`
        : `<g class="sec-marca-ct"><circle cx="${m.x}" cy="${m.y}" r="3.5"/><line x1="${m.x - 6}" y1="${m.y}" x2="${m.x + 6}" y2="${m.y}"/><line x1="${m.x}" y1="${m.y - 6}" x2="${m.x}" y2="${m.y + 6}"/></g>`,
    )
    .join('');
  return `<svg class="secao-perfil" viewBox="0 0 ${g.largura} ${g.altura}" xmlns="http://www.w3.org/2000/svg"><path class="sec-corpo${g.emendas ? ' emendado' : ''}" d="${g.contorno}"/>${g.emendas ? `<path class="sec-miolo" d="${g.contorno}"/>` : ''}${linhas}${marcas}${textos}</svg>`;
}

/** A curva de assinatura como SVG em texto, a mesma da janela do (?). */
function svgDaCurva(L: number[], s: CriticosDoSentido, unidade: string): string {
  const g = desenhoDaCurva(L, s.lam, s.minimos.map((m) => ({ L: m.L, lam: m.lam, modo: m.modo, ombro: m.ombro })), { largura: 520, altura: 220 });
  const a = g.area;
  const grade =
    g.eixoY.map((t) => `<line class="curva-grade" x1="${a.x0}" x2="${a.x1}" y1="${t.y}" y2="${t.y}"/><text class="curva-tique" x="${a.x0 - 5}" y="${t.y + 3}" text-anchor="end">${esc(t.rotulo)}</text>`).join('') +
    g.eixoX.map((t) => `<line class="curva-grade" x1="${t.x}" x2="${t.x}" y1="${a.y0}" y2="${a.y1}"/><text class="curva-tique" x="${t.x}" y="${a.y1 + 13}" text-anchor="middle">${esc(t.rotulo)}</text>`).join('');
  const minimos = g.minimos
    .map((m) => `<circle class="curva-min ${m.modo}" cx="${m.x}" cy="${m.y}" r="4"/><text class="curva-min-txt" x="${m.x}" y="${m.y + 15}" text-anchor="middle">${m.modo}${m.ombro ? ' (ombro)' : ''} ${num(m.lam, m.lam >= 1000 ? 0 : 1)}</text>`)
    .join('');
  return (
    `<svg class="curva" viewBox="0 0 ${g.largura} ${g.altura}" xmlns="http://www.w3.org/2000/svg">${grade}` +
    `<rect class="curva-moldura" x="${a.x0}" y="${a.y0}" width="${a.x1 - a.x0}" height="${a.y1 - a.y0}"/>` +
    `<path class="curva-linha" d="${g.caminho}"/>${minimos}` +
    `<text class="curva-eixo" x="${a.x1}" y="${g.altura - 2}" text-anchor="end">L (cm)</text><text class="curva-eixo" x="${a.x0 + 4}" y="${a.y0 + 11}">${esc(unidade)}</text></svg>`
  );
}

export function capituloPremissas(r: ResultadoDaVerificacao, n: number): string {
  const p = r.entrada.perfil;
  const pr = r.propriedades;
  const aco = r.entrada.aco;
  const f = r.entrada.esforcos;
  const L = r.entrada.comprimentos;
  const d2 = (x: number) => numExato(x, 2);
  // Na seção desenhada, bw, bf e D são sobras da família de antes: a forma é a dos nós.
  const dimensoes: Array<[string, string, string]> =
    p.familia === 'Desenho' ? [] : [[v('b', 'w'), d2(p.bw), 'mm'], [v('b', 'f'), d2(p.bf), 'mm'], ...(p.D > 0 ? [[v('D'), d2(p.D), 'mm'] as [string, string, string]] : [])];
  const props: Array<[string, string, string]> = [
    ...dimensoes,
    [v('t'), d2(p.t), 'mm'],
    [v('r', 'i'), d2(p.ri), 'mm'],
    [v('A'), num(pr.A, 3), 'cm²'],
    [v('I', 'x'), num(pr.Ix, 2), 'cm⁴'],
    [v('I', 'y'), num(pr.Iy, 2), 'cm⁴'],
    [v('r', 'x'), num(pr.rx, 3), 'cm'],
    [v('r', 'y'), num(pr.ry, 3), 'cm'],
    [v('x', '0'), num(pr.x0, 3), 'cm'],
    [v('y', '0'), num(pr.y0, 3), 'cm'],
    [v('r', '0'), num(pr.r0, 3), 'cm'],
    [v('J'), num(pr.J, 4), 'cm⁴'],
    [v('C', 'w'), num(pr.Cw, 1), 'cm⁶'],
  ];
  const metade = Math.ceil(props.length / 2);
  const linhasProps = Array.from({ length: metade }, (_, i) => {
    const a = props[i]!;
    const b = props[i + metade];
    return { celulas: [a[0], `${a[1]} <span class="nevoa">${a[2]}</span>`, b ? b[0] : '', b ? `${b[1]} <span class="nevoa">${b[2]}</span>` : ''] };
  });
  const tabProps = tabela([{ cab: 'Grandeza', txt: true }, { cab: 'Valor' }, { cab: 'Grandeza', txt: true }, { cab: 'Valor' }], linhasProps, 'props-tab');
  // Os elementos que a flambagem local lê: na solda intermitente, os de um Ue (cada perfil isolado).
  const local = secaoDoPerfil(r.secao);
  const elementos = tabela(
    [{ cab: local.n > 1 ? 'Elemento de cada Ue' : 'Elemento', txt: true }, { cab: `${v('b')} (cm)` }, { cab: `${v('b')}/${v('t')}` }],
    local.sec.elementos
      .filter((el, i, todos) => todos.findIndex((o) => o.papel === el.papel && Math.abs(o.b - el.b) < 1e-9) === i)
      .map((el) => ({ celulas: [PAPEL[el.papel], num(el.b, 3), num(el.b / (el.t ?? local.sec.t), 1)] })),
  );
  // Seção desenhada: os nós e os trechos, como ele desenhou (mm).
  const desenho = p.familia === 'Desenho' && p.desenho
    ? tabela(
        [{ cab: 'Trecho', txt: true }, { cab: 'De (x; y)' }, { cab: 'Até (x; y)' }, { cab: `${v('t')} (mm)` }],
        p.desenho.trechos.map((tr, k) => {
          const a = p.desenho!.nos[tr.i];
          const b = p.desenho!.nos[tr.j];
          return { celulas: [`${k + 1}: nó ${tr.i + 1} → nó ${tr.j + 1}`, `${num(a.x, 1)}; ${num(a.y, 1)}`, `${num(b.x, 1)}; ${num(b.y, 1)}`, numExato(tr.t ?? p.t, 2)] };
        }),
      )
    : '';
  // Dois Ue boca com boca: a hipótese da solda, escrita (pedido dele).
  const ligacao =
    p.familia === 'Ue2'
      ? kv([
          [
            'Ligação dos dois Ue',
            p.solda?.tipo === 'intermitente'
              ? `solda intermitente a cada ${v('s')} = ${numExato(p.solda.s, 1)} cm: barra composta (9.7.5); local e distorcional de cada perfil isolado (nota das Tabelas 9 e 12); torção sem célula fechada`
              : 'solda contínua ao longo dos enrijecedores: seção tubular fechada (Tabelas 9 e 10, caso d; 12 e 13, caso c); os dois enrijecedores soldados viram uma nervura de 2t; área e inércias dos dois Ue, J e Cw da célula fechada',
          ],
        ])
      : '';

  const corpo =
    passo({
      n: `${n}.1`,
      ref: `${NORMA}, 4.6`,
      titulo: 'Norma, método e coeficientes',
      corpo: kv([
        ['Norma', 'ABNT NBR 14762:2010'],
        ['Flambagem local', NOME_DO_METODO[r.entrada.metodo]],
        ['Módulo de elasticidade', `${v('E')} = ${num(E, 0)} kN/cm²`],
        ['Módulo de elasticidade transversal', `${v('G')} = ${num(G, 0)} kN/cm²`],
        ['Coeficientes de ponderação', `${v('γ')} = ${num(GAMA_COMPRESSAO, 2)} na compressão; ${v('γ')} = ${num(GAMA_FLEXAO, 2)} na tração, flexão e cortante`],
      ]),
    }) +
    passo({
      n: `${n}.2`,
      ref: `${NORMA}, 4.1 e Tabela 1`,
      titulo: 'Material',
      corpo: kv([
        ['Aço', esc(aco.nome)],
        ['Resistência ao escoamento', `${v('f', 'y')} = ${numExato(aco.fy, 2)} kN/cm²`],
        ['Resistência à ruptura', `${v('f', 'u')} = ${numExato(aco.fu, 2)} kN/cm²`],
      ]),
    }) +
    passo({
      n: `${n}.3`,
      ref: 'Linha média com cantos em arco',
      titulo: `Seção transversal — ${esc(designacao(p))}`,
      corpo:
        `<div class="secao-e-props"><figure>${svgDaSecao(r)}</figure>${tabProps}</div>` +
        ligacao +
        elementos +
        desenho +
        nota(
          p.familia === 'Desenho'
            ? `Seção desenhada: os nós na linha média da chapa; nas dobras (nó com dois trechos), cantos em arco de raio médio ${v('r', 'i')} + ${v('t')}/2; nas junções, canto vivo. G: centroide; CT: centro de torção (${v('x', '0')}, ${v('y', '0')} a partir de G). Larguras planas ${v('b')} sem os cantos (9.2).`
            : `Dimensões externas da NBR 6355; propriedades pela linha média da chapa, com os cantos em arco de raio médio ${v('r', 'i')} + ${v('t')}/2. G: centroide; CT: centro de torção (${v('x', '0')}, ${v('y', '0')} a partir de G). Larguras planas ${v('b')} sem os cantos (9.2).`,
        ),
    }) +
    passo({
      n: `${n}.4`,
      titulo: 'Esforços solicitantes de cálculo',
      corpo: kv([
        ['Força normal', `${v('N', 'Sd')} = ${num(f.N, 2)} kN ${f.N > 0 ? '(compressão)' : f.N < 0 ? '(tração)' : ''}`],
        ['Momento fletor em torno de x', `${v('M', 'x,Sd')} = ${num(f.Mx, 1)} kN·cm ${f.Mx > 0 ? '(comprime em cima)' : f.Mx < 0 ? '(comprime embaixo)' : ''}`],
        ['Momento fletor em torno de y', `${v('M', 'y,Sd')} = ${num(f.My, 1)} kN·cm ${f.My > 0 ? '(comprime o lado +x)' : f.My < 0 ? '(comprime o lado −x)' : ''}`],
        ['Força cortante em x', `${v('V', 'x,Sd')} = ${num(f.Vx, 2)} kN`],
        ['Força cortante em y', `${v('V', 'y,Sd')} = ${num(f.Vy, 2)} kN`],
      ]) +
        // Z e cantoneira: os mesmos momentos nos eixos principais, para quem
        // confere com um programa que trabalha neles. A verificação usa Mx e My
        // (eixos da alma, flexão restrita); os principais entram no Ne e no Me.
        (eixosGirados(r.propriedades) && (f.Mx !== 0 || f.My !== 0)
          ? contasHtml({ ref: '', titulo: '', contas: contasDosMomentosPrincipais(r.propriedades.alfa, f.Mx, f.My) }) +
            nota(`Nos eixos principais (α = ${num((r.propriedades.alfa * 180) / Math.PI, 2)}°, capítulo da compressão). A verificação usa ${v('M', 'x,Sd')} e ${v('M', 'y,Sd')}: flexão restrita, nos eixos da alma (9.8.2.2).`)
          : ''),
    }) +
    passo({
      n: `${n}.5`,
      ref: `${NORMA}, 9.7.2.1 e 9.8.2.2`,
      titulo: 'Comprimentos e fatores',
      corpo: kv([
        ['Flambagem por flexão em x', `${v('K', 'x')}${v('L', 'x')} = ${numExato(L.Lx, 1)} cm`],
        ['Flambagem por flexão em y', `${v('K', 'y')}${v('L', 'y')} = ${numExato(L.Ly, 1)} cm`],
        ['Torção e FLT', `${v('K', 'z')}${v('L', 'z')} = ${numExato(L.Lz, 1)} cm`],
        ['Fator de momento não uniforme', `${v('C', 'b')} = ${numExato(L.Cb, 3)}`],
        ['Enrijecedores transversais', L.a > 0 ? `${v('a')} = ${numExato(L.a, 1)} cm` : 'sem enrijecedores'],
      ]),
    });
  return secao(n, 'Premissas e dados de entrada', corpo);
}

/** A flambagem elástica da seção: as curvas de assinatura e os críticos que as verificações usaram. */
export function capituloFlambagem(r: ResultadoDaVerificacao, n: number): string {
  const c = r.entrada.criticos;
  const linhaDos = (s: CriticosDoSentido, sim: string, un: string) =>
    [
      [`${sim}<sub>ℓ</sub>`, s.local],
      [`${sim}<sub>dist</sub>`, s.distorcional],
    ].map(([rot, m]) => ({
      celulas: [rot as string, m && typeof m === 'object' ? `${num(m.lam, m.lam >= 1000 ? 1 : 2)} <span class="nevoa">${un}</span>` : '—', m && typeof m === 'object' ? `${num(m.L, 1)} cm` : 'sem vale'],
    }));
  const caso = (titulo: string, L: number[], s: CriticosDoSentido, sim: string, un: string, i: number) =>
    passo({
      n: `${n}.${i}`,
      ref: `${NORMA}, C.1 e C.2`,
      titulo,
      corpo: `<figure>${svgDaCurva(L, s, un)}</figure>` + tabela([{ cab: 'Crítico', txt: true }, { cab: 'Valor' }, { cab: 'Meia-onda' }], linhaDos(s, sim, un)),
    });
  const corpo =
    nota(
      'Faixas finitas sobre a linha média da seção (4 faixas por trecho reto, 2 por canto), extremidades simplesmente apoiadas, um termo longitudinal. Os críticos são os mínimos da curva (C.1); o vale é classificado local ou distorcional pela forma do modo. Sem vale, o modo não entra na conta (C.2).',
    ) +
    caso('Compressão centrada', c.P.L, c.P.pos, v('N'), 'kN', 1) +
    caso(`Flexão em x, ${r.flexaoX.sentido > 0 ? 'comprimido em cima' : 'comprimido embaixo'}`, c.Mx.L, r.flexaoX.sentido > 0 ? c.Mx.neg : c.Mx.pos, v('M'), 'kN·cm', 2) +
    caso(`Flexão em y, ${r.flexaoY.sentido > 0 ? 'comprimido o lado +x' : 'comprimido o lado −x'}`, c.My.L, r.flexaoY.sentido > 0 ? c.My.neg : c.My.pos, v('M'), 'kN·cm', 3);
  return secao(n, 'Flambagem elástica da seção', corpo);
}

/** Um capítulo por verificação: os passos do motor, e a linha final Sd ≤ Rd. */
export function capituloDaVerificacao(vf: Verificacao, n: number): string {
  const corpo =
    vf.passos
      .map((p, i) =>
        passo({
          n: `${n}.${i + 1}`,
          ref: `${NORMA}, ${esc(p.ref)}`,
          titulo: esc(p.titulo),
          corpo: contasHtml(p),
        }),
      )
      .join('') +
    passo({
      n: `${n}.${vf.passos.length + 1}`,
      titulo: 'Situação',
      corpo:
        [...vf.avisos, ...(vf.notas ?? [])].map((a) => nota(esc(a))).join('') +
        `<div class="verif">${contaHtml({ simbolo: { t: 'txt', s: 'Sd/Rd' }, valor: vf.razao, casas: 3 })}${situacao(vf.situacao)}${vf.governa ? `<span class="nevoa">${esc(vf.governa)}</span>` : ''}</div>`,
    });
  return secao(n, `${esc(vf.titulo)} <span class="nevoa" style="font-size:10pt">— ${NORMA}, ${esc(vf.item)}</span>`, corpo);
}

/** A tabela do resumo, usada na capa e nas conclusões. */
export function tabelaResumo(r: ResultadoDaVerificacao): string {
  const casas = (u: string) => (u === 'kN·cm' ? 1 : 2);
  const semValor = (k: string) => k === 'combinada' || k === 'momentoCortante';
  const pior = r.lista.filter((vf) => !vf.naoVerificada).reduce((a, b) => (Number.isNaN(b.razao) || b.razao > a.razao ? b : a));
  return tabela(
    [{ cab: 'Verificação', txt: true }, { cab: 'Item' }, { cab: 'S<sub>d</sub>' }, { cab: 'R<sub>d</sub>' }, { cab: 'S<sub>d</sub>/R<sub>d</sub>' }, { cab: 'Governa', txt: true }, { cab: 'Situação', txt: true }],
    r.lista.map((vf) => ({
      classe: vf === pior ? 'governa' : undefined,
      celulas: [
        esc(vf.titulo),
        esc(vf.item),
        semValor(vf.chave) ? '—' : `${num(vf.sd, casas(vf.unidade))} <span class="nevoa">${esc(vf.unidade)}</span>`,
        semValor(vf.chave) ? '1,0' : `${num(vf.rd, casas(vf.unidade))} <span class="nevoa">${esc(vf.unidade)}</span>`,
        num(vf.razao, 3),
        esc(vf.governa ?? ''),
        situacao(vf.situacao),
      ],
    })),
  );
}

/**
 * A assinatura das conclusões, igual na 8800: linha 1 o nome; linha 2
 * "Título · CREA 000000/D" (o "CREA " só se o valor não começa com ele).
 * Projetista em branco (ou só espaços): a linha para assinar à mão.
 */
function assinatura(nome: string, titulo: string, crea: string): string {
  const [n, t, c] = [nome.trim(), titulo.trim(), crea.trim()];
  const creaTexto = c && (/^crea(?![a-z])/i.test(c) ? c : `CREA ${c}`);
  const linha2 = [t, creaTexto].filter(Boolean).map(esc).join(' · ');
  return `<div class="assinatura"><span class="forte">${n ? esc(n) : '&nbsp;'}</span>${linha2 || 'Responsável técnico'}</div>`;
}

export function capituloConclusoes(r: ResultadoDaVerificacao, n: number, responsavel: string, registro: string, titulo = ''): string {
  const palavra = r.situacao === 'atende' ? 'atende' : r.situacao === 'avaliar' ? 'atende, com ressalvas,' : 'não atende';
  const corpo =
    `<div class="fecho">` +
    `<p>O perfil ${esc(designacao(r.entrada.perfil))} em ${esc(r.entrada.aco.nome)} ${palavra} aos estados-limites últimos verificados pela ABNT ${NORMA}, ${NOME_DO_METODO[r.entrada.metodo]}, com índice de utilização máximo ${num(r.razaoMaxima, 3)}.</p>` +
    tabelaResumo(r) +
    nota(
      'Não verificados aqui: ruptura da seção líquida (depende da ligação), forças concentradas (Anexo D), estados-limites de serviço, barras com painel na mesa tracionada (Anexo F), ligações e a estabilidade global da estrutura, que fornece os esforços.',
    ) +
    assinatura(responsavel, titulo, registro) +
    `</div>`;
  return secao(n, 'Conclusões', corpo);
}
