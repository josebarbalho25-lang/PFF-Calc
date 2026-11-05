// ═══════════════════════════════════════════════════════════════════════════
//  ui/Contencao.tsx — a parede corta-fogo das janelas
// ---------------------------------------------------------------------------
//  ⚠️ UM ERRO DENTRO DE UMA JANELA NÃO PODE DERRUBAR A CALCULADORA. Sem esta
//  contenção, uma falha no 3D (placa de vídeo sem WebGL, um quadro que
//  quebrou) desmontava o programa inteiro e deixava a tela preta — com os
//  esforços digitados e tudo. Aqui a janela que falhou some, e o resto fica.
// ═══════════════════════════════════════════════════════════════════════════

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** O que fazer quando a janela falha — em geral, fechá-la. */
  aoFalhar: () => void;
}

export class Contencao extends Component<Props, { falhou: boolean }> {
  state = { falhou: false };

  static getDerivedStateFromError() {
    return { falhou: true };
  }

  componentDidCatch(erro: unknown) {
    console.error('Janela fechada por erro:', erro);
    this.props.aoFalhar();
  }

  render() {
    return this.state.falhou ? null : this.props.children;
  }
}
