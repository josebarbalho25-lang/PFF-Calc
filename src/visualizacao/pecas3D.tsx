// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/pecas3D.tsx — o que as cenas 3D das janelas têm em comum
// ---------------------------------------------------------------------------
//  A cor do tema lida na hora, o contorno do perfil na escala da cena e o rótulo
//  preso a um ponto. A cena da flambagem (comprimentos) e a dos esforços
//  desenham o MESMO perfil do mesmo jeito.
// ═══════════════════════════════════════════════════════════════════════════

import { Html, OrbitControls } from '@react-three/drei';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { OrbitControls as Controles } from 'three-stdlib';
import * as THREE from 'three';
import type { PropriedadesDaSecao } from '../motor/secao/propriedades';
import type { SecaoGeometrica } from '../motor/secao/tipos';
import { contornosDaChapa } from './geometriaDaSecao';

/** A cor de um token do tema, lida na hora (o WebGL não lê CSS). */
export function cor(token: string, reserva: string): THREE.Color {
  const v = getComputedStyle(document.body).getPropertyValue(token).trim();
  return new THREE.Color(v || reserva);
}

/** A mesma cor, como texto "#rrggbb" (o `Line` do drei pede assim). */
export function corHex(token: string, reserva: string): string {
  return `#${cor(token, reserva).getHexString()}`;
}

/** O perfil que as cenas desenham: a geometria e as propriedades. */
export interface PerfilDaCena {
  sec: SecaoGeometrica;
  pr: PropriedadesDaSecao;
}

/**
 * O contorno do perfil na escala da cena, centrado no centroide: o mesmo
 * contorno da chapa do desenho 2D (`contornosDaChapa`), qualquer família — um
 * Shape por pedaço de chapa na seção em grafo (o extrudado aceita a lista). A
 * alma fica em y e as mesas em x — X e Y da seção, como no desenho 2D.
 * `d` é a altura, `bf` a largura e `tf` a espessura, na escala da cena.
 */
export function formaDoPerfil(sec: SecaoGeometrica, pr: PropriedadesDaSecao, altura: number): { forma: THREE.Shape[]; d: number; bf: number; tf: number } {
  const k = altura / (pr.caixa.ymax - pr.caixa.ymin);
  const forma = contornosDaChapa(sec).map((pts) => new THREE.Shape(pts.map((p) => new THREE.Vector2((p.x - pr.G.x) * k, (p.y - pr.G.y) * k))));
  return { forma, d: altura, bf: (pr.caixa.xmax - pr.caixa.xmin) * k, tf: sec.t * k };
}

/** true a partir do quadro seguinte à montagem — ver `Rotulo`. */
function useDepoisDaMontagem(): boolean {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const quadro = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(quadro);
  }, []);
  return pronto;
}

/**
 * Rótulo preso a um ponto da cena: texto simples ou com índice (filhos).
 *
 * ⚠️ O `Html` DO DREI SÓ ENTRA DEPOIS DO PRIMEIRO QUADRO. Montado junto com o
 * Canvas, no modo estrito (o React monta, desmonta e remonta em
 * desenvolvimento), a raiz que o `Html` cria por dentro morria na desmontagem
 * ("synchronously unmount a root while React was already rendering") e só o
 * último rótulo da cena aparecia. Os que entravam depois — ao trocar de
 * contenção — apareciam sempre: daí esperar um quadro.
 */
export function Rotulo({ posicao, texto, classe = '', children }: { posicao: THREE.Vector3; texto?: string; classe?: string; children?: ReactNode }) {
  const pronto = useDepoisDaMontagem();
  if (!pronto) return null;
  return (
    // ⚠️ z-index de 0 a 10, ABAIXO do fundo do modal (60): no padrão do drei
    // (16 777 271) os rótulos da tela principal furavam a janela aberta por
    // cima (achado dele, 04/11/2026).
    <Html position={posicao} center zIndexRange={[10, 0]}>
      <span className={`rotulo-3d ${classe}`}>{children ?? texto}</span>
    </Html>
  );
}

/**
 * A órbita de todas as cenas, igual em todas (pedido dele, 04/11/2026):
 * esquerdo gira, direito arrasta (no plano da tela), roda aproxima. O alvo não
 * se afasta mais que `limite` do ponto de partida — a peça não some da vista.
 */
export function Orbita({ alvo = [0, 0, 0], minDistance, maxDistance, limite }: { alvo?: [number, number, number]; minDistance: number; maxDistance: number; limite: number }) {
  const ref = useRef<Controles>(null);
  const centro = new THREE.Vector3(...alvo);
  const prender = () => {
    const c = ref.current;
    if (!c) return;
    const d = c.target.clone().sub(centro);
    if (d.length() <= limite) return;
    const volta = d.clone().setLength(limite).add(centro).sub(c.target);
    c.target.add(volta);
    c.object.position.add(volta);
  };
  return <OrbitControls ref={ref} target={alvo} enablePan screenSpacePanning minDistance={minDistance} maxDistance={maxDistance} onChange={prender} />;
}
