// ═══════════════════════════════════════════════════════════════════════════
//  ui/tema.ts — escuro, claro e papel, os três temas do A-PORT
// ---------------------------------------------------------------------------
//  O mesmo jeito do A-PORT (`ui/Rail.tsx`, `estilo/preferenciasDaInterface.ts`):
//  um botão gira entre os três, a escolha fica no navegador (preferência da
//  máquina, não do cálculo), e quem desenha observa body[data-theme].
//
//  ⚠️ O WEBGL NÃO LÊ CSS: as cenas 3D leem o token na montagem (`cor()`). Por
//  isso cada cena usa o tema como `key` e REMONTA na troca — senão ficava com
//  a cor do tema anterior. SVG e HTML repintam sozinhos pelas classes. A
//  memória em PDF tem estilo próprio e não muda com o tema.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

export const TEMAS = ['dark', 'modern', 'paper'] as const;
export type Tema = (typeof TEMAS)[number];
const CHAVE = 'calculadora-nbr14762:tema';

const valido = (t: unknown): t is Tema => TEMAS.includes(t as Tema);

export function temaAtual(): Tema {
  const t = typeof document === 'undefined' ? 'dark' : document.body.dataset.theme;
  return valido(t) ? t : 'dark';
}

/** Na partida: o tema guardado, se houver. */
export function aplicarTemaGuardado(): void {
  // o print sem janela pede o tema pelo endereço (`&tema=paper`), como pede a janela
  const doEndereco = typeof location === 'undefined' ? null : /[#&]tema=(dark|modern|paper)(?![a-z])/.exec(location.hash)?.[1];
  if (valido(doEndereco)) {
    document.body.dataset.theme = doEndereco;
    return;
  }
  try {
    const t = localStorage.getItem(CHAVE);
    if (valido(t)) document.body.dataset.theme = t;
  } catch {
    // navegador sem armazenamento: fica o do HTML
  }
}

export function trocarTema(): void {
  definirTema(TEMAS[(TEMAS.indexOf(temaAtual()) + 1) % TEMAS.length]!);
}

/** Escolhe o tema (o painel de configuração) e o guarda no navegador. */
export function definirTema(t: Tema): void {
  document.body.dataset.theme = t;
  try {
    localStorage.setItem(CHAVE, t);
  } catch {
    // sem armazenamento: só não lembra
  }
}

/** O tema de agora, que muda quando body[data-theme] muda. */
export function usarTema(): Tema {
  const [tema, setTema] = useState<Tema>(temaAtual);
  useEffect(() => {
    const obs = new MutationObserver(() => setTema(temaAtual()));
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return tema;
}
