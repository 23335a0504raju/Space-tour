import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey } from '../../engine/camera/shots.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Planet, Ship, Starfield } from './parts.tsx';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);
const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));

// ── SC06 · Orbital Sunrise: Core Strengths ────────────────────────────────────
const EARTH_COLORS: [string, string, string] = ['#0b2a55', '#3f5f2a', '#c9c2a6'];
const MOON_COLORS: [string, string, string] = ['#5d5b58', '#a7a49e', '#ffffff'];

const sunDir = new THREE.Vector3();

function SunriseScene({ id, frame }: ChapterSceneProps) {
  const earth = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (frame.id !== id) return;
    const t = frame.t;
    // the sun rises over the limb: its direction sweeps from behind the planet to above
    const a = -0.35 + span(t, 0, 0.6) * 0.75;
    const dir = sunDir.set(0.3, Math.sin(a), -Math.cos(a)).normalize();
    const mat = earth.current?.material;
    if (mat instanceof THREE.ShaderMaterial)
      (mat.uniforms['uSun']?.value as THREE.Vector3 | undefined)?.copy(dir);
    if (sun.current) sun.current.position.copy(dir).multiplyScalar(260);
  });
  return (
    <group>
      <Starfield count={6000} radius={320} seed={31} />
      <Planet
        ref={earth}
        radius={40}
        mode="terrain"
        colors={EARTH_COLORS}
        atmosphere="#6fa8ff"
        atmosphereStrength={1.4}
        position={[0, -42, -10]}
        segments={128}
      />
      <Planet
        radius={2.2}
        mode="rock"
        colors={MOON_COLORS}
        position={[38, 14, -120]}
        sun={[0.3, 0.2, -1]}
      />
      <mesh ref={sun}>
        <sphereGeometry args={[6, 24, 16]} />
        <meshBasicMaterial color="#fff4dc" toneMapped={false} />
      </mesh>
      <directionalLight position={[0.3, 0.3, -1]} intensity={2.5} />
      <ambientLight intensity={0.08} />
      <Ship position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  );
}

const sunriseKeys: ShotKey[] = [
  { t: 0, position: [0, 2.2, 7], target: [0, -2, -40], fov: 50 },
  { t: 0.5, position: [3, 1.4, 5], target: [0, 0, -60], fov: 45 },
  { t: 1, position: [4, 2.5, 6], target: [0, 4, -80], fov: 45 },
];

export const sc06Sunrise: ChapterImpl = {
  Scene: SunriseScene,
  shot: (t, out) => void sampleKeys(sunriseKeys, t, out),
  background: '#020308',
};
