import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ChapterImpl, ChapterSceneProps, JourneyFrame } from '../contract.ts';
import { HelVela } from '../ship/HelVela.tsx';
import { AREAS, areaShot, shipZ } from './anime.ts';
import type { AreaId } from './anime.ts';
import { PAINTED_CLOUDS, SUN_BEYOND } from './clouds.ts';
import {
  Clouds,
  Island,
  LightRoad,
  Motes,
  RingStack,
  RingedPlanet,
  SkyDome,
  Spire,
  Torii,
} from './parts.tsx';

/**
 * SC11 · The Anime-Inspired Universe: three themed areas crossed in one continuous flight
 * (FINAL_STORYLINE SC11; ANIME_UNIVERSE_FRAMEWORK, structure only). The worlds are generic stand-ins
 * built from flat-shaded primitives; the screen-space style pass (style 2) turns them into cel
 * colour with ink outlines. Spin and shimmer are ambient; everything else is a function of t.
 */
const ENGINE = { current: 0.45 };
const SUN_DIR = new THREE.Vector3(0.5, 0.45, 0.7).normalize().multiplyScalar(100);

/** The SC10 cloud deck, sinking away as the ship climbs out of it (a pure function of t). */
function CloudDeck({ frame, id }: { frame: JourneyFrame; id: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (frame.id !== id || !g.current) return;
    const k = Math.min(1, Math.max(0, (frame.t - 0.08) / 0.32));
    g.current.position.set(0, -110 * k * k * (3 - 2 * k), 220);
  });
  return (
    <group ref={g} position={[0, 0, 220]}>
      <Clouds items={PAINTED_CLOUDS} />
    </group>
  );
}

/** Each area's landmarks, in the chapter frame (ship flies from z = 0 to z = -220). */
function Landmarks({
  area,
  frame,
  id,
}: {
  area: AreaId;
  frame: JourneyFrame;
  id: string;
}): ReactNode {
  if (area === 'discipline') {
    return (
      <>
        {/* the SC10 sky continues: same clouds and sun, shifted into this frame */}
        <CloudDeck frame={frame} id={id} />
        <mesh position={[SUN_BEYOND[0], SUN_BEYOND[1], SUN_BEYOND[2] + 220]}>
          <sphereGeometry args={[34, 24, 16]} />
          <meshBasicMaterial color={new THREE.Color(2.2, 1.7, 1.2)} toneMapped={false} />
        </mesh>
        {/* a processional line of gates to fly through, then the mandala beside the flight line */}
        {[-70, -105, -140, -175].map((z) => (
          <Torii key={z} position={[0, -6, z]} scale={0.95} />
        ))}
        <RingStack
          position={[-55, 10, -125]}
          radius={36}
          colors={['#d6443f', '#f6efe4', '#2b2440', '#f2b8a2']}
        />
        <Island position={[-58, -22, -60]} radius={20} grass="#f0b8a8" rock="#8a5a6a" />
        <Island position={[50, -18, -160]} radius={26} grass="#f6d2b0" rock="#8a5a6a" />
        <Motes count={160} box={[160, 60, 240]} center={[0, 8, -110]} color="#fff0c8" seed={4} />
      </>
    );
  }
  if (area === 'proof') {
    return (
      <>
        <Island position={[55, -8, -110]} radius={30} grass="#9fe0a8" rock="#6a7a98" />
        <Spire position={[55, -6, -110]} height={46} />
        <Island position={[88, 12, -160]} radius={20} grass="#c8e68a" rock="#6a7a98" />
        <Spire position={[88, 14, -160]} height={30} color="#ffe9a8" />
        <Island position={[34, 24, -60]} radius={12} grass="#9fe0a8" rock="#6a7a98" tree={false} />
        <Island position={[-55, -18, -70]} radius={22} grass="#8fd18a" rock="#6a7a98" />
        <Island position={[-48, 6, -175]} radius={16} grass="#c8e68a" rock="#6a7a98" tree={false} />
        <Clouds
          items={[
            { p: [-30, -34, -40], s: 14 },
            { p: [10, -40, -110], s: 20 },
            { p: [60, -42, -190], s: 16 },
            { p: [-70, -38, -150], s: 18 },
          ]}
        />
        <Motes count={100} box={[170, 70, 240]} center={[10, 6, -110]} color="#ffffff" seed={9} />
      </>
    );
  }
  return (
    <>
      <RingedPlanet position={[-95, 22, -330]} radius={40} />
      <RingedPlanet position={[110, 38, -150]} radius={14} body="#a8d8f0" ring="#ffffff" />
      <LightRoad y={-14} from={-10} to={-230} step={9} color="#ffd23f" />
      <Motes count={420} box={[300, 160, 320]} center={[0, 20, -120]} color="#ffffff" seed={13} />
      <Island position={[40, -26, -90]} radius={18} grass="#b9a6ee" rock="#4a3a78" />
      <Island position={[-30, -30, -190]} radius={22} grass="#cbb8f4" rock="#4a3a78" />
    </>
  );
}

function makeArea(area: AreaId): ChapterImpl {
  const def = AREAS[area];
  function AreaScene({ id, frame }: ChapterSceneProps) {
    const ship = useRef<THREE.Group>(null);
    const dome = useRef<THREE.Group>(null);
    const light = useRef<THREE.DirectionalLight>(null);
    const sunTarget = useMemo(() => new THREE.Object3D(), []);
    useFrame(() => {
      if (frame.id !== id) return;
      const z = shipZ(frame.t);
      ship.current?.position.set(0, 0, z);
      dome.current?.position.set(0, 0, z);
      light.current?.position.set(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z + z);
      sunTarget.position.set(0, 0, z);
    });
    return (
      <group>
        <group ref={dome}>
          <SkyDome colors={def.sky} />
        </group>
        <directionalLight ref={light} target={sunTarget} color={def.light} intensity={2.6} />
        <primitive object={sunTarget} />
        <hemisphereLight args={['#ffffff', def.sky[1], 1.1]} />
        <Landmarks area={area} frame={frame} id={id} />
        <HelVela ref={ship} engine={ENGINE} rotation={[0, -Math.PI / 2, 0]} />
      </group>
    );
  }
  return {
    Scene: AreaScene,
    shot: (t, out) => areaShot(area, t, out),
    background: def.sky[1],
    // a warm white flash carries the visitor from one area to the next
    exitColor: '#fff3e2',
  };
}

export const sc11aDiscipline = makeArea('discipline');
export const sc11bProof = makeArea('proof');
export const sc11cHorizon = makeArea('horizon');
