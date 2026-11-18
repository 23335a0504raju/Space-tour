import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import type { ChapterImpl } from '../contract.ts';
import { Starfield } from '../greybox/parts.tsx';
import { createRimMaterial } from '../../shaders/earth.ts';
import { JUPITER, STATIONS, SUN, jupiterShot } from './jupiter.ts';
import { Station } from './Stations.tsx';

/** SC08 · Jupiter: Project Installations. NASA/JPL/SSI Cassini map (A026). */
const TEX = '/assets/textures/jupiter_2k.ktx2';
const SUN_POS = new THREE.Vector3(...SUN).normalize().multiplyScalar(300).toArray();

function JupiterScene() {
  const gl = useThree((s) => s.gl);
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const map = useLoader(getKTX2Loader(gl), TEX);
  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
  }, [map]);
  const haze = useMemo(() => createRimMaterial('#f0cfa0', 0.45, 2.4), []);
  useDisposeOnUnmount(haze);
  const planet = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    // ambient: the bands drift (no story meaning)
    if (planet.current) planet.current.rotation.y += delta * 0.012;
  });
  return (
    <group>
      <Starfield count={5000} radius={1500} seed={51} />
      <directionalLight position={SUN_POS} intensity={3} color="#fff1de" />
      <hemisphereLight args={['#6b5a48', '#05060a', 0.35]} />
      <mesh ref={planet} position={[...JUPITER.position]} rotation={[0.12, 0.6, 0.05]}>
        <sphereGeometry args={[JUPITER.radius, low ? 64 : 128, low ? 48 : 96]} />
        <meshStandardMaterial map={map} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[...JUPITER.position]} material={haze}>
        <sphereGeometry args={[JUPITER.radius * 1.05, 48, 32]} />
      </mesh>
      {STATIONS.map((s) => (
        <Station key={s.kind} kind={s.kind} position={s.position} />
      ))}
    </group>
  );
}

export const sc08Jupiter: ChapterImpl = {
  Scene: JupiterScene,
  shot: jupiterShot,
  background: '#010208',
};
