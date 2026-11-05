// ═══════════════════════════════════════════════════════════════════════════
//  motor/faixas/trabalhador.ts — as faixas finitas fora da linha da tela
// ---------------------------------------------------------------------------
//  Três curvas de assinatura de 100 pontos levam perto de um segundo. Rodando
//  na linha da tela, cada tecla num campo de dimensão congelaria a
//  calculadora. Aqui elas rodam num Web Worker; a tela recebe o resultado
//  quando ele chega e descarta o que já ficou velho (o `id`).
// ═══════════════════════════════════════════════════════════════════════════

import { montarSecao } from '../secao/familias';
import type { DimensoesDoPerfil } from '../secao/tipos';
import { criticosElasticos, type CriticosElasticos } from './criticos';

export interface PedidoDeCriticos {
  id: number;
  dimensoes: DimensoesDoPerfil;
}

export type RespostaDeCriticos = { id: number; criticos: CriticosElasticos } | { id: number; erro: string };

self.onmessage = (ev: MessageEvent<PedidoDeCriticos>) => {
  const { id, dimensoes } = ev.data;
  try {
    const criticos = criticosElasticos(montarSecao(dimensoes));
    (self as unknown as Worker).postMessage({ id, criticos } satisfies RespostaDeCriticos);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, erro: err instanceof Error ? err.message : String(err) } satisfies RespostaDeCriticos);
  }
};
