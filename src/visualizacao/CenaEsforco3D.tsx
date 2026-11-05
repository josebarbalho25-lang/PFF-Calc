// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/CenaEsforco3D.tsx — o esforço agindo no corte da barra, em 3D
// ---------------------------------------------------------------------------
//  Um pedaço do perfil escolhido, em balanço, com a face do corte na ponta e
//  os eixos X e Y desenhados nela (os mesmos do desenho 2D da seção):
//
//   · N      — a seta no eixo da barra: entrando na face comprime (positivo),
//              saindo traciona (negativo);
//   · Mx, Vy — o plano da alma (YZ) aceso; o momento é a seta curva girando
//              em volta do eixo X, a cortante a seta reta na direção Y;
//   · My, Vx — o plano das mesas (XZ) aceso; a seta curva gira em volta do
//              eixo Y, a cortante empurra na direção X.
//
//  Mx e Vy dividem o plano, como My e Vx: é o par "Major" e o par "Minor" do
//  SAP, e é onde a troca de eixo acontece na hora de passar os números.
//
//  ⚠️ A SETA ANDA COM A FACE: a ponta e os vértices saem da mesma conta
//  (`deformadaDoEsforco.ts`); a seta mora no grupo da ponta.
// ═══════════════════════════════════════════════════════════════════════════

import { Line } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { usarTema } from '../ui/tema';
import * as THREE from 'three';
import { COMPRIMENTO_DA_BARRA, deformada, type Esforco } from './deformadaDoEsforco';
import { cor, corHex, formaDoPerfil, type PerfilDaCena, Orbita, Rotulo } from './pecas3D';

const L = COMPRIMENTO_DA_BARRA;
const ALTURA = 0.7;
const ARCO = 1.5 * Math.PI;

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const sub = (b: string, i: string) => (
  <>
    <i>{b}</i>
    <sub>{i}</sub>
  </>
);

/** Seta reta de `de` até `ate` (a ponta em `ate`). */
function Seta({ de, ate, cor: c }: { de: THREE.Vector3; ate: THREE.Vector3; cor: THREE.Color }) {
  const dir = ate.clone().sub(de);
  const cabeca = 0.17;
  const haste = Math.max(dir.length() - cabeca, 0.01);
  const u = dir.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), u);
  return (
    <group>
      <mesh position={de.clone().addScaledVector(u, haste / 2)} quaternion={q}>
        <cylinderGeometry args={[0.022, 0.022, haste, 12]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={ate.clone().addScaledVector(u, -cabeca / 2)} quaternion={q}>
        <coneGeometry args={[0.065, cabeca, 16]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

/** A seta curva do momento: três quartos de volta em torno do eixo local z. */
function SetaCurva({ raio, cor: c }: { raio: number; cor: THREE.Color }) {
  const fim = v3(raio * Math.cos(ARCO), raio * Math.sin(ARCO), 0);
  const tangente = v3(-Math.sin(ARCO), Math.cos(ARCO), 0);
  return (
    <group>
      <mesh>
        <torusGeometry args={[raio, 0.022, 10, 56, ARCO]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={fim.clone().addScaledVector(tangente, 0.06)} rotation={[0, 0, ARCO]}>
        <coneGeometry args={[0.065, 0.17, 16]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

/** O plano de flexão aceso: o da alma (YZ) ou o das mesas (XZ). */
function Plano({ qual, B, D }: { qual: 'yz' | 'xz'; B: number; D: number }) {
  const azul = useMemo(() => cor('--accent-3', '#3d8bfd'), []);
  const comprimento = L + 1.1;
  const meia = qual === 'yz' ? D + 0.6 : B + 0.75;
  const z0 = -0.02;
  const z1 = z0 + comprimento;
  const contorno =
    qual === 'yz'
      ? [v3(0, -meia, z0), v3(0, meia, z0), v3(0, meia, z1), v3(0, -meia, z1), v3(0, -meia, z0)]
      : [v3(-meia, 0, z0), v3(meia, 0, z0), v3(meia, 0, z1), v3(-meia, 0, z1), v3(-meia, 0, z0)];
  return (
    <group>
      <mesh position={[0, 0, z0 + comprimento / 2]} rotation={qual === 'yz' ? [0, Math.PI / 2, 0] : [Math.PI / 2, 0, 0]}>
        <planeGeometry args={[qual === 'yz' ? comprimento : 2 * meia, qual === 'yz' ? 2 * meia : comprimento]} />
        <meshBasicMaterial color={azul} transparent opacity={0.11} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={contorno} color={`#${azul.getHexString()}`} lineWidth={1} transparent opacity={0.55} />
    </group>
  );
}

/** Os eixos X e Y desenhados na face do corte; o do esforço, aceso. */
function EixosDoCorte({ B, D, aceso }: { B: number; D: number; aceso: 'x' | 'y' | null }) {
  const azul = useMemo(() => corHex('--accent-3', '#3d8bfd'), []);
  const z = 0.006;
  const xa = B + 0.8;
  const traco = (eixo: 'x' | 'y') => (aceso === eixo ? { lineWidth: 2.6 } : { lineWidth: 1.1, dashed: true, dashSize: 0.09, gapSize: 0.05 });
  return (
    <group>
      <Line points={[v3(-xa, 0, z), v3(xa, 0, z)]} color={azul} {...traco('x')} />
      <Line points={[v3(0, -(D + 0.4), z), v3(0, D + 0.8, z)]} color={azul} {...traco('y')} />
      <Rotulo posicao={v3(xa + 0.14, 0, z)} classe="eixo">
        X
      </Rotulo>
      <Rotulo posicao={v3(-xa - 0.14, 0, z)} classe="eixo">
        X
      </Rotulo>
      <Rotulo posicao={v3(0, -(D + 0.55), z)} classe="eixo">
        Y
      </Rotulo>
    </group>
  );
}

interface Props {
  perfil: PerfilDaCena;
  esforco: Esforco;
  /** Só no N: a seta entrando (compressão) ou saindo (tração). */
  compressao: boolean;
}

function BarraComEsforco({ perfil, esforco, compressao }: Props) {
  const ponta = useRef<THREE.Group>(null);
  const giro = useRef<THREE.Group>(null);
  const pulso = useRef<THREE.Group>(null);

  const { geometria, original, arestas, materiais, B, D } = useMemo(() => {
    const { forma, d, bf } = formaDoPerfil(perfil.sec, perfil.pr, ALTURA);
    const g = new THREE.ExtrudeGeometry(forma, { depth: L, steps: 40, bevelEnabled: false, curveSegments: 5 });
    const aco = cor('--peca-viga', '#c8c8d3');
    // A face do corte (as tampas do extrudado, grupo 0) mais clara: é a
    // seção, como o preenchimento do desenho 2D.
    const face = aco.clone().lerp(new THREE.Color('#ffffff'), 0.35);
    return {
      geometria: g,
      original: Float32Array.from((g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array),
      arestas: new THREE.EdgesGeometry(g, 30),
      materiais: [
        new THREE.MeshStandardMaterial({ color: face, metalness: 0.2, roughness: 0.7, side: THREE.DoubleSide }),
        new THREE.MeshStandardMaterial({ color: aco, metalness: 0.35, roughness: 0.55, side: THREE.DoubleSide }),
      ],
      B: bf / 2,
      D: d / 2,
    };
  }, [perfil]);

  useEffect(
    () => () => {
      geometria.dispose();
      arestas.dispose();
      for (const m of materiais) m.dispose();
    },
    [geometria, arestas, materiais],
  );

  const amarelo = useMemo(() => cor('--carga-1', '#e5b84a'), []);
  const cinza = useMemo(() => cor('--muted-2', '#818595'), []);
  // As arestas ficam paradas: são o fantasma da barra antes do esforço — dá
  // para ver quanto a ponta andou.
  const linhaAresta = useMemo(() => cor('--muted-2', '#818595'), []);

  // A seta reta de cada força, tocando a face do corte por fora.
  const direcaoDoPulso = new THREE.Vector3();
  let seta: ReactNode = null;
  let rotulo: ReactNode = null;
  if (esforco === 'N') {
    const de = compressao ? v3(0, 0, 1.0) : v3(0, 0, 0.06);
    const ate = compressao ? v3(0, 0, 0.06) : v3(0, 0, 1.0);
    direcaoDoPulso.copy(ate).sub(de).normalize();
    seta = <Seta de={de} ate={ate} cor={amarelo} />;
    rotulo = (
      <Rotulo posicao={v3(0, 0.22, 0.75)} classe="esforco">
        {sub('N', 'Sd')}
      </Rotulo>
    );
  } else if (esforco === 'Vy') {
    direcaoDoPulso.set(0, -1, 0);
    seta = <Seta de={v3(0, D + 0.85, -0.02)} ate={v3(0, D + 0.04, -0.02)} cor={amarelo} />;
    rotulo = (
      <Rotulo posicao={v3(0.3, D + 0.7, 0)} classe="esforco">
        {sub('V', 'y,Sd')}
      </Rotulo>
    );
  } else if (esforco === 'Vx') {
    direcaoDoPulso.set(1, 0, 0);
    seta = <Seta de={v3(-(B + 0.85), 0, -0.02)} ate={v3(-(B + 0.04), 0, -0.02)} cor={amarelo} />;
    rotulo = (
      <Rotulo posicao={v3(-(B + 0.6), 0.24, 0)} classe="esforco">
        {sub('V', 'x,Sd')}
      </Rotulo>
    );
  }

  // A seta curva fica no próprio eixo, além da chapa: em volta do X, na
  // frente da ponta da mesa (do lado da câmera); em volta do Y, acima da mesa
  // de cima. Assim a barra não a esconde.
  const raio = 0.3;
  const momento =
    esforco === 'Mx' ? (
      <>
        <group position={[-(B + 0.45), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <group ref={giro}>
            <SetaCurva raio={raio} cor={amarelo} />
          </group>
        </group>
        <Rotulo posicao={v3(-(B + 0.45), raio + 0.2, 0)} classe="esforco">
          {sub('M', 'x,Sd')}
        </Rotulo>
      </>
    ) : esforco === 'My' ? (
      <>
        {/* −90° em x: o eixo do arco vira +y, e o giro dele casa com o da face. */}
        <group position={[0, D + 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <group ref={giro}>
            <SetaCurva raio={raio} cor={amarelo} />
          </group>
        </group>
        <Rotulo posicao={v3(raio + 0.3, D + 0.5, 0)} classe="esforco">
          {sub('M', 'y,Sd')}
        </Rotulo>
      </>
    ) : null;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = (1 - Math.cos(t * 1.4)) / 2;
    const def = deformada(esforco, compressao, a);
    const pos = geometria.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = def.ponto(original[i * 3]!, original[i * 3 + 1]!, original[i * 3 + 2]!);
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    pos.needsUpdate = true;
    geometria.computeVertexNormals();
    ponta.current?.position.set(...def.ponta.pos);
    ponta.current?.rotation.set(...def.ponta.rot);
    // O momento gira em volta do eixo; a força empurra, vai e volta.
    if (giro.current) giro.current.rotation.z = t * 1.8;
    if (pulso.current) pulso.current.position.setScalar(0).addScaledVector(direcaoDoPulso, 0.06 * Math.sin(t * 3.2));
  });

  const aceso = esforco === 'Mx' || esforco === 'Vx' ? 'x' : esforco === 'My' || esforco === 'Vy' ? 'y' : null;
  const plano = esforco === 'Mx' || esforco === 'Vy' ? 'yz' : esforco === 'My' || esforco === 'Vx' ? 'xz' : null;

  return (
    <group>
      <mesh geometry={geometria} material={materiais} />
      <lineSegments geometry={arestas}>
        <lineBasicMaterial color={linhaAresta} transparent opacity={0.4} />
      </lineSegments>
      {/* O engaste do balanço. */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[2 * B + 1.1, 2 * D + 1.1, 0.1]} />
        <meshStandardMaterial color={cinza} transparent opacity={0.6} />
      </mesh>
      {plano && <Plano qual={plano} B={B} D={D} />}
      {esforco === 'N' && (
        <Line points={[v3(0, 0, -0.02), v3(0, 0, L + 1.2)]} color={corHex('--accent-3', '#3d8bfd')} lineWidth={1.4} dashed dashSize={0.12} gapSize={0.06} />
      )}
      <group ref={ponta}>
        <EixosDoCorte B={B} D={D} aceso={aceso} />
        <group ref={pulso}>{seta}</group>
        {rotulo}
        {momento}
      </group>
    </group>
  );
}

export function CenaEsforco3D(props: Props) {
  const tema = usarTema();
  return (
    <Canvas key={tema} camera={{ position: [5.3, 2.5, 3.3], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <hemisphereLight args={['#ffffff', '#30303a', 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 10, 7]} intensity={1.4} />
      <directionalLight position={[-6, 4, -5]} intensity={0.45} />
      {/* A barra deita no eixo z dela; aqui ela fica em x, da esquerda (o
          engaste) para a direita (o corte). As mesas vão para o z do mundo. */}
      <group rotation={[0, Math.PI / 2, 0]} position={[-L / 2, 0, 0]}>
        <BarraComEsforco {...props} />
      </group>
      <Orbita alvo={[0.7, 0, 0]} minDistance={3} maxDistance={14} limite={4} />
    </Canvas>
  );
}
