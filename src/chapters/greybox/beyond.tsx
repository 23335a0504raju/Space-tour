import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey } from '../../engine/camera/shots.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Ship, Starfield, ToonShape } from './parts.tsx';

/**
 * ANIME_UNIVERSE_FRAMEWORK.md: structure only. The areas below are deliberately generic
 * stand-ins (toon shading, outlines, stylised skies); real worlds are designed later.
 */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const PAPER = new THREE.Color('#efe9dc');
const VOID = new THREE.Color('#020308');

// ── SC10 · The Crossing: realistic → line art → cel colour ───────────────────
function Gate({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <torusGeometry args={[6, 0.25, 16, 96]} />
      <meshBasicMaterial color="#d6a756" toneMapped={false} />
    </mesh>
  );
}

function CrossingScene({ id, frame }: ChapterSceneProps) {
  const wire = useRef<THREE.Group>(null);
  useFrame(({ scene }) => {
    if (frame.id !== id) return;
    const t = frame.t;
    // after passing the gate (t > 0.55) space is re-drawn as ink on paper
    const k = clamp01((t - 0.55) / 0.4);
    if (scene.background instanceof THREE.Color) scene.background.copy(VOID).lerp(PAPER, k);
    if (wire.current) wire.current.visible = k > 0;
  });
  return (
    <group>
      <Starfield count={5000} radius={400} seed={71} />
      <Gate position={[0, 0, -40]} />
      <group ref={wire} position={[0, 0, -80]}>
        {[-8, 0, 8].map((x, i) => (
          <mesh key={x} position={[x, (i - 1) * 2, -i * 6]}>
            <icosahedronGeometry args={[3 + i, 1]} />
            <meshBasicMaterial color="#1b1820" wireframe />
          </mesh>
        ))}
      </group>
      <Ship rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]} engine={0.5} />
    </group>
  );
}

const crossingKeys: ShotKey[] = [
  { t: 0, position: [2, 1.5, 6], target: [0, 0, -40], fov: 50 },
  { t: 0.55, position: [0, 0.5, -38], target: [0, 0, -60], fov: 70 },
  { t: 1, position: [0, 2, -55], target: [0, 0, -86], fov: 50 },
];

export const sc10Crossing: ChapterImpl = {
  Scene: CrossingScene,
  shot: (t, out) => void sampleKeys(crossingKeys, t, out),
  background: '#020308',
};

// ── SC11 · Anime-inspired areas (A, B, C) ─────────────────────────────────────
interface AreaStyle {
  sky: string;
  ground: string;
  accents: [string, string, string];
}

function makeArea(style: AreaStyle, seed: number): ChapterImpl {
  function AreaScene() {
    const shapes = Array.from({ length: 7 }, (_, i) => {
      const x = Math.sin(i * 1.7 + seed) * 18;
      const z = -10 - i * 7;
      return { x, z, i };
    });
    return (
      <group>
        <hemisphereLight args={['#ffffff', style.ground, 1.6]} />
        <directionalLight position={[4, 8, 3]} intensity={1.6} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -30]}>
          <circleGeometry args={[60, 48]} />
          <meshToonMaterial color={style.ground} />
        </mesh>
        {shapes.map(({ x, z, i }) => (
          <ToonShape
            key={i}
            geometry={i % 3 === 0 ? 'cone' : i % 3 === 1 ? 'sphere' : 'box'}
            color={style.accents[i % 3] ?? '#ffffff'}
            position={[x, i % 3 === 0 ? 1.2 : 0, z]}
            scale={1.4 + (i % 4) * 0.6}
          />
        ))}
        <ToonShape geometry="torus" color={style.accents[0]} position={[0, 6, -40]} scale={3} />
        <Ship rotation={[-Math.PI / 2, 0, 0]} position={[0, 2, -2]} engine={0.4} />
      </group>
    );
  }
  const keys: ShotKey[] = [
    { t: 0, position: [3, 3.5, 6], target: [0, 1, -30], fov: 50 },
    { t: 0.55, position: [-4, 5, -2], target: [0, 2, -32], fov: 48 },
    { t: 1, position: [0, 7, -12], target: [0, 3, -44], fov: 50 },
  ];
  return {
    Scene: AreaScene,
    shot: (t, out) => void sampleKeys(keys, t, out),
    background: style.sky,
  };
}

export const sc11aDiscipline = makeArea(
  { sky: '#f3cfc4', ground: '#e8b9a6', accents: ['#c94f4f', '#f6efe4', '#3b3346'] },
  1,
);
export const sc11bProof = makeArea(
  { sky: '#a9d8d0', ground: '#7fb8a8', accents: ['#f2c14e', '#2f4858', '#f6efe4'] },
  2,
);
export const sc11cHorizon = makeArea(
  { sky: '#bfb0ec', ground: '#8f7fc9', accents: ['#ffb4a2', '#2b2440', '#f6efe4'] },
  3,
);

// ── SC12 · The Return: cel colour → line art → real space ───────────────────
function ReturnScene({ id, frame }: ChapterSceneProps) {
  useFrame(({ scene }) => {
    if (frame.id !== id) return;
    const k = 1 - clamp01((frame.t - 0.1) / 0.6);
    if (scene.background instanceof THREE.Color) scene.background.copy(VOID).lerp(PAPER, k);
  });
  return (
    <group>
      <Starfield count={5000} radius={400} seed={81} />
      <Gate position={[0, 0, -30]} />
      <Ship rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]} engine={0.6} />
    </group>
  );
}

const returnKeys: ShotKey[] = [
  { t: 0, position: [0, 1.5, 6], target: [0, 0, -30], fov: 60 },
  { t: 1, position: [0, 0.5, -34], target: [0, 0, -80], fov: 50 },
];

export const sc12Return: ChapterImpl = {
  Scene: ReturnScene,
  shot: (t, out) => void sampleKeys(returnKeys, t, out),
  background: '#efe9dc',
};
