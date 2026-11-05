// ═══════════════════════════════════════════════════════════════════════════
//  ui/desenho/EditorDoDesenho.tsx — o editor da seção desenhada
// ---------------------------------------------------------------------------
//  O projetista desenha a seção que quiser, como no painel gráfico do
//  DimPerfil: clicando na grade, digitando coordenadas como no CAD, ou
//  corrigindo nas tabelas. Componente CONTROLADO — o desenho mora no pai, que
//  recebe cada mudança por `mudar`; aqui ficam só o modo, a polilinha em
//  curso, a vista e o desfazer.
//
//  As contas são todas de fora, puras e testadas: o comando digitado
//  (`comando.ts`), o encaixe (`encaixe.ts`), as operações (`edicao.ts`), o
//  desfazer (`historico.ts`), o zoom (`vista.ts`).
//
//  ⚠️ O TECLADO É DA LINHA DE COMANDO, como no AutoCAD: depois de cada
//  clique no quadro o foco volta para ela, e tecla digitada com o foco num
//  botão do editor cai nela também. Espaço vale Enter. As células das
//  tabelas ficam fora disso — lá o Ctrl+Z é o do texto da célula.
//
//  ⚠️ O MOTOR RODA A CADA MUDANÇA (milissegundo) e a chapa desenhada é a
//  dele; o erro dele vai para a barra de estado, e o editor nunca cai por
//  causa de um desenho que o motor recusa.
// ═══════════════════════════════════════════════════════════════════════════

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { montarSecao } from '../../motor/secao/familias';
import type { NoDesenhado, SecaoDesenhada } from '../../motor/secao/tipos';
import { numExato } from '../../relatorio/formatos';
import { CampoNumero } from '../CampoNumero';
import { interpretar } from './comando';
import { alvoSobCursor, encaixar, type AlvoSobCursor } from './encaixe';
import {
  aplicarPonto,
  apagarNo,
  apagarTrecho,
  DESENHO_VAZIO,
  fecharPolilinha,
  lugarDaPonta,
  podeFechar,
  polilinhaValida,
  SEM_POLILINHA,
  tirarSoltos,
  type Alvo,
  type Polilinha,
} from './edicao';
import { desfazer, historicoVazio, refazer, registrar, type Historico } from './historico';
import { QuadroDoDesenho } from './QuadroDoDesenho';
import { TabelasDoDesenho } from './TabelasDoDesenho';
import { ajustar, deslocar, paraMundo, zoomEm, type Tamanho, type Vista } from './vista';
import '../../estilo/desenho.css';

export interface PropsDoEditor {
  desenho: SecaoDesenhada;
  /** Espessura da seção, mm. */
  t: number;
  /** Raio interno de dobramento, mm. */
  ri: number;
  mudar: (d: SecaoDesenhada) => void;
}

type Modo = 'polilinha' | 'apagar';

/** O que o desfazer fotografa: o desenho e a polilinha em curso. */
interface Foto {
  desenho: SecaoDesenhada;
  polilinha: Polilinha;
}

/** Raio de captura do nó e do trecho, px na tela. */
const RAIO_PX = 8;

const fmt = (v: number) => numExato(v, 2);

export function EditorDoDesenho({ desenho, t, ri, mudar }: PropsDoEditor) {
  const [modo, setModo] = useState<Modo>('polilinha');
  const [polilinhaGuardada, setPolilinha] = useState<Polilinha>(SEM_POLILINHA);
  const [historico, setHistorico] = useState<Historico<Foto>>(historicoVazio);
  const [passo, setPasso] = useState(5);
  const [texto, setTexto] = useState('');
  const [recado, setRecado] = useState<{ texto: string; erro: boolean } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [ultimo, setUltimo] = useState<NoDesenhado | null>(null);
  const [realceTabela, setRealceTabela] = useState<AlvoSobCursor | null>(null);
  const [tam, setTam] = useState<Tamanho>({ w: 0, h: 0 });
  const [vista, setVista] = useState<Vista>({ cx: 0, cy: 0, esc: 2 });
  // ⚠️ A VISTA SE AJUSTA SOZINHA A CADA MUDANÇA DE TAMANHO até o projetista
  // mexer nela (roda ou arrasto). A primeira medida pode vir de um tamanho de
  // passagem (a grade da página ainda assentando, a janela abrindo) — ajustar
  // só uma vez deixava a seção cortada para fora do quadro.
  const vistaAutomatica = useRef(true);
  const linhaDeComando = useRef<HTMLInputElement>(null);
  const idDaLinha = useId();

  const polilinha = polilinhaValida(desenho, polilinhaGuardada);
  const lugarPonta = lugarDaPonta(desenho, polilinha);
  const fechavel = podeFechar(desenho, polilinha);

  const motor = useMemo(() => {
    if (!desenho.trechos.length) return { sec: null, erro: null };
    try {
      return { sec: montarSecao({ familia: 'Desenho', bw: 0, bf: 0, D: 0, t, ri, desenho }), erro: null };
    } catch (err) {
      return { sec: null, erro: err instanceof Error ? err.message : String(err) };
    }
  }, [desenho, t, ri]);

  // ── o cursor no plano, o encaixe e o que está sob ele ──
  const raio = RAIO_PX / vista.esc;
  const noPlano = cursor && tam.w > 0 ? paraMundo(vista, tam, cursor) : null;
  const solto = polilinha.ponta?.tipo === 'ponto' ? [polilinha.ponta.p] : [];
  const encaixe = noPlano && modo === 'polilinha' ? encaixar(noPlano, desenho.nos, passo, raio, solto) : null;
  const sobCursor = noPlano && modo === 'apagar' ? alvoSobCursor(desenho, noPlano, raio) : null;
  const realce = sobCursor ?? realceTabela;

  // ── mudar o desenho, guardando a fotografia para o desfazer ──
  function aplicar(novo: SecaoDesenhada, pl: Polilinha, aviso?: string) {
    if (novo !== desenho) {
      setHistorico((h) => registrar(h, { desenho, polilinha }));
      mudar(novo);
    }
    setPolilinha(pl);
    setRecado(aviso ? { texto: aviso, erro: false } : null);
  }

  function pontoNovo(alvo: Alvo, digitado: boolean) {
    const r = aplicarPonto(desenho, polilinha, alvo);
    aplicar(r.desenho, r.polilinha, r.aviso);
    const lugar = lugarDaPonta(r.desenho, r.polilinha);
    if (lugar) setUltimo(lugar);
    // o eco do digitado, com ";": quem quis 12,5 e digitou "12,5" vê (12; 5)
    if (digitado && !r.aviso && lugar) {
      const nome = r.polilinha.ponta?.tipo === 'no' ? `nó ${r.polilinha.ponta.k + 1} ` : '';
      setRecado({ texto: `${nome}(${fmt(lugar.x)}; ${fmt(lugar.y)})`, erro: false });
    }
  }

  function terminar() {
    setPolilinha(SEM_POLILINHA);
    setTexto('');
    linhaDeComando.current?.focus();
  }

  function trocarModo(m: Modo) {
    setModo(m);
    setPolilinha(SEM_POLILINHA);
    setRecado(null);
  }

  function voltar(r: { historico: Historico<Foto>; estado: Foto } | null, nada: string) {
    if (!r) {
      setRecado({ texto: nada, erro: false });
      return;
    }
    setHistorico(r.historico);
    mudar(r.estado.desenho);
    setPolilinha(modo === 'polilinha' ? r.estado.polilinha : SEM_POLILINHA);
    setRecado(null);
  }

  function desfazerUm() {
    // o primeiro ponto pendurado ainda não mudou o desenho: desfazer é largá-lo
    if (polilinha.ponta?.tipo === 'ponto') return setPolilinha(SEM_POLILINHA);
    voltar(desfazer(historico, { desenho, polilinha }), 'nada a desfazer');
  }
  const refazerUm = () => voltar(refazer(historico, { desenho, polilinha }), 'nada a refazer');

  function clicar(s: { x: number; y: number }) {
    const p = paraMundo(vista, tam, s);
    if (modo === 'apagar') {
      const alvo = alvoSobCursor(desenho, p, raio);
      if (alvo) aplicar(alvo.tipo === 'no' ? apagarNo(desenho, alvo.k) : tirarSoltos(apagarTrecho(desenho, alvo.k)), SEM_POLILINHA);
    } else {
      const e = encaixar(p, desenho.nos, passo, raio, solto);
      pontoNovo(e.tipo === 'no' ? { tipo: 'no', k: e.k } : { tipo: 'ponto', p: e.p }, false);
    }
    linhaDeComando.current?.focus();
  }

  function executar() {
    const c = interpretar(texto, lugarPonta ?? ultimo, desenho.nos.length);
    if (c.tipo === 'erro') return setRecado({ texto: c.mensagem, erro: true });
    setTexto('');
    if (modo === 'apagar') {
      if (c.tipo === 'fim') trocarModo('polilinha');
      else if (c.tipo === 'no') aplicar(apagarNo(desenho, c.k), SEM_POLILINHA);
      else if (c.tipo === 'desfazer') desfazerUm();
      else setRecado({ texto: 'nó ou trecho', erro: true });
      return;
    }
    switch (c.tipo) {
      case 'fim':
        return terminar();
      case 'desfazer':
        return desfazerUm();
      case 'fechar': {
        const r = fecharPolilinha(desenho, polilinha);
        return aplicar(r.desenho, r.polilinha, r.aviso);
      }
      case 'no':
        return pontoNovo(c, true);
      case 'ponto':
        return pontoNovo(c, true);
    }
  }

  function tecla(e: KeyboardEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    const naLinha = alvo === linhaDeComando.current;
    // célula da tabela e o campo da grade: o teclado é deles
    if (!naLinha && (alvo.tagName === 'INPUT' || alvo.tagName === 'SELECT' || alvo.tagName === 'TEXTAREA')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (ctrl && k === 'z' && !e.shiftKey) {
      e.preventDefault();
      return desfazerUm();
    }
    if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) {
      e.preventDefault();
      return refazerUm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (texto) setTexto('');
      else if (modo === 'apagar') trocarModo('polilinha');
      else terminar();
      return;
    }
    if (naLinha && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      return executar();
    }
    if (!naLinha && !ctrl && !e.altKey && e.key.length === 1 && e.key !== ' ') {
      e.preventDefault();
      setTexto((s) => s + e.key);
      linhaDeComando.current?.focus();
    }
  }

  function medir(novo: Tamanho) {
    setTam(novo);
    if (vistaAutomatica.current && novo.w > 0 && novo.h > 0) {
      setVista(ajustar(desenho.nos, novo));
    }
  }

  function ajustarVista() {
    vistaAutomatica.current = true;
    setVista(ajustar(desenho.nos, tam));
  }

  const pelaTabela = (novo: SecaoDesenhada) => aplicar(novo, SEM_POLILINHA);

  const prompt =
    modo === 'apagar' ? 'Nó ou trecho a apagar:' : !polilinha.ponta ? 'Primeiro ponto:' : `Próximo ponto [${fechavel ? 'Fechar/' : ''}Desfazer]:`;
  const naMira = encaixe?.p ?? noPlano;
  const elastico = encaixe && lugarPonta ? { L: Math.hypot(encaixe.p.x - lugarPonta.x, encaixe.p.y - lugarPonta.y), a: (Math.atan2(encaixe.p.y - lugarPonta.y, encaixe.p.x - lugarPonta.x) * 180) / Math.PI } : null;

  return (
    // tabIndex: o clique em área sem controle (cabeçalho de tabela, vão da
    // barra) foca o editor, e não o corpo da página — o Ctrl+Z continua aqui
    <div className="des-editor" tabIndex={-1} onKeyDown={tecla}>
      {/* Depois de qualquer botão o teclado volta à linha de comando: o
          Limpar se desliga ao limpar, e o botão desligado larga o foco no
          corpo da página — o que se digitasse em seguida sumia. */}
      <div
        className="des-barra"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) linhaDeComando.current?.focus();
        }}
      >
        <div className="seg">
          <button type="button" className={modo === 'polilinha' ? 'on' : undefined} onClick={() => trocarModo('polilinha')}>
            Polilinha
          </button>
          <button type="button" className={modo === 'apagar' ? 'on' : undefined} onClick={() => trocarModo('apagar')}>
            Apagar
          </button>
        </div>
        <div className="des-passo">
          <CampoNumero rotulo="Grade" valor={passo} unidade="mm" positivo aoMudar={setPasso} />
        </div>
        <button type="button" className="btn-fantasma" onClick={ajustarVista}>
          Ajustar
        </button>
        <span className="des-vao" />
        <button type="button" className="btn-icone" title="Desfazer (Ctrl+Z)" disabled={!historico.passado.length && polilinha.ponta?.tipo !== 'ponto'} onClick={desfazerUm}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
            <path d="M5 3 L2 6 L5 9 M2 6 H10 A4 4 0 0 1 10 14 H7" />
          </svg>
        </button>
        <button type="button" className="btn-icone" title="Refazer (Ctrl+Y)" disabled={!historico.futuro.length} onClick={refazerUm}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
            <path d="M11 3 L14 6 L11 9 M14 6 H6 A4 4 0 0 0 6 14 H9" />
          </svg>
        </button>
        <button type="button" className="btn-fantasma" disabled={!desenho.nos.length} onClick={() => aplicar(DESENHO_VAZIO, SEM_POLILINHA)}>
          Limpar
        </button>
      </div>

      <QuadroDoDesenho
        desenho={desenho}
        sec={motor.sec}
        vista={vista}
        tam={tam}
        passo={passo}
        ponta={modo === 'polilinha' ? lugarPonta : null}
        pendente={polilinha.ponta?.tipo === 'ponto' ? polilinha.ponta.p : null}
        mira={encaixe ? { p: encaixe.p, noNo: encaixe.tipo === 'no', guias: encaixe.tipo === 'grade' ? encaixe.guias : [] } : null}
        realce={realce}
        apagando={modo === 'apagar'}
        medir={medir}
        mover={setCursor}
        clicar={clicar}
        terminar={terminar}
        arrastar={(dx, dy) => {
          vistaAutomatica.current = false;
          setVista((v) => deslocar(v, dx, dy));
        }}
        rolar={(s, f) => {
          vistaAutomatica.current = false;
          setVista((v) => zoomEm(v, tam, s, f));
        }}
        ajustar={ajustarVista}
      />

      <TabelasDoDesenho desenho={desenho} t={t} passo={passo} mudar={pelaTabela} realce={realce} realcar={setRealceTabela} />

      <div className="des-comando">
        <label className="des-prompt" htmlFor={idDaLinha}>
          {prompt}
        </label>
        <input
          id={idDaLinha}
          ref={linhaDeComando}
          className="campo des-linha"
          value={texto}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setTexto(e.target.value)}
        />
        {recado && <span className={`des-recado${recado.erro ? ' erro' : ''}`}>{recado.texto}</span>}
        {motor.erro && <span className="des-erro">{motor.erro}</span>}
        <span className="des-coord">
          {naMira && (
            <>
              <i>x</i> <span className="valor">{fmt(naMira.x)}</span> <i>y</i> <span className="valor">{fmt(naMira.y)}</span>
            </>
          )}
          {elastico && (
            <>
              {' · '}
              <i>L</i> <span className="valor">{fmt(elastico.L)}</span> ∠ <span className="valor">{fmt(elastico.a)}°</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
