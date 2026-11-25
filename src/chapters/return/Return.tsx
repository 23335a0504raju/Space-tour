import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { createLimbAtmosphereMaterial, createEarthMaterial } from '../../shaders/earth.ts';
import { AREAS } from '../anime/anime.ts';
import { PAINTED_CLOUDS, SUN_BEYOND } from '../anime/clouds.ts';
import { Clouds, RingedPlanet, SkyDome } from '../anime/parts.tsx';
import { HORIZON_PLANETS } from '../anime/areas.tsx';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield } from '../greybox/parts.tsx';
import { TRAVEL_STARS } from '../handoff.ts';
import { TRAVEL_SKY } from '../space/skyFrame.ts';
import { BlackHole } from '../crossing/BlackHole.tsx';
import { HelVela } from '../ship/HelVela.tsx';
import {
  DAWN_SUN,
  EARTH,
  GATE,
  MOON,
  T_EXIT,
  T_GATE,
  TUNNEL,
  gateOpen,
  holeRadiusAt,
  returnShot,
  shipZ,
  styleAt,
} from './return.ts';

/** The painted sun here sits on the other side (mirrored x): the clouds are lit from it. */
const RETURN_SUN = [-SUN_BEYOND[0], SUN_BEYOND[1], -300] as const;

/**
 * SC12 · The Return (FINAL_STORYLINE SC12). The crossing in reverse; the screen-space style pass
 * (driven by `style()`) un-draws the cel look while this scene supplies the gate, the tunnel and
 * the real world beyond: Earth and the Moon at dawn (NASA maps A021–A023).
 */
const TEX = {
  day: '/assets/textures/earth_day_2k.ktx2',
  // the closest views of Earth (here and SC13) use the 4K map on Balanced (A021)
  dayHi: '/assets/textures/earth_day_4k.ktx2',
  night: '/assets/textures/earth_night_2k.ktx2',
  moon: '/assets/textures/moon_1k.ktx2',
} as const;
const ENGINE = { current: 0.5 };
const SUN = new THREE.Vector3(...DAWN_SUN).normalize();
const SKY = AREAS.horizon.sky;

function ReturnScene({ id, frame }: ChapterSceneProps) {
  const gl = useThree((s) => s.gl);
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const maps = useLoader(getKTX2Loader(gl), [low ? TEX.day : TEX.dayHi, TEX.night, TEX.moon]);
  const [dayMap, nightMap, moonMap] = maps;
  if (!dayMap || !nightMap || !moonMap) throw new Error('SC12: textures missing');
  useLayoutEffect(() => {
    for (const t of [dayMap, nightMap, moonMap]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    }
  }, [dayMap, nightMap, moonMap]);
  const { earth, atmosphere } = useMemo(() => {
    const e = createEarthMaterial(dayMap, nightMap, low, { closeup: true });
    // the thin limb atmosphere of SC06 (the old shell read as a hazy halo behind the planet)
    const a = createLimbAtmosphereMaterial(EARTH.radius, new THREE.Vector3(...EARTH.position));
    (e.uniforms['uSun']?.value as THREE.Vector3).copy(SUN);
    (a.uniforms['uSun']?.value as THREE.Vector3).copy(SUN);
    return { earth: e, atmosphere: a };
  }, [dayMap, nightMap, low]);
  useDisposeOnUnmount(earth, atmosphere);

  const ship = useRef<THREE.Group>(null);
  const dome = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const painted = useRef<THREE.Group>(null);
  const painted2 = useRef<THREE.Group>(null);
  const real = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Group>(null);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (frame.id === id) {
      const t = frame.t;
      const z = shipZ(t);
      ship.current?.position.set(0, 0, z);
      dome.current?.position.set(0, 0, z);
      light.current?.position.set(SUN.x * 100, SUN.y * 100, SUN.z * 100 + z);
      sunTarget.position.set(0, 0, z);
      // which world is on stage is a pure function of t
      if (painted.current) painted.current.visible = t < T_GATE + 0.03;
      if (painted2.current) painted2.current.visible = t < T_GATE + 0.03;
      if (real.current) real.current.visible = t > T_EXIT - 0.05;
      // real stars only exist once the painted sky is behind us
      if (stars.current) stars.current.visible = t > T_GATE + 0.04;
    }
  });

  return (
    <group>
      {/* before the gate: the painted sky we are leaving */}
      <group ref={painted}>
        <group ref={dome}>
          <SkyDome colors={SKY} />
        </group>
        <group position={[0, 0, 400]}>
          <Clouds items={PAINTED_CLOUDS} sun={RETURN_SUN} />
        </group>
        <mesh position={[SUN_BEYOND[0] * -1, SUN_BEYOND[1], -460]}>
          <sphereGeometry args={[34, 24, 16]} />
          <meshBasicMaterial color={new THREE.Color(2.2, 1.7, 1.2)} toneMapped={false} />
        </mesh>
      </group>

      {/* the big ringed planet of SC11c, still ahead (its place relative to the ship) */}
      <group ref={painted2}>
        <RingedPlanet
          position={[HORIZON_PLANETS.big[0], HORIZON_PLANETS.big[1], HORIZON_PLANETS.big[2] + 220]}
          radius={40}
        />
      </group>

      <group ref={stars} visible={false}>
        <Starfield {...TRAVEL_STARS} follow orient={TRAVEL_SKY} />
      </group>
      <directionalLight ref={light} target={sunTarget} color="#fff1dc" intensity={3} />
      <primitive object={sunTarget} />
      <hemisphereLight args={['#5a6f9a', '#06070b', 0.55]} />

      {/* the black hole and the fall home */}
      <BlackHole
        id={id}
        frame={frame}
        z={GATE.z}
        radius={16}
        radiusAt={holeRadiusAt}
        tunnel={TUNNEL}
        open={gateOpen}
        flow={2.5}
      />

      {/* real space beyond: Earth with the sun rising on its limb, and the Moon */}
      <group ref={real} visible={false}>
        <mesh position={[...EARTH.position]} rotation={[0.2, 1.0, 0]} material={earth}>
          <sphereGeometry args={[EARTH.radius, low ? 64 : 128, low ? 48 : 96]} />
        </mesh>
        <mesh position={[...EARTH.position]} material={atmosphere}>
          <sphereGeometry args={[EARTH.radius * 1.04, 96, 64]} />
        </mesh>
        <mesh position={[...MOON.position]} rotation={[0, 2.4, 0]}>
          <sphereGeometry args={[MOON.radius, 48, 32]} />
          <meshLambertMaterial map={moonMap} color="#d8d8d8" />
        </mesh>
        <mesh position={[SUN.x * 1500, SUN.y * 1500, SUN.z * 1500]}>
          <sphereGeometry args={[16, 16, 12]} />
          <meshBasicMaterial color={new THREE.Color(4, 3.2, 2.4)} toneMapped={false} />
        </mesh>
      </group>

      <HelVela ref={ship} engine={ENGINE} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

export const sc12Return: ChapterImpl = {
  Scene: ReturnScene,
  shot: returnShot,
  style: styleAt,
  background: '#020308',
};
