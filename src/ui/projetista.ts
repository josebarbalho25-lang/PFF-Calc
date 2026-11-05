// ═══════════════════════════════════════════════════════════════════════════
//  ui/projetista.ts — quem assina: nome, título e CREA, na configuração
// ---------------------------------------------------------------------------
//  Um lugar só (pedido dele, 04/11/2026): o projetista mora na configuração,
//  guardado no navegador, e a memória o recebe no carimbo e no bloco de
//  assinatura. O carimbo da memória não tem mais campo de responsável.
//
//  ⚠️ A MIGRAÇÃO: antes, o responsável e o registro moravam no carimbo
//  (`calculadora-nbr14762:identificacao`). Na primeira leitura sem projetista
//  guardado, eles vêm de lá — quem já tinha preenchido não redigita.
// ═══════════════════════════════════════════════════════════════════════════

export interface Projetista {
  nome: string;
  /** "Engenheiro Civil", "Engenheira Civil"… */
  titulo: string;
  crea: string;
}

export const PROJETISTA_VAZIO: Projetista = { nome: '', titulo: '', crea: '' };

const CHAVE = 'calculadora-nbr14762:projetista';
const CHAVE_ANTIGA = 'calculadora-nbr14762:identificacao';

const texto = (v: unknown) => (typeof v === 'string' ? v : '');

export function lerProjetista(): Projetista {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Record<string, unknown> | null;
    if (guardado) return { nome: texto(guardado.nome), titulo: texto(guardado.titulo), crea: texto(guardado.crea) };
    const antigo = JSON.parse(localStorage.getItem(CHAVE_ANTIGA) ?? 'null') as Record<string, unknown> | null;
    return { nome: texto(antigo?.responsavel), titulo: '', crea: texto(antigo?.registro) };
  } catch {
    return { ...PROJETISTA_VAZIO };
  }
}

/**
 * O projetista pelo endereço (`&projetista={"nome":…}`), só para os prints
 * sem janela, como na 8800: preenche a tela e não grava por cima do dele.
 */
export function projetistaDoEndereco(): Projetista | null {
  const achado = typeof location === 'undefined' ? null : /[#&]projetista=([^&]+)/.exec(location.hash);
  if (!achado) return null;
  try {
    const p = JSON.parse(decodeURIComponent(achado[1]!)) as Record<string, unknown>;
    return { nome: texto(p.nome), titulo: texto(p.titulo), crea: texto(p.crea) };
  } catch {
    return null;
  }
}

export function guardarProjetista(p: Projetista): void {
  if (projetistaDoEndereco()) return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // Navegador sem armazenamento: só não lembra.
  }
}
