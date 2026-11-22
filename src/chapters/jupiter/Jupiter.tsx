import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield } from '../greybox/parts.tsx';
import { createRimMaterial } from '../../shaders/earth.ts';
import {
  ARRIVE,
  JUPITER,
  SATURN_AHEAD,
  SATURN_FROM,
  STATIONS,
  jupiterShip,
  jupiterShot,
} from './jupiter.ts';
import { HelVela } from '../ship/HelVela.tsx';
import { SaturnSystem } from '../saturn/Saturn.tsx';
import { LIGHT_07, LIGHT_08, TRAVEL_STARS, jupiterTurn, smooth } from '../handoff.ts';
import { TRAVEL_SKY } from '../space/skyFrame.ts';
import { Station } from './Stations.tsx';

/** SC08 · Jupiter: Project Installations. NASA/JPL/SSI Cassini map (A026). */
const TEX = '/assets/textures/jupiter_2k.ktx2';
const ENGINE = { current: 0.45 };
const DIR_07 = new THREE.Vector3(...LIGHT_07.direction).normalize();
const DIR_08 = new THREE.Vector3(...LIGHT_08.direction).normalize();
const C = {
  key07: new THREE.Color(LIGHT_07.color),
  key08: new THREE.Color(LIGHT_08.color),
  sky07: new THREE.Color(LIGHT_07.sky),
  sky08: new THREE.Color(LIGHT_08.sky),
  ground07: new THREE.Color(LIGHT_07.ground),
  ground08: new THREE.Color(LIGHT_08.ground),
};

function JupiterScene({ id, frame }: ChapterSceneProps) {
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
  const ship = useRef<THREE.Group>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.HemisphereLight>(null);
  const saturn = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    // ambient: the bands drift (no story meaning), on the shared clock
    if (planet.current) planet.current.rotation.y = jupiterTurn(clock.elapsedTime);
    if (frame.id !== id) return;
    if (ship.current) jupiterShip(frame.t, ship.current.position);
    if (saturn.current) saturn.current.visible = frame.t >= SATURN_FROM;
    // SC07's light at the boundary, turning into Jupiter's own while the ship arrives
    const w = smooth(frame.t / ARRIVE);
    if (key.current) {
      key.current.position.copy(DIR_07).lerp(DIR_08, w).normalize().multiplyScalar(300);
      key.current.color.copy(C.key07).lerp(C.key08, w);
      key.current.intensity = LIGHT_07.intensity + (LIGHT_08.intensity - LIGHT_07.intensity) * w;
    }
    if (fill.current) {
      fill.current.color.copy(C.sky07).lerp(C.sky08, w);
      fill.current.groundColor.copy(C.ground07).lerp(C.ground08, w);
      fill.current.intensity = LIGHT_07.ambient + (LIGHT_08.ambient - LIGHT_07.ambient) * w;
    }
  });
  return (
    <group>
      <Starfield {...TRAVEL_STARS} follow orient={TRAVEL_SKY} />
      <directionalLight ref={key} />
      <hemisphereLight ref={fill} />
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
      <group ref={saturn} visible={false}>
        <SaturnSystem position={SATURN_AHEAD} />
      </group>
      <HelVela ref={ship} engine={ENGINE} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

export const sc08Jupiter: ChapterImpl = {
  Scene: JupiterScene,
  shot: jupiterShot,
  background: '#010208',
};
