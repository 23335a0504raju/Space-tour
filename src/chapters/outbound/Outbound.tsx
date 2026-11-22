import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield } from '../greybox/parts.tsx';
import { Belt } from './Belt.tsx';
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
  JUPITER_AHEAD,
  JUPITER_RADIUS,
  outboundShot,
  shipZ,
} from './outbound.ts';
import { TRAVEL_STARS, jupiterTurn } from '../handoff.ts';
import { TRAVEL_SKY } from '../space/skyFrame.ts';

/** SC07 · Outbound (FINAL_STORYLINE SC07): Moon pass, Mars sweep, the belt. NASA textures A023/A025. */
const TEX = {
  moon: '/assets/textures/moon_1k.ktx2',
  mars: '/assets/textures/mars_2k.ktx2',
  day: '/assets/textures/earth_day_2k.ktx2',
  night: '/assets/textures/earth_night_2k.ktx2',
  jupiter: '/assets/textures/jupiter_2k.ktx2',
} as const;
const ENGINE = { current: 0.45 };
const SUN_POS = new THREE.Vector3(...SUN).normalize().multiplyScalar(200);
const SPREAD: [number, number, number] = [...BELT.spread];

function OutboundScene({ id, frame }: ChapterSceneProps) {
  const gl = useThree((s) => s.gl);
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const [moonMap, marsMap, dayMap, nightMap, jupiterMap] = useLoader(getKTX2Loader(gl), [
    TEX.moon,
    TEX.mars,
    TEX.day,
    TEX.night,
    TEX.jupiter,
  ]);
  useLayoutEffect(() => {
    for (const t of [moonMap, marsMap, dayMap, nightMap, jupiterMap]) {
      if (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
      }
    }
  }, [moonMap, marsMap, dayMap, nightMap, jupiterMap]);
  const jupiterHaze = useMemo(() => createRimMaterial('#f0cfa0', 0.45, 2.4), []);
  useDisposeOnUnmount(jupiterHaze);
  const jupiter = useRef<THREE.Mesh>(null);
  const jupiterRim = useRef<THREE.Mesh>(null);
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
  useFrame(({ clock, camera }) => {
    const j = jupiter.current;
    if (j) {
      j.rotation.y = jupiterTurn(clock.elapsedTime);
      // Jupiter waits beyond the belt: hidden until its near side is well inside the 2 km far plane,
      // then it brightens out of the dark as the ship closes in (it used to show, clipped, at Mars)
      const near = camera.position.distanceTo(j.position) - JUPITER_RADIUS;
      const k = Math.min(1, Math.max(0, (1550 - near) / 350));
      const m = j.material as THREE.MeshStandardMaterial;
      m.opacity = k;
      m.transparent = k < 1;
      j.visible = k > 0.001;
      if (jupiterRim.current) jupiterRim.current.visible = k > 0.999;
    }
    if (frame.id !== id) return;
    const z = shipZ(frame.t);
    ship.current?.position.set(0, 0, z);
    // the key light travels with the ship so shadows/phase stay stable at any distance
    light.current?.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z + z);
    sunTarget.position.set(0, 0, z);
  });
  return (
    <group>
      <Starfield {...TRAVEL_STARS} follow orient={TRAVEL_SKY} />
      <directionalLight ref={light} target={sunTarget} color="#fff2e0" intensity={3.4} />
      <primitive object={sunTarget} />
      <hemisphereLight args={['#33415f', '#08090d', 0.12]} />
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
        <Belt count={low ? 130 : 520} spread={SPREAD} seed={9} low={low} />
      </group>
      {/* Jupiter ahead, beyond the belt: where SC08 has it from the ship (handoff.ts) */}
      <mesh ref={jupiter} position={[...JUPITER_AHEAD]} rotation={[0.12, 0.6, 0.05]}>
        <sphereGeometry args={[JUPITER_RADIUS, low ? 64 : 128, low ? 48 : 96]} />
        <meshStandardMaterial map={jupiterMap ?? null} roughness={1} metalness={0} />
      </mesh>
      <mesh ref={jupiterRim} position={[...JUPITER_AHEAD]} material={jupiterHaze}>
        <sphereGeometry args={[JUPITER_RADIUS * 1.05, 48, 32]} />
      </mesh>
      <HelVela ref={ship} engine={ENGINE} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

export const sc07Outbound: ChapterImpl = {
  Scene: OutboundScene,
  shot: outboundShot,
  background: '#010208',
};
