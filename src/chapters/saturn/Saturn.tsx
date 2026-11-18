import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { createRingMaterial, createSaturnMaterial } from '../../shaders/saturn.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield, seeded } from '../greybox/parts.tsx';
import { BAND_RANGES, SATURN, SUN, bandLevel, saturnShot } from './saturn.ts';

/** SC09 · Saturn: Stack Rings (FINAL_STORYLINE SC09). Fully procedural: no new assets. */
const SUN_DIR = new THREE.Vector3(...SUN).normalize();
const DUST = 1600;

/** Ring dust near the lens: instanced points scattered through the ring plane. */
function RingDust() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const rand = seeded(5);
    const pos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i += 1) {
      const a = rand() * Math.PI * 2;
      const r = SATURN.ringInner + (SATURN.ringOuter - SATURN.ringInner) * (0.2 + rand() * 0.8);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (rand() - 0.5) * 3;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color('#f3e2bd').multiplyScalar(1.1),
        size: 0.7,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    [],
  );
  useDisposeOnUnmount(geo, mat);
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

function SaturnScene({ id, frame }: ChapterSceneProps) {
  const planet = useMemo(() => createSaturnMaterial(SUN_DIR), []);
  const rings = useMemo(
    () =>
      createRingMaterial(SUN_DIR, SATURN.radius, SATURN.ringInner, SATURN.ringOuter, BAND_RANGES),
    [],
  );
  useDisposeOnUnmount(planet, rings);
  const ringGeo = useMemo(
    () => new THREE.RingGeometry(SATURN.ringInner, SATURN.ringOuter, 192, 1),
    [],
  );
  useDisposeOnUnmount(ringGeo);
  const bands = useRef<number[]>([0, 0, 0, 0, 0]);
  useEffect(() => {
    // the uniform array is mutated in place each frame (no allocation)
    bands.current = rings.uniforms['uBand']?.value as number[];
  }, [rings]);
  useFrame(() => {
    if (frame.id !== id) return;
    for (let i = 0; i < bands.current.length; i += 1) bands.current[i] = bandLevel(i, frame.t);
  });
  return (
    <group>
      <Starfield count={6000} radius={1200} seed={61} />
      <group rotation={[0, 0, SATURN.tilt]}>
        <mesh material={planet}>
          <sphereGeometry args={[SATURN.radius, 96, 64]} />
        </mesh>
        <mesh geometry={ringGeo} material={rings} rotation={[-Math.PI / 2, 0, 0]} />
        <RingDust />
      </group>
    </group>
  );
}

export const sc09Saturn: ChapterImpl = {
  Scene: SaturnScene,
  shot: saturnShot,
  background: '#010208',
};
