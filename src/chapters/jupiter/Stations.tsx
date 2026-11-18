import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import type { StationKind } from './jupiter.ts';

/**
 * Three orbital installations, one per flagship project, each with a silhouette that echoes the
 * project's real architecture (src/content/projects.ts):
 *  - SmartWay Traffic: a road ring with detection cameras on its rim (YOLOv8 vision + SUMO traffic),
 *  - DocumentDB: a stacked archive spine with orbiting retrieval nodes (RAG over stored documents),
 *  - Stash: a framed vault cube with a glowing core (a saver / library of saved items).
 * Spin and light blink are ambient (clock time); they carry no story meaning.
 */
const HULL = { color: '#e6eaf0', metalness: 0.35, roughness: 0.45 } as const;
const DARK = { color: '#59606d', metalness: 0.5, roughness: 0.5 } as const;
const PANEL = {
  color: '#2f63b8',
  metalness: 0.2,
  roughness: 0.35,
  emissive: '#10306a',
  emissiveIntensity: 0.6,
} as const;

function useGlowMaterial(color: string) {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(2.2),
        toneMapped: false,
      }),
    [color],
  );
  useDisposeOnUnmount(mat);
  return mat;
}

const RIM = [0, 1, 2, 3, 4, 5].map((i) => (i / 6) * Math.PI * 2);

function Traffic() {
  const amber = useGlowMaterial('#ffb347');
  const red = useGlowMaterial('#ff3b30');
  const blink = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (blink.current) blink.current.visible = Math.floor(clock.elapsedTime * 1.6) % 2 === 0;
  });
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[4.2, 0.32, 12, 64]} />
        <meshStandardMaterial {...HULL} />
      </mesh>
      {/* lane marking on the road ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <torusGeometry args={[4.2, 0.05, 6, 64]} />
        <meshBasicMaterial color="#e9e4c8" />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.1, 24, 16]} />
        <meshStandardMaterial {...HULL} />
      </mesh>
      {/* spokes + detection cameras on the rim */}
      {RIM.map((a) => (
        <group key={a} rotation={[Math.PI / 2, 0, a]}>
          <mesh position={[2.6, 0, 0]}>
            <boxGeometry args={[3.2, 0.1, 0.1]} />
            <meshStandardMaterial {...DARK} />
          </mesh>
          <mesh position={[4.2, 0.55, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.38, 0.8, 14]} />
            <meshStandardMaterial {...HULL} />
          </mesh>
        </group>
      ))}
      <group ref={blink}>
        <mesh position={[0, 1.3, 0]} material={red}>
          <sphereGeometry args={[0.14, 8, 8]} />
        </mesh>
        <mesh position={[4.5, 0, 0]} material={amber}>
          <sphereGeometry args={[0.12, 8, 8]} />
        </mesh>
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * 1.6, 0]}>
          <boxGeometry args={[1.6, 0.04, 1.6]} />
          <meshStandardMaterial {...PANEL} />
        </mesh>
      ))}
    </group>
  );
}

const PLATES = [-2.4, -1.2, 0, 1.2, 2.4];
const NODES = [0, 1, 2, 3, 4, 5, 6].map((i) => (i / 7) * Math.PI * 2);

function Documents() {
  const orbit = useRef<THREE.Group>(null);
  const cyan = useGlowMaterial('#4fd8ff');
  useFrame((_, delta) => {
    if (orbit.current) orbit.current.rotation.y += delta * 0.5;
  });
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.28, 0.28, 6.4, 12]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      {PLATES.map((y, i) => {
        const r = 2.2 - Math.abs(y) * 0.12;
        return (
          <group key={y} position={[0, y, 0]} rotation={[0, i * 0.35, 0]}>
            <mesh>
              <cylinderGeometry args={[r, r, 0.34, 6]} />
              <meshStandardMaterial {...HULL} />
            </mesh>
            <mesh position={[0, 0.19, 0]}>
              <cylinderGeometry args={[1.5, 1.5, 0.04, 6]} />
              <meshStandardMaterial {...PANEL} />
            </mesh>
          </group>
        );
      })}
      {/* retrieval nodes orbiting the spine at different heights */}
      <group ref={orbit}>
        {NODES.map((a, i) => (
          <mesh
            key={a}
            material={cyan}
            position={[Math.cos(a) * 3.1, ((i % 4) - 1.5) * 1.5, Math.sin(a) * 3.1]}
          >
            <octahedronGeometry args={[0.2, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const FLAGS = [-1.2, 0, 1.2];
const CORNERS = [-1, 1].flatMap((x) =>
  [-1, 1].flatMap((y) => [-1, 1].map((z) => [x * 2.1, y * 2.1, z * 2.1] as const)),
);

function Vault() {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(4.2, 4.2, 4.2)), []);
  useDisposeOnUnmount(edges);
  const core = useRef<THREE.Mesh>(null);
  const gold = useGlowMaterial('#ffc65a');
  useFrame(({ clock }) => {
    if (core.current) core.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.4) * 0.08);
  });
  return (
    <group>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#cfd5df" />
      </lineSegments>
      {CORNERS.map((p) => (
        <mesh key={p.join(',')} position={[...p]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial {...HULL} />
        </mesh>
      ))}
      <mesh ref={core} material={gold}>
        <icosahedronGeometry args={[0.9, 1]} />
      </mesh>
      {/* saved-item flags on the faces */}
      {FLAGS.map((y) => (
        <mesh key={y} position={[2.15, y, 0]}>
          <boxGeometry args={[0.06, 0.7, 1.1]} />
          <meshStandardMaterial {...PANEL} />
        </mesh>
      ))}
      <mesh position={[0, 0, -3.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 2.2, 10]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
    </group>
  );
}

export function Station({
  kind,
  position,
}: {
  readonly kind: StationKind;
  readonly position: readonly [number, number, number];
}) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * (kind === 'traffic' ? 0.12 : 0.08);
  });
  return (
    <group position={[...position]} scale={1.7}>
      <pointLight position={[0, 3, 6]} intensity={30} distance={22} color="#dbe6ff" />
      <group ref={spin} rotation={[kind === 'traffic' ? 0.5 : 0.15, 0, kind === 'vault' ? 0.4 : 0]}>
        {kind === 'traffic' ? <Traffic /> : kind === 'documents' ? <Documents /> : <Vault />}
      </group>
    </group>
  );
}
