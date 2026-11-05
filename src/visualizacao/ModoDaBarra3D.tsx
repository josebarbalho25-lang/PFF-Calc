// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/ModoDaBarra3D.tsx — a barra deformada pelo modo do ponto
//  escolhido na curva, em faixas coloridas pelo deslocamento (mapa jet)
// ---------------------------------------------------------------------------
//  A malha vem de `barraDoModo.ts` (o modo das NOSSAS faixas). A amplitude
//  oscila como no desenho 2D; quem pede menos movimento vê o pico parado. A
//  seção indeformada marca o começo e o fim de cada meia-onda.
//
//  A barra fica deitada no eixo X da cena: (x, y, z) da seção → (z, y, −x),
//  uma rotação (não espelha o perfil).
// ═══════════════════════════════════════════════════════════════════════════

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { usarTema } from '../ui/tema';
import * as THREE from 'three';
import type { Malha } from '../motor/faixas/malha';
import { num } from '../relatorio/formatos';
import { barraDoModo, jet } from './barraDoModo';
import { cor, Orbita, Rotulo } from './pecas3D';

interface Props {
  malha: Malha;
  deslocamentos: Float64Array;
  L: number;
}

const quieto = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Barra({ malha, deslocamentos, L }: Props) {
  const b = useMemo(() => barraDoModo(malha, deslocamentos, L), [malha, deslocamentos, L]);
  const k = 1 / b.tamanho; // a seção com tamanho 1 na cena
  const { geometria, aneis } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.base.length), 3));
    const cores = new Float32Array(b.base.length);
    b.intensidade.forEach((v, i) => cores.set(jet(v), 3 * i));
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    g.setIndex(new THREE.BufferAttribute(b.indices, 1));
    const a = new THREE.BufferGeometry();
    const pa = new Float32Array(b.aneis.length);
    for (let i = 0; i < b.aneis.length; i += 3) pa.set([b.aneis[i + 2] * k, b.aneis[i + 1] * k, -b.aneis[i] * k], i);
    a.setAttribute('position', new THREE.BufferAttribute(pa, 3));
    return { geometria: g, aneis: a };
  }, [b, k]);
  useEffect(
    () => () => {
      geometria.dispose();
      aneis.dispose();
    },
    [geometria, aneis],
  );

  const parado = useRef(quieto());
  const posicionar = (fator: number) => {
    const pos = geometria.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const A = b.escala * fator;
    for (let i = 0; i < b.base.length; i += 3) {
      arr[i] = (b.base[i + 2] + A * b.delta[i + 2]) * k;
      arr[i + 1] = (b.base[i + 1] + A * b.delta[i + 1]) * k;
      arr[i + 2] = -(b.base[i] + A * b.delta[i]) * k;
    }
    pos.needsUpdate = true;
    geometria.computeVertexNormals();
  };
  useMemo(() => posicionar(1), [geometria]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => {
    if (parado.current) return;
    posicionar(Math.sin(clock.elapsedTime * 4.5));
  });

  const linha = useMemo(() => cor('--ink-2', '#9aa0ad'), []);
  const comp = b.comprimento * k;
  // A câmera recua com a barra: o modo global tem meia-onda de dezenas de vezes a seção.
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const f = Math.max(1, comp / 2.2);
    camera.position.set(1.6 * f, 1.3 * f, 2.6 * f);
    camera.lookAt(0, 0, 0);
  }, [camera, comp]);
  return (
    <group position={[-comp / 2, 0, 0]}>
      <mesh geometry={geometria}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.75} metalness={0.05} />
      </mesh>
      <lineSegments geometry={aneis}>
        <lineBasicMaterial color={linha} />
      </lineSegments>
      <Rotulo posicao={new THREE.Vector3(comp / 2, -0.85, 0)} classe="rotulo-modo">
        {`L = ${num(L, 1)} cm${b.meiasOndas > 1 ? ` · ${b.meiasOndas} meias-ondas` : ''}`}
      </Rotulo>
    </group>
  );
}

export function ModoDaBarra3D(p: Props) {
  const tema = usarTema();
  return (
    <div className="modo-barra-3d">
      <Canvas key={tema} camera={{ position: [1.6, 1.3, 2.6], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <hemisphereLight args={['#ffffff', '#30303a', 0.9]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 6, 5]} intensity={1.1} />
        <Barra {...p} />
        <Orbita minDistance={0.5} maxDistance={200} limite={60} />
      </Canvas>
      <div className="legenda-jet" aria-hidden="true">
        <span>1</span>
        <div className="legenda-jet-barra" />
        <span>0</span>
      </div>
    </div>
  );
}
