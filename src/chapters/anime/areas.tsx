import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ChapterImpl, ChapterSceneProps, JourneyFrame } from '../contract.ts';
import { HelVela } from '../ship/HelVela.tsx';
import { AREAS, areaShot, markScale, shipZ, skyMix } from './anime.ts';
import type { AreaId } from './anime.ts';
import { PAINTED_CLOUDS, SUN_BEYOND } from './clouds.ts';
import { ANIME_MODELS, AnimeModel } from './AnimeModel.tsx';
import { Clouds, Island, LightRoad, Motes, RingedPlanet, SkyDome, Spire, Torii } from './parts.tsx';

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
        {[-60, -215].map((z) => (
          <Torii key={z} position={[0, -6, z]} scale={0.95} />
        ))}
        {/* Ichiraku Ramen, then Naruto and Sasuke training, each on its own floating island */}
        <Island
          position={[-50, -9, -122]}
          radius={17}
          grass="#f0b8a8"
          rock="#8a5a6a"
          tree={false}
        />
        <AnimeModel
          url={ANIME_MODELS.ichiraku}
          size={19}
          fit="max"
          position={[-50, -7.3, -122]}
          rotationY={Math.PI / 3}
          id={id}
          frame={frame}
        />
        <Island
          position={[-44, -4, -190]}
          radius={15}
          grass="#f6d2b0"
          rock="#8a5a6a"
          tree={false}
        />
        <AnimeModel
          url={ANIME_MODELS.naruto}
          size={13}
          position={[-44, -2.5, -190]}
          rotationY={Math.PI / 4}
          id={id}
          frame={frame}
        />
        <Island position={[50, -18, -160]} radius={26} grass="#f6d2b0" rock="#8a5a6a" />
        <Motes count={160} box={[160, 60, 240]} center={[0, 8, -110]} color="#fff0c8" seed={4} />
      </>
    );
  }
  if (area === 'proof') {
    return (
      <>
        {/* the city (Kinnaird House) on its island, Ryuk drifting over it, the Death Note floating */}
        <Island position={[55, -8, -110]} radius={30} grass="#9fe0a8" rock="#6a7a98" tree={false} />
        <AnimeModel
          url={ANIME_MODELS.kinnaird}
          size={34}
          fit="max"
          position={[55, -5.2, -110]}
          rotationY={-Math.PI / 5}
          id={id}
          frame={frame}
        />
        <AnimeModel
          url={ANIME_MODELS.ryuk}
          size={20}
          position={[26, 8, -92]}
          rotationY={-Math.PI / 3}
          bob={0.8}
          id={id}
          frame={frame}
        />
        <AnimeModel
          url={ANIME_MODELS.deathNote}
          size={7}
          fit="max"
          position={[10, 4, -62]}
          spin={0.5}
          bob={0.5}
          id={id}
          frame={frame}
        />
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
      <LightRoad y={-14} from={-10} to={-230} step={9} color="#ffd23f" />
      <Motes count={420} box={[300, 160, 320]} center={[0, 20, -120]} color="#ffffff" seed={13} />
      {/* the farm below, Tanjiro and Nezuko on their island, the blossom katana turning in the air */}
      <Island position={[44, -26, -170]} radius={18} grass="#b9a6ee" rock="#4a3a78" tree={false} />
      <AnimeModel
        url={ANIME_MODELS.farm}
        size={32}
        fit="max"
        position={[44, -24.2, -170]}
        id={id}
        frame={frame}
      />
      <Island position={[16, -10, -138]} radius={13} grass="#cbb8f4" rock="#4a3a78" tree={false} />
      <AnimeModel
        url={ANIME_MODELS.tanjiro}
        size={14}
        position={[10, -8.7, -138]}
        rotationY={Math.PI / 5}
        id={id}
        frame={frame}
      />
      <AnimeModel
        url={ANIME_MODELS.nezuko}
        size={11}
        position={[22, -8.7, -140]}
        rotationY={Math.PI / 6}
        id={id}
        frame={frame}
      />
      <AnimeModel
        url={ANIME_MODELS.katana}
        size={13}
        fit="max"
        position={[0, 6, -122]}
        spin={0.6}
        bob={0.6}
        id={id}
        frame={frame}
      />
      <Island position={[-30, -30, -190]} radius={22} grass="#cbb8f4" rock="#4a3a78" />
    </>
  );
}

const SKY_COLORS = Object.fromEntries(
  (Object.keys(AREAS) as AreaId[]).map((a) => [
    a,
    { sky: AREAS[a].sky.map((c) => new THREE.Color(c)), light: new THREE.Color(AREAS[a].light) },
  ]),
) as Record<AreaId, { sky: THREE.Color[]; light: THREE.Color }>;

/** The ringed planets of the horizon (SC12 opens with the big one at the same place, handoff). */
export const HORIZON_PLANETS = {
  big: [-95, 22, -330] as const,
  small: [110, 38, -150] as const,
};
function HorizonPlanets() {
  return (
    <>
      <RingedPlanet position={HORIZON_PLANETS.big} radius={40} />
      <RingedPlanet position={HORIZON_PLANETS.small} radius={14} body="#a8d8f0" ring="#ffffff" />
    </>
  );
}

function makeArea(area: AreaId): ChapterImpl {
  const def = AREAS[area];
  function AreaScene({ id, frame }: ChapterSceneProps) {
    const ship = useRef<THREE.Group>(null);
    const dome = useRef<THREE.Group>(null);
    const light = useRef<THREE.DirectionalLight>(null);
    const marks = useRef<THREE.Group>(null);
    const fill = useRef<THREE.HemisphereLight>(null);
    const sunTarget = useMemo(() => new THREE.Object3D(), []);
    const live = useMemo(
      () => ({ current: [0, 1, 2, 3].map(() => new THREE.Color()) as THREE.Color[] }),
      [],
    );
    useFrame(() => {
      if (frame.id !== id) return;
      const z = shipZ(frame.t);
      ship.current?.position.set(0, 0, z);
      dome.current?.position.set(0, 0, z);
      light.current?.position.set(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z + z);
      sunTarget.position.set(0, 0, z);
      // sky and light meet the neighbouring world halfway at each boundary (anime.ts)
      const m = skyMix(area, frame.t);
      for (let i = 0; i < 4; i += 1)
        live.current[i]!.copy(SKY_COLORS[m.a].sky[i]!).lerp(SKY_COLORS[m.b].sky[i]!, m.k);
      light.current?.color.copy(SKY_COLORS[m.a].light).lerp(SKY_COLORS[m.b].light, m.k);
      fill.current?.groundColor.copy(live.current[1]!);
      // the world grows round the ship on the way in and shrinks away on the way out
      const k = markScale(area, frame.t);
      if (marks.current) {
        marks.current.visible = k > 0.002;
        marks.current.scale.setScalar(Math.max(k, 0.001));
        marks.current.position.set(0, 0, z * (1 - k));
      }
    });
    return (
      <group>
        <group ref={dome}>
          <SkyDome colors={def.sky} live={live} />
        </group>
        <directionalLight ref={light} target={sunTarget} color={def.light} intensity={2.6} />
        <primitive object={sunTarget} />
        <hemisphereLight ref={fill} args={['#ffffff', def.sky[1], 1.1]} />
        <group ref={marks}>
          <Landmarks area={area} frame={frame} id={id} />
        </group>
        {area === 'horizon' && <HorizonPlanets />}
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
