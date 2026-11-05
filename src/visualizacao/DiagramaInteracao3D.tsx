// ═══════════════════════════════════════════════════════════════════════════
//  visualizacao/DiagramaInteracao3D.tsx — a superfície N–Mx–My do 9.9 e o
//  ponto solicitante
// ---------------------------------------------------------------------------
//  O poliedro de oito planos (`norma/interacao.ts`): N na vertical (compressão
//  para cima), Mx e My no chão. Cada eixo em escala própria — a maior
//  resistência do eixo vale 1 —, então a assimetria de sinal (Nc × Nt; o My
//  do Ue) aparece na forma. O raio da origem ao ponto continua tracejado até
//  a superfície: o índice é o comprimento até o ponto ÷ o comprimento até a
//  superfície.
// ═══════════════════════════════════════════════════════════════════════════

import { Line } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { usarTema } from '../ui/tema';
import * as THREE from 'three';
import type { SuperficieDeInteracao } from '../motor/norma/interacao';
import { num } from '../relatorio/formatos';
import { cor, corHex, Orbita, Rotulo } from './pecas3D';

const sub = (b: string, i: string) => (
  <>
    <i>{b}</i>
    <sub>{i}</sub>
  </>
);

function Cena({ s }: { s: SuperficieDeInteracao }) {
  const eN = Math.max(s.NcRd, s.NtRd);
  const eX = Math.max(s.MxRd.pos, s.MxRd.neg);
  const eY = Math.max(s.MyRd.pos, s.MyRd.neg);
  // cena: X = Mx, Y = N, Z = My (cada um ÷ a maior resistência do eixo)
  const v = {
    nc: new THREE.Vector3(0, s.NcRd / eN, 0),
    nt: new THREE.Vector3(0, -s.NtRd / eN, 0),
    xp: new THREE.Vector3(s.MxRd.pos / eX, 0, 0),
    xn: new THREE.Vector3(-s.MxRd.neg / eX, 0, 0),
    yp: new THREE.Vector3(0, 0, s.MyRd.pos / eY),
    yn: new THREE.Vector3(0, 0, -s.MyRd.neg / eY),
  };
  const geometria = useMemo(() => {
    const pos: number[] = [];
    for (const n of [v.nc, v.nt]) for (const x of [v.xp, v.xn]) for (const y of [v.yp, v.yn]) pos.push(...n.toArray(), ...x.toArray(), ...y.toArray());
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps
  const arestas = useMemo(() => new THREE.EdgesGeometry(geometria), [geometria]);
  const cores = useMemo(
    () => ({ face: cor('--accent-3', '#3d8bfd'), aresta: cor('--ink-2', '#9aa0ad'), eixo: corHex('--muted-2', '#818595'), ok: corHex('--ok', '#3fb950'), erro: corHex('--err', '#f85149') }),
    [],
  );
  const P = new THREE.Vector3(s.ponto.Mx / eX, s.ponto.N / eN, s.ponto.My / eY);
  const naSuperficie = s.indice > 0 ? P.clone().divideScalar(s.indice) : null;
  const corDoPonto = s.indice <= 1 ? cores.ok : cores.erro;
  const eixo = (a: THREE.Vector3, b: THREE.Vector3) => <Line points={[a, b]} color={cores.eixo} lineWidth={1} />;
  return (
    <group>
      <mesh geometry={geometria}>
        <meshStandardMaterial color={cores.face} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={arestas}>
        <lineBasicMaterial color={cores.aresta} />
      </lineSegments>
      {eixo(new THREE.Vector3(0, -1.25, 0), new THREE.Vector3(0, 1.25, 0))}
      {eixo(new THREE.Vector3(-1.25, 0, 0), new THREE.Vector3(1.25, 0, 0))}
      {eixo(new THREE.Vector3(0, 0, -1.25), new THREE.Vector3(0, 0, 1.25))}
      <Rotulo posicao={v.nc.clone().add(new THREE.Vector3(0, 0.12, 0))}>{sub('N', 'c,Rd')} {num(s.NcRd, 1)}</Rotulo>
      <Rotulo posicao={v.nt.clone().add(new THREE.Vector3(0, -0.12, 0))}>{sub('N', 't,Rd')} {num(s.NtRd, 1)}</Rotulo>
      <Rotulo posicao={v.xp.clone().add(new THREE.Vector3(0.16, 0, 0))}>+{sub('M', 'x,Rd')} {num(s.MxRd.pos, 0)}</Rotulo>
      <Rotulo posicao={v.xn.clone().add(new THREE.Vector3(-0.16, 0, 0))}>−{sub('M', 'x,Rd')} {num(s.MxRd.neg, 0)}</Rotulo>
      <Rotulo posicao={v.yp.clone().add(new THREE.Vector3(0, 0, 0.16))}>+{sub('M', 'y,Rd')} {num(s.MyRd.pos, 0)}</Rotulo>
      <Rotulo posicao={v.yn.clone().add(new THREE.Vector3(0, 0, -0.16))}>−{sub('M', 'y,Rd')} {num(s.MyRd.neg, 0)}</Rotulo>
      {s.indice > 0 && (
        <>
          <Line points={[new THREE.Vector3(), P]} color={corDoPonto} lineWidth={2} />
          {naSuperficie && s.indice < 1 && <Line points={[P, naSuperficie]} color={corDoPonto} lineWidth={1} dashed dashSize={0.04} gapSize={0.03} />}
          <mesh position={P}>
            <sphereGeometry args={[0.035, 16, 12]} />
            <meshBasicMaterial color={corDoPonto} />
          </mesh>
          <Rotulo posicao={P.clone().add(new THREE.Vector3(0.1, 0.1, 0))} classe="rotulo-indice">
            {num(s.indice, 3)}
          </Rotulo>
        </>
      )}
    </group>
  );
}

export function DiagramaInteracao3D({ superficie }: { superficie: SuperficieDeInteracao }) {
  const tema = usarTema();
  return (
    <div className="interacao-3d">
      <Canvas key={tema} camera={{ position: [2.4, 1.6, 2.6], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <hemisphereLight args={['#ffffff', '#30303a', 0.9]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 4]} intensity={0.9} />
        <Cena s={superficie} />
        <Orbita minDistance={1.5} maxDistance={8} limite={1.2} />
      </Canvas>
    </div>
  );
}

export default DiagramaInteracao3D;
