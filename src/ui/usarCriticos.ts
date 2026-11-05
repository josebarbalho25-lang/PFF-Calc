// ═══════════════════════════════════════════════════════════════════════════
//  ui/usarCriticos.ts — pede ao trabalhador os críticos elásticos da seção
// ---------------------------------------------------------------------------
//  ⚠️ OS CRÍTICOS SÓ VALEM PARA AS DIMENSÕES DE QUE SAÍRAM. Cada resultado
//  guarda a chave das dimensões; com a chave mudada, a resposta é "calculando"
//  na mesma hora — não depois dos 250 ms da digitação. Antes (revisão de
//  01/11/2026), nesses 250 ms a norma rodava com a geometria nova e os
//  críticos velhos, e o PDF exportado nesse intervalo saía "Atende" com o Nℓ
//  do perfil anterior.
//
//  ⚠️ SÓ VALE A ÚLTIMA RESPOSTA. Quem digita "150" manda três pedidos (1, 15,
//  150); as respostas podem chegar fora de ordem. Cada pedido leva um número,
//  e resposta com número antigo é jogada fora.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { criticosElasticos, type CriticosElasticos } from '../motor/faixas/criticos';
import { montarSecao } from '../motor/secao/familias';
import type { PedidoDeCriticos, RespostaDeCriticos } from '../motor/faixas/trabalhador';
import type { DimensoesDoPerfil } from '../motor/secao/tipos';

export type EstadoDosCriticos = { estado: 'calculando' } | { estado: 'pronto'; criticos: CriticosElasticos } | { estado: 'erro'; erro: string };

/** Um resultado e as dimensões de que ele saiu. */
export interface CriticosGuardados {
  chave: string;
  resultado: EstadoDosCriticos;
}

export const chaveDasDimensoes = (d: DimensoesDoPerfil) => JSON.stringify(d);

/** O que a tela pode usar agora: o guardado só se for destas dimensões. */
export function criticosDaChave(g: CriticosGuardados | null, chave: string): EstadoDosCriticos {
  return g && g.chave === chave ? g.resultado : { estado: 'calculando' };
}

function calcularAqui(d: DimensoesDoPerfil): EstadoDosCriticos {
  try {
    return { estado: 'pronto', criticos: criticosElasticos(montarSecao(d)) };
  } catch (err) {
    return { estado: 'erro', erro: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * ⚠️ NO PRINT SEM JANELA (`scripts/prints.ps1`, entrada pelo endereço) a conta
 * roda direto, sem trabalhador: o Edge sem janela fecha o print antes de a
 * resposta do trabalhador chegar. Mudando uma dimensão depois, roda direto de
 * novo (antes ficava presa na primeira). Na tela de uso, nunca — travaria a
 * digitação.
 */
const DIRETO = typeof location !== 'undefined' && location.hash.startsWith('#entrada=');

export function usarCriticos(dimensoes: DimensoesDoPerfil): EstadoDosCriticos {
  const chave = chaveDasDimensoes(dimensoes);
  // `chave` resume as dimensões; o objeto muda de identidade a cada render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const direto = useMemo(() => (DIRETO ? calcularAqui(dimensoes) : null), [chave]);
  const [guardado, setGuardado] = useState<CriticosGuardados | null>(null);
  const trabalhador = useRef<Worker | null>(null);
  const ultimo = useRef(0);
  const chaveDoPedido = useRef(new Map<number, string>());

  useEffect(() => {
    if (DIRETO) return;
    const w = new Worker(new URL('../motor/faixas/trabalhador.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent<RespostaDeCriticos>) => {
      const ch = chaveDoPedido.current.get(ev.data.id);
      chaveDoPedido.current.delete(ev.data.id);
      if (ev.data.id !== ultimo.current || ch === undefined) return;
      setGuardado({ chave: ch, resultado: 'erro' in ev.data ? { estado: 'erro', erro: ev.data.erro } : { estado: 'pronto', criticos: ev.data.criticos } });
    };
    trabalhador.current = w;
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (DIRETO) return;
    // Espera a digitação assentar: 250 ms sem mudança antes de pedir.
    const espera = setTimeout(() => {
      ultimo.current += 1;
      chaveDoPedido.current.set(ultimo.current, chave);
      trabalhador.current?.postMessage({ id: ultimo.current, dimensoes } satisfies PedidoDeCriticos);
    }, 250);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return direto ?? criticosDaChave(guardado, chave);
}
