// ═══════════════════════════════════════════════════════════════════════════
//  ui/PainelConfiguracao.tsx — a engrenagem do canto: tema e projetista
// ---------------------------------------------------------------------------
//  Painel pequeno, rótulo + valor + controle, igual na calculadora 8800 (pedido
//  dele, 04/11/2026). Fecha com Esc ou com um clique fora.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { janelaDoEndereco } from './guardarEntrada';
import type { Projetista } from './projetista';
import { definirTema, TEMAS, usarTema, type Tema } from './tema';

const NOME_DO_TEMA: Record<Tema, string> = { dark: 'Escuro', modern: 'Claro', paper: 'Papel' };

export function PainelConfiguracao({ projetista, mudarProjetista }: { projetista: Projetista; mudarProjetista: (p: Projetista) => void }) {
  // `&janela=configuracao`: aberto de saída, para o print sem janela
  const [aberto, setAberto] = useState(() => janelaDoEndereco() === 'configuracao');
  const tema = usarTema();
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (ev: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(ev.target as Node)) setAberto(false);
    };
    const tecla = (ev: KeyboardEvent) => ev.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);
  const campo = (k: keyof Projetista, rotulo: string) => (
    <div className="cad-linha">
      <label htmlFor={`proj-${k}`}>{rotulo}</label>
      <input id={`proj-${k}`} className="campo texto" value={projetista[k]} onChange={(ev) => mudarProjetista({ ...projetista, [k]: ev.target.value })} />
    </div>
  );
  return (
    <div className="configuracao" ref={caixa}>
      <button type="button" className={`botao-config${aberto ? ' ativo' : ''}`} aria-label="Configuração" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        {/* a engrenagem do A-PORT (src/icones.tsx), a mesma da 8800 */}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.6 1.6 0 00.32 1.77l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.6 1.6 0 00-1.77-.32 1.6 1.6 0 00-.97 1.47V21a2 2 0 11-4 0v-.1A1.6 1.6 0 009.1 19.4a1.6 1.6 0 00-1.77.32l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.6 1.6 0 004.82 15a1.6 1.6 0 00-1.47-.97H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 9.1a1.6 1.6 0 00-.32-1.77l-.06-.06a2 2 0 112.83-2.83l.06.06A1.6 1.6 0 009 4.82h.08A1.6 1.6 0 0010 3.35V3a2 2 0 114 0v.1a1.6 1.6 0 00.97 1.47 1.6 1.6 0 001.77-.32l.06-.06a2 2 0 112.83 2.83l-.06.06A1.6 1.6 0 0019.18 9v.08a1.6 1.6 0 001.47.97H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5.95z" />
        </svg>
      </button>
      {aberto && (
        <div className="painel-config" role="dialog" aria-label="Configuração">
          <fieldset className="cad-bloco">
            <legend>Tema</legend>
            <div className="segmentado temas">
              {TEMAS.map((t) => (
                <button key={t} type="button" className={t === tema ? 'ativo' : ''} onClick={() => definirTema(t)}>
                  {NOME_DO_TEMA[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="cad-bloco">
            <legend>Projetista</legend>
            {campo('nome', 'Nome')}
            {campo('titulo', 'Título')}
            {campo('crea', 'CREA')}
          </fieldset>
        </div>
      )}
    </div>
  );
}
