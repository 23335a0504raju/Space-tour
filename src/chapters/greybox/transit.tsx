import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey } from '../../engine/camera/shots.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Asteroids, Planet, Ship, Starfield, Station } from './parts.tsx';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ── SC07 · Outbound: Moon pass, Mars sweep, asteroid belt ────────────────────
const MOON: [string, string, string] = ['#55534f', '#a9a6a0', '#ffffff'];
const MARS: [string, string, string] = ['#6b2a14', '#c06a3a', '#f2e6da'];
const SUN_OUT: [number, number, number] = [1, 0.25, 0.6];
const BELT: [number, number, number] = [60, 14, 60];

function OutboundScene({ id, frame }: ChapterSceneProps) {
  const ship = useRef<THREE.Group>(null);
  useFrame(() => {
    if (frame.id !== id || !ship.current) return;
    ship.current.position.z = -frame.t * 200;
  });
  return (
    <group>
      <Starfield count={7000} radius={420} seed={41} />
      <directionalLight position={SUN_OUT} intensity={2.4} />
      <ambientLight intensity={0.06} />
      <Planet
        radius={9}
        mode="rock"
        colors={MOON}
        position={[16, -3, -40]}
        sun={SUN_OUT}
        seed={2}
      />
      <Planet
        radius={13}
        mode="rock"
        colors={MARS}
        atmosphere="#e3a27a"
        atmosphereStrength={0.5}
        position={[-26, 4, -110]}
        sun={SUN_OUT}
        seed={5}
      />
      <group position={[0, 0, -175]}>
        <Asteroids count={500} spread={BELT} />
      </group>
      <Ship ref={ship} rotation={[-Math.PI / 2, 0, 0]} engine={0.4} />
    </group>
  );
}

const outboundKeys: ShotKey[] = [
  { t: 0, position: [3, 2, 8], target: [8, -2, -40], fov: 50 },
  { t: 0.3, position: [4, 2, -40], target: [16, -3, -40], fov: 50 },
  { t: 0.6, position: [-4, 3, -95], target: [-26, 4, -110], fov: 55 },
  { t: 0.85, position: [3, 2, -160], target: [0, 0, -190], fov: 60 },
  { t: 1, position: [2, 1.5, -195], target: [0, 0, -230], fov: 60 },
];

export const sc07Outbound: ChapterImpl = {
  Scene: OutboundScene,
  shot: (t, out) => void sampleKeys(outboundKeys, t, out),
  background: '#020308',
};

// ── SC08 · Jupiter: Project Installations ─────────────────────────────────────
const JUPITER: [string, string, string] = ['#b8865b', '#efe2c8', '#a64b2a'];
const SUN_J: [number, number, number] = [1, 0.3, 0.8];
export const STATIONS: Array<{
  variant: 'ring' | 'pipeline' | 'hub';
  position: [number, number, number];
}> = [
  { variant: 'ring', position: [-9, 2, -22] },
  { variant: 'pipeline', position: [0, -1.5, -18] },
  { variant: 'hub', position: [9, 2.5, -22] },
];

function JupiterScene({ id, frame }: ChapterSceneProps) {
  const jupiter = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (frame.id !== id || !jupiter.current) return;
    jupiter.current.rotation.y += delta * 0.01; // ambient: band drift
  });
  return (
    <group>
      <Starfield count={6000} radius={420} seed={51} />
      <directionalLight position={SUN_J} intensity={2.6} />
      <ambientLight intensity={0.08} />
      <Planet
        ref={jupiter}
        radius={55}
        mode="bands"
        colors={JUPITER}
        atmosphere="#f3d9b0"
        atmosphereStrength={0.35}
        position={[0, -10, -120]}
        sun={SUN_J}
        segments={128}
      />
      {STATIONS.map((s) => (
        <Station key={s.variant} variant={s.variant} position={s.position} />
      ))}
    </group>
  );
}

const jupiterKeys: ShotKey[] = [
  { t: 0, position: [0, 6, 30], target: [0, -5, -100], fov: 55 },
  { t: 0.25, position: [-6.5, 2.6, -17.5], target: [-9, 2, -22], fov: 45 },
  { t: 0.5, position: [1.8, -0.6, -13.5], target: [0, -1.5, -18], fov: 45 },
  { t: 0.75, position: [6.5, 3.1, -17.5], target: [9, 2.5, -22], fov: 45 },
  { t: 1, position: [4, 6, -6], target: [0, 0, -60], fov: 55 },
];

export const sc08Jupiter: ChapterImpl = {
  Scene: JupiterScene,
  shot: (t, out) => void sampleKeys(jupiterKeys, t, out),
  background: '#020308',
};

// ── SC09 · Saturn: Stack Rings ────────────────────────────────────────────────
const SATURN: [string, string, string] = ['#c9a96e', '#efe0b8', '#8a6a3c'];
const SUN_S: [number, number, number] = [-0.4, 0.15, -1];
/** Five bands = the five stack groups in src/content/skills.ts. */
const BANDS: Array<[number, number]> = [
  [14, 16],
  [16.4, 18.2],
  [18.6, 20.4],
  [20.8, 22.4],
  [22.8, 24.5],
];

function SaturnScene({ id, frame }: ChapterSceneProps) {
  const bands = useRef<Array<THREE.Mesh | null>>([]);
  useFrame(() => {
    if (frame.id !== id) return;
    // highlight band i during its slice of the chapter; all lit at the end (rest point)
    const t = frame.t;
    bands.current.forEach((m, i) => {
      if (!m) return;
      const start = 0.15 + i * 0.1;
      const lit = clamp01((t - start) / 0.08);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + 0.6 * lit;
    });
  });
  return (
    <group>
      <Starfield count={6000} radius={420} seed={61} />
      <directionalLight position={SUN_S} intensity={2.2} />
      <Planet
        radius={11}
        mode="bands"
        colors={SATURN}
        atmosphere="#ffe6b0"
        atmosphereStrength={0.6}
        sun={SUN_S}
        seed={7}
      />
      <group rotation={[-Math.PI / 2 + 0.12, 0, 0]}>
        {BANDS.map(([inner, outer], i) => (
          <mesh
            key={inner}
            ref={(m) => {
              bands.current[i] = m;
            }}
          >
            <ringGeometry args={[inner, outer, 128]} />
            <meshBasicMaterial
              color={i % 2 ? '#e8d6ab' : '#cdb88a'}
              transparent
              opacity={0.25}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const saturnKeys: ShotKey[] = [
  { t: 0, position: [0, 0.6, 70], target: [0, 0, 0], fov: 40 },
  { t: 0.6, position: [10, 22, 55], target: [0, 0, 0], fov: 45 },
  { t: 1, position: [6, 34, 44], target: [0, -2, 0], fov: 48 },
];

export const sc09Saturn: ChapterImpl = {
  Scene: SaturnScene,
  shot: (t, out) => void sampleKeys(saturnKeys, t, out),
  background: '#020308',
};
