import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey } from '../../engine/camera/shots.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Astronaut, Planet, Ship, Starfield } from './parts.tsx';

const EARTH: [string, string, string] = ['#0b2a55', '#3f5f2a', '#c9c2a6'];
const DAWN: [number, number, number] = [0.6, 0.15, -1];

// ── SC13 · Homecoming & Final Transmission ────────────────────────────────────
function TransmissionScene({ id, frame }: ChapterSceneProps) {
  const pulse = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (frame.id !== id || !pulse.current) return;
    // ambient beacon pulse (wall clock, carries no story meaning)
    const k = (clock.elapsedTime * 0.6) % 1;
    pulse.current.scale.setScalar(0.2 + k * 2.5);
    (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - k);
  });
  return (
    <group>
      <Starfield count={6000} radius={420} seed={91} />
      <directionalLight position={DAWN} intensity={2.4} />
      <ambientLight intensity={0.1} />
      {/* fill from Earthshine so the hull reads against black space */}
      <hemisphereLight args={['#9fc2ff', '#1a2a44', 0.9]} />
      <Planet
        radius={60}
        mode="terrain"
        colors={EARTH}
        atmosphere="#6fa8ff"
        atmosphereStrength={1.4}
        position={[0, -64, -20]}
        sun={DAWN}
        segments={128}
      />
      <Ship rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} />
      <Astronaut position={[0.2, 0.6, 0]} rotation={[0, -0.6, 0]} />
      <mesh position={[0.9, 0.75, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.9, 12]} />
        <meshStandardMaterial color="#c9ccd3" metalness={0.7} />
      </mesh>
      <mesh position={[0.9, 1.25, 0]}>
        <sphereGeometry args={[0.08, 16, 12]} />
        <meshBasicMaterial color="#d6a756" toneMapped={false} />
      </mesh>
      <mesh ref={pulse} position={[0.9, 1.25, 0]}>
        <sphereGeometry args={[0.3, 24, 16]} />
        <meshBasicMaterial color="#d6a756" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

const transmissionKeys: ShotKey[] = [
  { t: 0, position: [-14, 5, 22], target: [0, -2, -20], fov: 50 },
  { t: 0.6, position: [-3.5, 1.8, 4.5], target: [0.6, 0.8, 0], fov: 42 },
  { t: 1, position: [-3.8, 1.9, 4.8], target: [0.6, 0.8, 0], fov: 42 },
];

export const sc13Transmission: ChapterImpl = {
  Scene: TransmissionScene,
  shot: (t, out) => void sampleKeys(transmissionKeys, t, out),
  background: '#020308',
};
