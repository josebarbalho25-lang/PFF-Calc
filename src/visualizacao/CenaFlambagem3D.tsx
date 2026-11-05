// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/CenaFlambagem3D.tsx — a barra flambando, em 3D
// ---------------------------------------------------------------------------
//  Três modos com a mesma barra (o perfil escolhido, nas proporções dele):
//
//   · 'x'   — pilar, flambagem por flexão em torno de X: a barra sai no
//             sentido da ALMA (o plano de maior inércia);
//   · 'y'   — pilar, flambagem em torno de Y: sai de lado, no sentido das
//             MESAS — o modo fraco;
//   · 'flt' — viga, flambagem lateral com torção: a mesa comprimida (a de
//             cima) foge de lado e a seção gira; a de baixo quase não sai.
//
//  `ondas` é o número de meias-ondas entre os apoios: 1 sem contenção no
//  meio, 2 com contenção no meio (o comprimento destravado cai à metade), 0
//  travada continuamente (laje sobre a mesa — não flamba).
//
//  ⚠️ A DEFORMAÇÃO É REFEITA A CADA QUADRO NOS VÉRTICES, a partir de uma cópia
//  da posição original: compor sobre a posição do quadro anterior faria a
//  barra andar sozinha (a mesma armadilha da alça que mede do estado corrente).
//
//  ⚠️ A ESCALA DO DESENHO É DIDÁTICA: a seção tem a proporção real do perfil,
//  mas o comprimento e a amplitude são exagerados para se ver o modo.
// ═══════════════════════════════════════════════════════════════════════════

import { Line } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { usarTema } from '../ui/tema';
import * as THREE from 'three';
import { cor, formaDoPerfil, type PerfilDaCena, Orbita, Rotulo } from './pecas3D';

export type ModoDeFlambagem = 'x' | 'y' | 'flt';

const COMPRIMENTO = 6;
const ALTURA_DA_SECAO = 0.55;

interface PropsBarra {
  perfil: PerfilDaCena;
  modo: ModoDeFlambagem;
  ondas: 0 | 1 | 2;
}

function BarraQueFlamba({ perfil, modo, ondas }: PropsBarra) {
  const malha = useRef<THREE.Mesh>(null);
  const { geometria, original, fantasma, d } = useMemo(() => {
    const { forma, d, tf } = formaDoPerfil(perfil.sec, perfil.pr, ALTURA_DA_SECAO);
    const g = new THREE.ExtrudeGeometry(forma, { depth: COMPRIMENTO, steps: 64, bevelEnabled: false, curveSegments: 5 });
    // Na viga, a mesa de cima (a comprimida) ganha a cor de ênfase.
    // A cor de peça do palco do A-PORT: o --peca-aco (cor de material) some no
    // fundo escuro quando a face fica de lado para a luz.
    const aco = cor('--peca-viga', '#c8c8d3');
    const enfase = cor('--accent-3', '#3d8bfd');
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const cores = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const c = modo === 'flt' && pos.getY(i) > d / 2 - tf - 1e-6 ? enfase : aco;
      cores.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    return {
      geometria: g,
      original: Float32Array.from(pos.array as Float32Array),
      fantasma: new THREE.EdgesGeometry(g, 30),
      d,
    };
  }, [perfil, modo]);

  useEffect(() => () => {
    geometria.dispose();
    fantasma.dispose();
  }, [geometria, fantasma]);

  useFrame(({ clock }) => {
    const pos = geometria.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    // Cresce de zero ao máximo e volta: a barra "flambando" e voltando.
    const amp = ondas === 0 ? 0 : (1 - Math.cos(clock.elapsedTime * 1.4)) / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = original[i * 3]!;
      const y = original[i * 3 + 1]!;
      const z = original[i * 3 + 2]!;
      const s = Math.sin((Math.PI * Math.max(ondas, 1) * z) / COMPRIMENTO) * amp;
      let nx = x;
      let ny = y;
      if (modo === 'x') ny = y + 0.42 * s;
      else if (modo === 'y') nx = x + 0.42 * s;
      else {
        // FLT: a seção gira em torno do eixo e anda de lado. O giro é tal que
        // a mesa de cima sai quase o dobro do eixo e a de baixo quase não sai.
        const phi = (-0.3 * s) / (d / 2);
        nx = x * Math.cos(phi) - y * Math.sin(phi) + 0.34 * s;
        ny = x * Math.sin(phi) + y * Math.cos(phi);
      }
      arr[i * 3] = nx;
      arr[i * 3 + 1] = ny;
    }
    pos.needsUpdate = true;
    geometria.computeVertexNormals();
  });

  const linhaFantasma = useMemo(() => cor('--line-strong', '#3a3a45'), []);
  return (
    <group>
      <mesh ref={malha} geometry={geometria}>
        <meshStandardMaterial vertexColors metalness={0.35} roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={fantasma}>
        <lineBasicMaterial color={linhaFantasma} transparent opacity={0.55} />
      </lineSegments>
    </group>
  );
}

/** Cota com traço nas pontas e o rótulo no meio. */
function Cota({ de, ate, rotulo, deslocamento }: { de: THREE.Vector3; ate: THREE.Vector3; rotulo: string; deslocamento: THREE.Vector3 }) {
  const corCota = useMemo(() => `#${cor('--accent-3', '#3d8bfd').getHexString()}`, []);
  const a = de.clone().add(deslocamento);
  const b = ate.clone().add(deslocamento);
  const t = deslocamento.clone().normalize().multiplyScalar(0.12);
  const meio = a.clone().add(b).multiplyScalar(0.5).add(t.clone().multiplyScalar(2.2));
  return (
    <group>
      <Line points={[a, b]} color={corCota} lineWidth={1.4} />
      <Line points={[a.clone().sub(t), a.clone().add(t)]} color={corCota} lineWidth={1.4} />
      <Line points={[b.clone().sub(t), b.clone().add(t)]} color={corCota} lineWidth={1.4} />
      <Rotulo posicao={meio} texto={rotulo} classe="cota" />
    </group>
  );
}

function Escora({ de, ate }: { de: THREE.Vector3; ate: THREE.Vector3 }) {
  const amarelo = useMemo(() => cor('--carga-1', '#e5b84a'), []);
  const meio = de.clone().add(ate).multiplyScalar(0.5);
  const dir = ate.clone().sub(de);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <group>
      <mesh position={meio} quaternion={q}>
        <cylinderGeometry args={[0.025, 0.025, dir.length(), 10]} />
        <meshStandardMaterial color={amarelo} />
      </mesh>
      <mesh position={ate}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial color={amarelo} />
      </mesh>
    </group>
  );
}

function Apoio({ posicao }: { posicao: THREE.Vector3 }) {
  const cinza = useMemo(() => cor('--muted-2', '#818595'), []);
  return (
    <mesh position={posicao}>
      <boxGeometry args={[0.7, 0.05, 0.7]} />
      <meshStandardMaterial color={cinza} />
    </mesh>
  );
}

/** O pilar (modos 'x' e 'y'): de pé, apoiado nas pontas. */
function Pilar({ perfil, modo, ondas, rotulo }: PropsBarra & { rotulo: string }) {
  const L = COMPRIMENTO;
  // A barra deita no eixo z dela; aqui ela fica de pé (z → y do mundo). A
  // alma vira o sentido z do mundo, as mesas o x.
  const sentido = modo === 'x' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(1, 0, 0);
  const afastamento = new THREE.Vector3(modo === 'x' ? -0.9 : 0, 0, modo === 'x' ? 0 : 0.9);
  return (
    <group>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <BarraQueFlamba perfil={perfil} modo={modo} ondas={ondas} />
      </group>
      <Apoio posicao={new THREE.Vector3(0, -0.03, 0)} />
      <Apoio posicao={new THREE.Vector3(0, L + 0.03, 0)} />
      {ondas === 2 && <Escora de={new THREE.Vector3(0, L / 2, 0).addScaledVector(sentido, 0.3)} ate={new THREE.Vector3(0, L / 2, 0).addScaledVector(sentido, 1.4)} />}
      {ondas === 2 ? (
        <>
          <Cota de={new THREE.Vector3(0, 0, 0)} ate={new THREE.Vector3(0, L / 2, 0)} rotulo={`${rotulo} = L/2`} deslocamento={afastamento} />
          <Cota de={new THREE.Vector3(0, L / 2, 0)} ate={new THREE.Vector3(0, L, 0)} rotulo={`${rotulo} = L/2`} deslocamento={afastamento} />
        </>
      ) : (
        <Cota de={new THREE.Vector3(0, 0, 0)} ate={new THREE.Vector3(0, L, 0)} rotulo={`${rotulo} = L`} deslocamento={afastamento} />
      )}
    </group>
  );
}

/** A viga (modo 'flt'): deitada, carregada por cima. */
function Viga({ perfil, ondas }: { perfil: PerfilDaCena; ondas: 0 | 1 | 2 }) {
  const L = COMPRIMENTO;
  const d = ALTURA_DA_SECAO;
  const azul = useMemo(() => `#${cor('--carga-2', '#7c9cf5').getHexString()}`, []);
  const laje = useMemo(() => cor('--peca-viga', '#c8c8d3'), []);
  const setas = Array.from({ length: 9 }, (_, i) => (L * (i + 0.5)) / 9 - L / 2);
  return (
    <group position={[0, 1.2, 0]}>
      <group rotation={[0, Math.PI / 2, 0]} position={[-L / 2, 0, 0]}>
        <BarraQueFlamba perfil={perfil} modo="flt" ondas={ondas} />
      </group>
      {[-L / 2, L / 2].map((x) => (
        <mesh key={x} position={[x, -d / 2 - 0.15, 0]}>
          <coneGeometry args={[0.16, 0.26, 4]} />
          <meshStandardMaterial color={cor('--muted-2', '#818595')} />
        </mesh>
      ))}
      {/* Contenção lateral nas pontas (o garfo do apoio) e, com duas ondas, no meio. */}
      {[-L / 2, ...(ondas === 2 ? [0] : []), L / 2].map((x) => (
        <Escora key={x} de={new THREE.Vector3(x, d / 2, -0.12)} ate={new THREE.Vector3(x, d / 2, -1.1)} />
      ))}
      {ondas === 0 ? (
        <mesh position={[0, d / 2 + 0.07, 0]}>
          <boxGeometry args={[L, 0.12, 1.6]} />
          <meshStandardMaterial color={laje} transparent opacity={0.45} />
        </mesh>
      ) : (
        setas.map((x) => (
          <group key={x}>
            <Line points={[new THREE.Vector3(x, d / 2 + 0.75, 0), new THREE.Vector3(x, d / 2 + 0.18, 0)]} color={azul} lineWidth={1.5} />
            <mesh position={[x, d / 2 + 0.1, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.05, 0.14, 8]} />
              <meshBasicMaterial color={azul} />
            </mesh>
          </group>
        ))
      )}
      <Rotulo posicao={new THREE.Vector3(0.6, d / 2 + 0.95, 0)} texto={ondas === 0 ? 'laje' : 'mesa comprimida'} />
      {ondas === 2 ? (
        <>
          <Cota de={new THREE.Vector3(-L / 2, -d / 2, 0)} ate={new THREE.Vector3(0, -d / 2, 0)} rotulo="KzLz = L/2" deslocamento={new THREE.Vector3(0, -0.55, 0)} />
          <Cota de={new THREE.Vector3(0, -d / 2, 0)} ate={new THREE.Vector3(L / 2, -d / 2, 0)} rotulo="KzLz = L/2" deslocamento={new THREE.Vector3(0, -0.55, 0)} />
        </>
      ) : (
        <Cota de={new THREE.Vector3(-L / 2, -d / 2, 0)} ate={new THREE.Vector3(L / 2, -d / 2, 0)} rotulo={ondas === 0 ? 'KzLz = 0' : 'KzLz = L'} deslocamento={new THREE.Vector3(0, -0.55, 0)} />
      )}
    </group>
  );
}

export function CenaFlambagem3D({ perfil, modo, ondas, rotulo }: PropsBarra & { rotulo: string }) {
  const pilar = modo !== 'flt';
  const tema = usarTema();
  return (
    <Canvas
      key={tema}
      camera={pilar ? { position: [7.5, 6.2, 6.0], fov: 40 } : { position: [4.6, 3.6, 6.2], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <hemisphereLight args={['#ffffff', '#30303a', 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 10, 7]} intensity={1.4} />
      <directionalLight position={[-6, 4, -5]} intensity={0.45} />
      {pilar ? <Pilar perfil={perfil} modo={modo} ondas={ondas} rotulo={rotulo} /> : <Viga perfil={perfil} ondas={ondas} />}
      <Orbita alvo={pilar ? [0, COMPRIMENTO / 2, 0] : [0, 1.2, 0]} minDistance={4} maxDistance={18} limite={COMPRIMENTO / 2} />
    </Canvas>
  );
}
