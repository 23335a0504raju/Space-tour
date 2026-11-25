import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { createAtmosphereMaterial, createEarthMaterial } from '../../shaders/earth.ts';
import { Astronaut } from '../astronaut/Astronaut.tsx';
import type { Drive } from '../astronaut/Astronaut.tsx';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield } from '../greybox/parts.tsx';
import { TRAVEL_STARS } from '../handoff.ts';
import { TRAVEL_SKY } from '../space/skyFrame.ts';
import { HelVela } from '../ship/HelVela.tsx';
import { LunarMoon } from './LunarMoon.tsx';
import {
  BEACON,
  DECK,
  EARTH,
  SUN,
  astronautX,
  astronautYaw,
  beaconRise,
  homecomingShot,
  walkWeight,
  walkedDistance,
  HANDOFF,
  handoffWeight,
} from './homecoming.ts';

/** SC13 · Homecoming & Final Transmission (FINAL_STORYLINE SC13). Earth maps: NASA (A021, A022). */
const TEX = {
  day: '/assets/textures/earth_day_2k.ktx2',
  night: '/assets/textures/earth_night_2k.ktx2',
} as const;
const ENGINE = { current: 0.1 };
const SUN_DIR = new THREE.Vector3(...SUN).normalize();
const GOLD = new THREE.Color('#d6a756').multiplyScalar(2);

/** Drive the astronaut from t only (steps out, walks, stands, turns to the camera). */
const drive: Drive = (t, api, body) => {
  body.position.set(DECK.x + astronautX(t), DECK.y, DECK.z);
  body.rotation.set(0, astronautYaw(t), 0);
  const w = walkWeight(t);
  const walkLen = api.duration('walk');
  api.set('walk', api.walkSpeed > 0 ? (walkedDistance(t) / api.walkSpeed) % walkLen : 0, w);
  // standing pose = the end of the stand-up clip
  api.set('standUp', api.duration('standUp'), 1 - w);
};

const tmp = {
  pos: new THREE.Vector3(),
  from: new THREE.Vector3(),
  sun: new THREE.Vector3(),
};
/** Earth's map orientation: this chapter's, and SC12's turned a quarter (handoff). */
const ROT_13 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 1.9, 0));
const ROT_12 = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
  .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 1.0, 0)));
/** The shared flight sky, turned into this chapter's frame (SC12's -z heading is -x here). */
const SKY_13 = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
  .multiply(TRAVEL_SKY);

function HomecomingScene({ id, frame }: ChapterSceneProps) {
  const gl = useThree((s) => s.gl);
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const [dayMap, nightMap] = useLoader(getKTX2Loader(gl), [TEX.day, TEX.night]);
  if (!dayMap || !nightMap) throw new Error('SC13: textures missing');
  useLayoutEffect(() => {
    for (const t of [dayMap, nightMap]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    }
  }, [dayMap, nightMap]);
  const { earth, atmosphere } = useMemo(() => {
    const e = createEarthMaterial(dayMap, nightMap, low);
    const a = createAtmosphereMaterial();
    (e.uniforms['uSun']?.value as THREE.Vector3).copy(SUN_DIR);
    (a.uniforms['uSun']?.value as THREE.Vector3).copy(SUN_DIR);
    return { earth: e, atmosphere: a };
  }, [dayMap, nightMap, low]);
  const pulse = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    [],
  );
  useDisposeOnUnmount(earth, atmosphere, pulse);

  const beacon = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const globe = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  useFrame(({ clock }) => {
    // SC12's Earth and sun at the boundary, settling into this chapter's (handoff)
    if (frame.id === id && globe.current && shell.current) {
      const w = handoffWeight(frame.t);
      tmp.pos.set(...EARTH.position).lerp(tmp.from.set(...HANDOFF.earth), w);
      const r = EARTH.radius + (HANDOFF.earthRadius - EARTH.radius) * w;
      globe.current.position.copy(tmp.pos);
      globe.current.scale.setScalar(r / EARTH.radius);
      globe.current.quaternion.copy(ROT_13).slerp(ROT_12, w);
      shell.current.position.copy(tmp.pos);
      shell.current.scale.setScalar(r / EARTH.radius);
      tmp.sun
        .copy(SUN_DIR)
        .lerp(tmp.from.set(...HANDOFF.sun).normalize(), w)
        .normalize();
      (earth.uniforms['uSun']!.value as THREE.Vector3).copy(tmp.sun);
      (atmosphere.uniforms['uSun']!.value as THREE.Vector3).copy(tmp.sun);
      sun.current?.position.copy(tmp.sun).multiplyScalar(100);
    }
    if (frame.id === id && beacon.current) {
      const k = beaconRise(frame.t);
      beacon.current.scale.setScalar(Math.max(k, 0.001));
      beacon.current.visible = k > 0.001;
    }
    // ambient: the beacon pulses outward
    const p = (clock.elapsedTime * 0.5) % 1;
    ring.current?.scale.setScalar(0.3 + p * 3.2);
    pulse.opacity = 0.2 * (1 - p);
  });

  return (
    <group>
      <Starfield {...TRAVEL_STARS} follow orient={SKY_13} />
      <mesh ref={globe} position={[...EARTH.position]} rotation={[0.3, 1.9, 0]} material={earth}>
        <sphereGeometry args={[EARTH.radius, low ? 64 : 128, low ? 48 : 96]} />
      </mesh>
      <mesh ref={shell} position={[...EARTH.position]} material={atmosphere}>
        <sphereGeometry args={[EARTH.radius * 1.03, 64, 48]} />
      </mesh>
      <directionalLight
        ref={sun}
        position={[SUN_DIR.x * 100, SUN_DIR.y * 100, SUN_DIR.z * 100]}
        color="#fff1dc"
        intensity={3}
      />
      {/* earthshine fills the hull from below */}
      <hemisphereLight args={['#3a5f9a', '#0a0c12', 0.8]} />

      <pointLight
        position={[DECK.x + 1, DECK.y + 3, 4]}
        intensity={40}
        distance={16}
        color="#dfe8ff"
      />
      <HelVela engine={ENGINE} rotation={[0, 0, 0]} />

      {/* the exterior deck on the hull top, with rails */}
      <group position={[DECK.x, DECK.y, DECK.z]}>
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[DECK.halfX * 2, 0.2, DECK.halfZ * 2]} />
          <meshStandardMaterial color="#59606d" metalness={0.5} roughness={0.5} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, 0.55, s * DECK.halfZ]}>
            <boxGeometry args={[DECK.halfX * 2, 0.05, 0.05]} />
            <meshStandardMaterial color="#d6a756" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[DECK.halfX * 2 - 0.4, 0.02, 0.1]} />
          <meshBasicMaterial
            color={new THREE.Color('#4fd8ff').multiplyScalar(1.1)}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* the beacon: a mast with a golden light and an outward pulse */}
      <group ref={beacon} position={[DECK.x + BEACON.x, DECK.y, BEACON.z]} visible={false}>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.04, 0.07, 1.5, 10]} />
          <meshStandardMaterial color="#c9ccd3" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.58, 0]}>
          <sphereGeometry args={[0.1, 16, 12]} />
          <meshBasicMaterial color={GOLD} toneMapped={false} />
        </mesh>
        <mesh ref={ring} position={[0, 1.58, 0]} material={pulse}>
          <sphereGeometry args={[0.4, 24, 16]} />
        </mesh>
      </group>

      <Suspense fallback={null}>
        <Astronaut chapterId={id} frame={frame} drive={drive} variant="eva" />
      </Suspense>
      {/* the final transmission: the Moon beside the contact card */}
      <Suspense fallback={null}>
        <LunarMoon id={id} frame={frame} />
      </Suspense>
    </group>
  );
}

export const sc13Transmission: ChapterImpl = {
  Scene: HomecomingScene,
  shot: homecomingShot,
  background: '#020308',
};
