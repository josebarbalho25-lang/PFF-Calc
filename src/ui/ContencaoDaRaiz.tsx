// ═══════════════════════════════════════════════════════════════════════════
//  ui/ContencaoDaRaiz.tsx — o último corta-fogo, em volta da calculadora
// ---------------------------------------------------------------------------
//  ⚠️ SEM ELE, UM ERRO NÃO PREVISTO DEIXA A TELA EM BRANCO — e, se a entrada
//  que causou o erro ficou guardada, branca a cada recarga, sem ele ter como
//  sair (achado B2 da revisão de 01/11/2026). Aqui aparece a mensagem e um
//  botão que volta à entrada de partida.
// ═══════════════════════════════════════════════════════════════════════════

import { Component, type ReactNode } from 'react';
import { esquecerEntrada } from './guardarEntrada';

export class ContencaoDaRaiz extends Component<{ children: ReactNode }, { erro: string | null }> {
  state = { erro: null as string | null };

  static getDerivedStateFromError(erro: unknown) {
    return { erro: erro instanceof Error ? erro.message : String(erro) };
  }

  componentDidCatch(erro: unknown) {
    console.error('Calculadora parada por erro:', erro);
  }

  render() {
    if (this.state.erro === null) return this.props.children;
    return (
      <div className="tela-de-erro">
        <span className="campo-estado alarme">{this.state.erro}</span>
        <button
          type="button"
          className="btn-primario"
          onClick={() => {
            esquecerEntrada();
            location.hash = '';
            location.reload();
          }}
        >
          Recomeçar
        </button>
      </div>
    );
  }
}
