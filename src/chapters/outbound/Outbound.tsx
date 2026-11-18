import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Asteroids, Starfield } from '../greybox/parts.tsx';
import { HelVela } from '../ship/HelVela.tsx';
import {
  createAtmosphereMaterial,
  createEarthMaterial,
  createRimMaterial,
} from '../../shaders/earth.ts';
import {
  BELT,
  EARTH,
  EARTH_SUN,
  MARS,
  MERCURY,
  MOON,
  SUN,
  outboundShot,
  shipZ,
} from './outbound.ts';

/** SC07 · Outbound (FINAL_STORYLINE SC07): Moon pass, Mars sweep, the belt. NASA textures A023/A025. */
const TEX = {
  moon: '/assets/textures/moon_1k.ktx2',
  mars: '/assets/textures/mars_2k.ktx2',
  day: '/assets/textures/earth_day_2k.ktx2',
  night: '/assets/textures/earth_night_2k.ktx2',
} as const;
const ENGINE = { current: 0.45 };
const SUN_POS = new THREE.Vector3(...SUN).normalize().multiplyScalar(200);
const SPREAD: [number, number, number] = [...BELT.spread];

function OutboundScene({ id, frame }: ChapterSceneProps) {
  const gl = useThree((s) => s.gl);
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const [moonMap, marsMap, dayMap, nightMap] = useLoader(getKTX2Loader(gl), [
    TEX.moon,
    TEX.mars,
    TEX.day,
    TEX.night,
  ]);
  useLayoutEffect(() => {
    for (const t of [moonMap, marsMap, dayMap, nightMap]) {
      if (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
      }
    }
  }, [moonMap, marsMap, dayMap, nightMap]);
  const { earth, earthAtmo } = useMemo(() => {
    if (!dayMap || !nightMap) throw new Error('SC07: Earth textures missing');
    const e = createEarthMaterial(dayMap, nightMap, low);
    const a = createAtmosphereMaterial();
    const sun = new THREE.Vector3(...EARTH_SUN).normalize();
    (e.uniforms['uSun']?.value as THREE.Vector3).copy(sun);
    (a.uniforms['uSun']?.value as THREE.Vector3).copy(sun);
    return { earth: e, earthAtmo: a };
  }, [dayMap, nightMap, low]);
  useDisposeOnUnmount(earth, earthAtmo);
  const haze = useMemo(() => createRimMaterial('#e0916a', 0.5, 2.6), []);
  useDisposeOnUnmount(haze);
  const ship = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (frame.id !== id) return;
    const z = shipZ(frame.t);
    ship.current?.position.set(0, 0, z);
    // the key light travels with the ship so shadows/phase stay stable at any distance
    light.current?.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z + z);
    sunTarget.position.set(0, 0, z);
  });
  return (
    <group>
      <Starfield count={7000} radius={1500} seed={41} />
      <directionalLight ref={light} target={sunTarget} color="#fff2e0" intensity={2.8} />
      <primitive object={sunTarget} />
      <hemisphereLight args={['#33415f', '#08090d', 0.3]} />
      <mesh position={[...EARTH.position]} rotation={[0.08, 1.15, 0]} material={earth}>
        <sphereGeometry args={[EARTH.radius, low ? 64 : 128, low ? 48 : 96]} />
      </mesh>
      <mesh position={[...EARTH.position]} material={earthAtmo}>
        <sphereGeometry args={[EARTH.radius * 1.03, 64, 48]} />
      </mesh>
      <mesh position={[...MOON.position]} rotation={[0, 1.3, 0]}>
        <sphereGeometry args={[MOON.radius, low ? 48 : 96, low ? 32 : 64]} />
        <meshStandardMaterial map={moonMap ?? null} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[...MARS.position]} rotation={[0.1, 2.2, 0]}>
        <sphereGeometry args={[MARS.radius, low ? 64 : 128, low ? 48 : 96]} />
        <meshStandardMaterial map={marsMap ?? null} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[...MERCURY.position]} rotation={[0.1, 0.8, 0]}>
        <sphereGeometry args={[MERCURY.radius, low ? 48 : 96, low ? 32 : 64]} />
        <meshStandardMaterial map={moonMap ?? null} color="#c8b8a4" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[...MARS.position]} material={haze}>
        <sphereGeometry args={[MARS.radius * 1.06, 48, 32]} />
      </mesh>
      <group position={[...BELT.centre]}>
        <Asteroids count={low ? 350 : 700} spread={SPREAD} seed={9} />
      </group>
      <HelVela ref={ship} engine={ENGINE} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

export const sc07Outbound: ChapterImpl = {
  Scene: OutboundScene,
  shot: outboundShot,
  background: '#010208',
};
