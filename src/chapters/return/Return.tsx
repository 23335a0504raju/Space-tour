import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { createAnomalyMaterial, createTunnelMaterial } from '../../shaders/crossing.ts';
import { createAtmosphereMaterial, createEarthMaterial } from '../../shaders/earth.ts';
import { AREAS } from '../anime/anime.ts';
import { PAINTED_CLOUDS, SUN_BEYOND } from '../anime/clouds.ts';
import { Clouds, SkyDome } from '../anime/parts.tsx';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield } from '../greybox/parts.tsx';
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
  returnShot,
  shipZ,
  styleAt,
} from './return.ts';

/**
 * SC12 · The Return (FINAL_STORYLINE SC12). The crossing in reverse; the screen-space style pass
 * (driven by `style()`) un-draws the cel look while this scene supplies the gate, the tunnel and
 * the real world beyond: Earth and the Moon at dawn (NASA maps A021–A023).
 */
const TEX = {
  day: '/assets/textures/earth_day_2k.ktx2',
  night: '/assets/textures/earth_night_2k.ktx2',
  moon: '/assets/textures/moon_1k.ktx2',
} as const;
const ENGINE = { current: 0.5 };
const SUN = new THREE.Vector3(...DAWN_SUN).normalize();
const SKY = AREAS.horizon.sky;

function ReturnScene({ id, frame }: ChapterSceneProps) {
  const gl = useThree((s) => s.gl);
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const maps = useLoader(getKTX2Loader(gl), [TEX.day, TEX.night, TEX.moon]);
  const [dayMap, nightMap, moonMap] = maps;
  if (!dayMap || !nightMap || !moonMap) throw new Error('SC12: textures missing');
  useLayoutEffect(() => {
    for (const t of [dayMap, nightMap, moonMap]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    }
  }, [dayMap, nightMap, moonMap]);
  const { earth, atmosphere } = useMemo(() => {
    const e = createEarthMaterial(dayMap, nightMap, low);
    const a = createAtmosphereMaterial();
    (e.uniforms['uSun']?.value as THREE.Vector3).copy(SUN);
    (a.uniforms['uSun']?.value as THREE.Vector3).copy(SUN);
    return { earth: e, atmosphere: a };
  }, [dayMap, nightMap, low]);
  const anomaly = useMemo(() => createAnomalyMaterial(), []);
  const tunnel = useMemo(() => createTunnelMaterial(), []);
  useDisposeOnUnmount(earth, atmosphere, anomaly, tunnel);

  const ship = useRef<THREE.Group>(null);
  const dome = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const painted = useRef<THREE.Group>(null);
  const tunnelGroup = useRef<THREE.Group>(null);
  const real = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Group>(null);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    if (frame.id === id) {
      const t = frame.t;
      const z = shipZ(t);
      ship.current?.position.set(0, 0, z);
      dome.current?.position.set(0, 0, z);
      light.current?.position.set(SUN.x * 100, SUN.y * 100, SUN.z * 100 + z);
      sunTarget.position.set(0, 0, z);
      anomaly.uniforms['uOpen']!.value = gateOpen(t);
      // which world is on stage is a pure function of t
      if (painted.current) painted.current.visible = t < T_GATE + 0.03;
      if (tunnelGroup.current) tunnelGroup.current.visible = t > T_GATE - 0.04 && t < T_EXIT + 0.04;
      if (real.current) real.current.visible = t > T_EXIT - 0.05;
      // real stars only exist once the painted sky is behind us
      if (stars.current) stars.current.visible = t > T_GATE + 0.04;
    }
    // ambient: swirl and a fast tunnel flow
    anomaly.uniforms['uTime']!.value = clock.elapsedTime;
    tunnel.uniforms['uTime']!.value = clock.elapsedTime * 2.5;
  });

  return (
    <group>
      {/* before the gate: the painted sky we are leaving */}
      <group ref={painted}>
        <group ref={dome}>
          <SkyDome colors={SKY} />
        </group>
        <group position={[0, 0, 400]}>
          <Clouds items={PAINTED_CLOUDS} />
        </group>
        <mesh position={[SUN_BEYOND[0] * -1, SUN_BEYOND[1], -460]}>
          <sphereGeometry args={[34, 24, 16]} />
          <meshBasicMaterial color={new THREE.Color(2.2, 1.7, 1.2)} toneMapped={false} />
        </mesh>
      </group>

      <group ref={stars} visible={false}>
        <Starfield count={5000} radius={1500} seed={81} />
      </group>
      <directionalLight ref={light} target={sunTarget} color="#fff1dc" intensity={3} />
      <primitive object={sunTarget} />
      <hemisphereLight args={['#5a6f9a', '#06070b', 0.55]} />

      {/* the gate and the tunnel home */}
      <group position={[0, 0, GATE.z]}>
        <mesh>
          <torusGeometry args={[GATE.radius, 0.55, 16, 128]} />
          <meshBasicMaterial
            color={new THREE.Color('#d6a756').multiplyScalar(1.4)}
            toneMapped={false}
          />
        </mesh>
        <mesh material={anomaly}>
          <circleGeometry args={[GATE.radius, 96]} />
        </mesh>
      </group>
      <group ref={tunnelGroup} visible={false}>
        <mesh
          position={[0, 0, (TUNNEL.start + TUNNEL.end) / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          material={tunnel}
        >
          <cylinderGeometry
            args={[TUNNEL.radius, TUNNEL.radius, TUNNEL.start - TUNNEL.end, 48, 1, true]}
          />
        </mesh>
      </group>

      {/* real space beyond: Earth with the sun rising on its limb, and the Moon */}
      <group ref={real} visible={false}>
        <mesh position={[...EARTH.position]} rotation={[0.2, 1.0, 0]} material={earth}>
          <sphereGeometry args={[EARTH.radius, low ? 64 : 128, low ? 48 : 96]} />
        </mesh>
        <mesh position={[...EARTH.position]} material={atmosphere}>
          <sphereGeometry args={[EARTH.radius * 1.03, 64, 48]} />
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
