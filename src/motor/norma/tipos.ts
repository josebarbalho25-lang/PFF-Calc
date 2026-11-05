// ═══════════════════════════════════════════════════════════════════════════
//  motor/norma/tipos.ts — o que o motor da NBR 14762 recebe
// ---------------------------------------------------------------------------
//  O motor é conta pura: não importa nada de tela. É isso que deixa ele entrar
//  no A-PORT depois — o A-PORT passa o perfil, o aço, os esforços de uma seção
//  e os comprimentos da barra, recebe o resultado e a memória.
//
//  ⚠️ OS CRÍTICOS ELÁSTICOS ENTRAM PRONTOS. As faixas finitas levam perto de
//  um segundo e rodam em segundo plano (`faixas/trabalhador.ts`); o motor da
//  norma não as dispara — recebe o resultado (`CriticosElasticos`) e escolhe
//  o que cada verificação pede.
// ═══════════════════════════════════════════════════════════════════════════

import type { CriticosElasticos } from '../faixas/criticos';
import type { DimensoesDoPerfil } from '../secao/tipos';

/** O aço como a tela escolheu: da Tabela 1 ou digitado. Tensões em kN/cm². */
export interface AcoDaVerificacao {
  nome: string;
  fy: number;
  fu: number;
}

/**
 * Os esforços solicitantes de cálculo numa seção, nos eixos x e y do desenho
 * (x perpendicular à alma no U, Ue e Z).
 *
 * ⚠️ N POSITIVO COMPRIME — a convenção do A-PORT. Mx POSITIVO COMPRIME EM
 * CIMA (y > 0), isto é, traciona embaixo; My positivo comprime o lado x > 0.
 * No perfil simétrico o sinal do momento não muda nada; no monossimétrico
 * (cartola em Mx, U e Ue em My) muda — a mesa ou a ponta comprimida é outra.
 */
export interface Esforcos {
  /** Força normal, kN (+ comprime). */
  N: number;
  /** Momento em torno de x, kN·cm (+ comprime y > 0). */
  Mx: number;
  /** Momento em torno de y, kN·cm (+ comprime x > 0). */
  My: number;
  /** Cortante na direção x, kN. */
  Vx: number;
  /** Cortante na direção y, kN. */
  Vy: number;
}

/**
 * Comprimentos da barra, cm. Lx, Ly e Lz já são os de flambagem (K·L), como
 * na calculadora 8800. Zero = travada continuamente naquela direção.
 */
/** Anexo F: barra com painel (telha) conectado à mesa tracionada. */
export interface AnexoF {
  mesaComTelha: 'superior' | 'inferior';
  barra: 'biapoiada' | 'continua';
  /** Relação entre vãos adjacentes (só na contínua; acima de 1,2 vale a biapoiada). */
  relacaoVaos: number;
  /** Vão, cm. */
  vao: number;
  /** As condições de F.1 declaradas pelo engenheiro, e o F.4. */
  declaradas: { f: boolean; h: boolean; i: boolean; j: boolean; k: boolean; l: boolean; F4: boolean };
}

export interface Comprimentos {
  /** Flambagem por flexão em torno de x. */
  Lx: number;
  /** Flambagem por flexão em torno de y. */
  Ly: number;
  /** Flambagem por torção (compressão) e destravado da FLT (flexão). */
  Lz: number;
  /** Cb da FLT em torno de x (9.8.2.2), ≥ 1. */
  Cb: number;
  /** Distância entre enrijecedores transversais da alma; zero = sem. */
  a: number;
}

/** O método do local (8.4). */
export type MetodoDoLocal = 'MLE' | 'MSE' | 'MRD';

export interface EntradaDaVerificacao {
  perfil: DimensoesDoPerfil;
  aco: AcoDaVerificacao;
  esforcos: Esforcos;
  comprimentos: Comprimentos;
  metodo: MetodoDoLocal;
  /** As faixas finitas da seção, já rodadas. */
  criticos: CriticosElasticos;
  /** Anexo F ligado (terça com telha na mesa tracionada). */
  anexoF?: AnexoF;
}
