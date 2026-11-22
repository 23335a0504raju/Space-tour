import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { createRimMaterial } from '../../shaders/earth.ts';
import { JUPITER, SHIP_EXIT } from '../jupiter/jupiter.ts';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { createRingMaterial, createSaturnMaterial } from '../../shaders/saturn.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield, seeded } from '../greybox/parts.tsx';
import {
  BAND_RANGES,
  HOLE_AHEAD,
  HOLE_FROM,
  LEAVE,
  SATURN,
  SHIP_START,
  SUN,
  bandLevel,
  saturnShip,
  saturnShot,
} from './saturn.ts';
import { DistantBlackHole } from '../crossing/BlackHole.tsx';
import { HOLE_RADIUS, gateOpen, holeRadiusAt } from '../crossing/crossing.ts';
import { HelVela } from '../ship/HelVela.tsx';
import { LIGHT_08, LIGHT_10, TRAVEL_STARS, carry, jupiterTurn, smooth } from '../handoff.ts';
import { TRAVEL_SKY } from '../space/skyFrame.ts';
import type { Vec3 } from '../handoff.ts';

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

const ORIGIN: Vec3 = [0, 0, 0];
const ENGINE = { current: 0.45 };
const DIR_08 = new THREE.Vector3(...LIGHT_08.direction).normalize();
const DIR_10 = new THREE.Vector3(...LIGHT_10.direction).normalize();
const LC = {
  key08: new THREE.Color(LIGHT_08.color),
  key10: new THREE.Color(LIGHT_10.color),
  sky08: new THREE.Color(LIGHT_08.sky),
  sky10: new THREE.Color(LIGHT_10.sky),
  ground08: new THREE.Color(LIGHT_08.ground),
  ground10: new THREE.Color(LIGHT_10.ground),
};

/**
 * Saturn, its rings and ring dust. Also drawn by SC08, ahead of the ship as it leaves Jupiter
 * (handoff.ts); there the bands stay dark, as at SC09's start.
 */
export function SaturnSystem({
  position = ORIGIN,
  onRings,
  sun = SUN_DIR,
}: {
  position?: Vec3;
  /** direction to the Sun (SC10's look back lights it from the Sun on screen) */
  sun?: THREE.Vector3;
  /** receives the ring material (SC09 lights its bands from it) */
  onRings?: (rings: THREE.ShaderMaterial) => void;
}) {
  const planet = useMemo(() => createSaturnMaterial(sun), [sun]);
  const rings = useMemo(
    () => createRingMaterial(sun, SATURN.radius, SATURN.ringInner, SATURN.ringOuter, BAND_RANGES),
    [sun],
  );
  useDisposeOnUnmount(planet, rings);
  const ringGeo = useMemo(
    () => new THREE.RingGeometry(SATURN.ringInner, SATURN.ringOuter, 192, 1),
    [],
  );
  useDisposeOnUnmount(ringGeo);
  useEffect(() => onRings?.(rings), [rings, onRings]);
  return (
    <group position={[...position]} rotation={[0, 0, SATURN.tilt]}>
      <mesh material={planet}>
        <sphereGeometry args={[SATURN.radius, 96, 64]} />
      </mesh>
      <mesh geometry={ringGeo} material={rings} rotation={[-Math.PI / 2, 0, 0]} />
      <RingDust />
    </group>
  );
}

/** Jupiter behind, where SC08 left it relative to the ship (handoff.ts), receding as we arrive. */
const JUPITER_BEHIND = carry(SHIP_START, JUPITER.position, SHIP_EXIT);

const BEHIND = new THREE.Vector3(...JUPITER_BEHIND);
const FROM = new THREE.Vector3(...SHIP_START);

/** Jupiter recedes as the ship flies on: pushed out along its line from the ship's start. */
function JupiterBehind({ id, frame }: ChapterSceneProps) {
  const gl = useThree((s) => s.gl);
  const map = useLoader(getKTX2Loader(gl), '/assets/textures/jupiter_2k.ktx2');
  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
  }, [map]);
  const haze = useMemo(() => createRimMaterial('#f0cfa0', 0.45, 2.4), []);
  useDisposeOnUnmount(haze);
  const planet = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (planet.current) planet.current.rotation.y = jupiterTurn(clock.elapsedTime);
    if (frame.id !== id || !group.current) return;
    // 1× at the boundary (as SC08 left it), 3.2× as far once the ship has arrived
    const k = 1 + 2.2 * smooth(frame.t / 0.45);
    group.current.position.copy(BEHIND).sub(FROM).multiplyScalar(k).add(FROM);
  });
  return (
    <group ref={group} position={[...JUPITER_BEHIND]}>
      <mesh ref={planet} rotation={[0.12, 0.6, 0.05]}>
        <sphereGeometry args={[JUPITER.radius, 96, 64]} />
        <meshStandardMaterial map={map} roughness={1} metalness={0} />
      </mesh>
      <mesh material={haze}>
        <sphereGeometry args={[JUPITER.radius * 1.05, 48, 32]} />
      </mesh>
    </group>
  );
}

function SaturnScene({ id, frame }: ChapterSceneProps) {
  const bands = useRef<number[]>([0, 0, 0, 0, 0]);
  const onRings = useCallback((rings: THREE.ShaderMaterial) => {
    // the uniform array is mutated in place each frame (no allocation)
    bands.current = rings.uniforms['uBand']?.value as number[];
  }, []);
  const ship = useRef<THREE.Group>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.HemisphereLight>(null);
  const hole = useRef<THREE.Group>(null);
  useFrame(() => {
    if (frame.id !== id) return;
    for (let i = 0; i < bands.current.length; i += 1) bands.current[i] = bandLevel(i, frame.t);
    if (ship.current) saturnShip(frame.t, ship.current.position);
    if (hole.current) hole.current.visible = frame.t >= HOLE_FROM;
    // the ship arrives in Jupiter's light and leaves in SC10's (the planet lights itself)
    const w = smooth((frame.t - LEAVE) / (1 - LEAVE));
    if (key.current) {
      key.current.position.copy(DIR_08).lerp(DIR_10, w).normalize().multiplyScalar(300);
      key.current.color.copy(LC.key08).lerp(LC.key10, w);
      key.current.intensity = LIGHT_08.intensity + (LIGHT_10.intensity - LIGHT_08.intensity) * w;
    }
    if (fill.current) {
      fill.current.color.copy(LC.sky08).lerp(LC.sky10, w);
      fill.current.groundColor.copy(LC.ground08).lerp(LC.ground10, w);
      fill.current.intensity = LIGHT_08.ambient + (LIGHT_10.ambient - LIGHT_08.ambient) * w;
    }
  });
  return (
    <group>
      <Starfield {...TRAVEL_STARS} follow orient={TRAVEL_SKY} />
      {/* the ship keeps the light it had leaving Jupiter (the planet's shaders light themselves) */}
      <directionalLight ref={key} />
      <hemisphereLight ref={fill} />
      <SaturnSystem onRings={onRings} />
      <JupiterBehind id={id} frame={frame} />
      <group ref={hole} visible={false}>
        <DistantBlackHole
          position={HOLE_AHEAD}
          // SC10 opens with the lens already magnifying the hole about 1.6×; match its apparent size
          radius={holeRadiusAt(0) * 1.6}
          size={HOLE_RADIUS}
          open={gateOpen(0)}
        />
      </group>
      <HelVela ref={ship} engine={ENGINE} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

export const sc09Saturn: ChapterImpl = {
  Scene: SaturnScene,
  shot: saturnShot,
  background: '#010208',
};
