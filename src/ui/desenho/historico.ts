// ═══════════════════════════════════════════════════════════════════════════
//  ui/desenho/historico.ts — desfazer e refazer (Ctrl+Z, Ctrl+Y)
// ---------------------------------------------------------------------------
//  Guarda fotografias inteiras do estado, não as operações. O desenho de uma
//  seção tem dezenas de nós: a fotografia custa nada, e não existe operação
//  "inversa" para errar.
//
//  ⚠️ O EDITOR É CONTROLADO (quem guarda o desenho é o pai). Se o pai trocar
//  o desenho por fora — escolher outro perfil, carregar um guardado —, o
//  desfazer volta à fotografia anterior do mesmo jeito: é o comportamento
//  certo, a troca de fora também se desfaz.
// ═══════════════════════════════════════════════════════════════════════════

export interface Historico<T> {
  passado: T[];
  futuro: T[];
}

/** Quantos passos o desfazer guarda. */
export const LIMITE = 200;

export function historicoVazio<T>(): Historico<T> {
  return { passado: [], futuro: [] };
}

/** Antes de mudar: guarda o estado de agora e esquece o refazer. */
export function registrar<T>(h: Historico<T>, antes: T, limite = LIMITE): Historico<T> {
  const passado = [...h.passado, antes];
  return { passado: passado.length > limite ? passado.slice(passado.length - limite) : passado, futuro: [] };
}

export function desfazer<T>(h: Historico<T>, atual: T): { historico: Historico<T>; estado: T } | null {
  if (!h.passado.length) return null;
  const estado = h.passado[h.passado.length - 1];
  return { historico: { passado: h.passado.slice(0, -1), futuro: [atual, ...h.futuro] }, estado };
}

export function refazer<T>(h: Historico<T>, atual: T): { historico: Historico<T>; estado: T } | null {
  if (!h.futuro.length) return null;
  const [estado, ...resto] = h.futuro;
  return { historico: { passado: [...h.passado, atual], futuro: resto }, estado };
}
