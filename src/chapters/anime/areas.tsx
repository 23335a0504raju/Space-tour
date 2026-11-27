import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ChapterImpl, ChapterSceneProps, JourneyFrame } from '../contract.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { HelVela } from '../ship/HelVela.tsx';
import { AREAS, areaShot, cloudSea, entrySky, presence, shipZ, skyMix } from './anime.ts';
import type { AreaId } from './anime.ts';
import { PAINTED_CLOUDS, SUN_BEYOND } from './clouds.ts';
import { ANIME_MODELS, AnimeModel } from './AnimeModel.tsx';
import { createHaze, horizonColor } from './haze.ts';
import type { Haze } from './haze.ts';
import { createPaint } from './painted.ts';
import type { Paint } from './painted.ts';
import {
  DEATH_NOTE,
  DROP,
  FARMS,
  FARM_SIZE,
  FIELDS,
  FIELD_TREES,
  GROUND,
  HILL,
  ICHIRAKU,
  KINNAIRD,
  NARUTO_TOWER,
  ROAD_TREES,
  RURAL,
  RURAL_SCALE,
  RYUK,
  STREET,
  TORII_Z,
  TOWN,
  VILLAGE_HOUSES,
  VILLAGE_ROOFS,
  VILLAGE_TREES,
  VILLAGE_WALLS,
} from './layout.ts';
import {
  Clouds,
  PaintedSun,
  PaintedRange,
  LightRoad,
  Motes,
  RingedPlanet,
  SkyDome,
  Torii,
} from './parts.tsx';
import {
  CloudSea,
  Fields,
  Ground,
  Houses,
  ModelPart,
  PaintedGround,
  Strip,
  Trees,
} from './world.tsx';

/**
 * SC11 · The Anime-Inspired Universe: three whole worlds crossed in one continuous flight
 * (FINAL_STORYLINE SC11). The ship flies through each one: down a village street, down the main
 * street of a frontier town, along a blossom road through farmland (layout.ts). The screen-space
 * style pass (style 2) turns everything into cel colour with ink outlines. Between worlds the ship
 * climbs through a sea of cloud while one world sinks away and the next rises (anime.ts presence,
 * cloudSea). Spin, bob and cloud drift are ambient; everything else is a function of t.
 */
const ENGINE = { current: 0.45 };
const SUN_DIR = new THREE.Vector3(0.5, 0.45, 0.7).normalize().multiplyScalar(100);
/** The cloud sea's level (below every world's ground while that world is in place). */
const SEA_LEVEL = -42;
/** Haze band (m from the camera) while a world is fully present. */
const HAZE_NEAR = 180;
const HAZE_FAR = 1500;

/** The SC10 cloud deck, sinking away as the ship climbs out of it (a pure function of t). */
function CloudDeck({ frame, id }: { frame: JourneyFrame; id: string }) {
  const g = useRef<THREE.Group>(null);
  // the deck dissolves as it sinks (its tops used to poke up through the village street)
  const opacity = useMemo(() => ({ current: 1 }), []);
  useFrame(() => {
    if (frame.id !== id || !g.current) return;
    const k = Math.min(1, Math.max(0, (frame.t - 0.08) / 0.32));
    g.current.position.set(0, -110 * k * k * (3 - 2 * k), 220);
    const f = Math.min(1, Math.max(0, (frame.t - 0.08) / 0.12));
    opacity.current = 1 - f * f * (3 - 2 * f);
  });
  return (
    <group ref={g} position={[0, 0, 220]}>
      <Clouds items={PAINTED_CLOUDS} opacity={opacity} />
    </group>
  );
}

// ── Discipline: the lantern village ──────────────────────────────────────────

/** Keeps its children level with the ship (things on the horizon: painted ranges). */
function FollowShip({
  frame,
  id,
  children,
}: {
  frame: JourneyFrame;
  id: string;
  children: ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (frame.id === id && g.current) g.current.position.z = shipZ(frame.t);
  });
  return <group ref={g}>{children}</group>;
}

function Discipline({ frame, id, haze }: WorldProps) {
  const g = GROUND.discipline;
  return (
    <>
      {/* painted ranges on the horizon: a pale far range and a nearer forested one */}
      <FollowShip frame={frame} id={id}>
        <PaintedRange
          radius={1000}
          y={g - 90}
          height={440}
          lit="#a3c0ea"
          shadow="#6a8cc8"
          haze={haze}
          seed={3}
          freq={2.0}
          low={0.32}
          high={0.95}
          aerial={0.18}
        />
        <PaintedRange
          radius={760}
          y={g - 60}
          height={250}
          lit="#74b277"
          shadow="#3d6f69"
          haze={haze}
          seed={9}
          freq={3.2}
          low={0.18}
          high={0.72}
          aerial={0.04}
          soft={2}
        />
      </FollowShip>
      <Ground y={g} color="#e9c7a0" haze={haze} />
      <Strip y={g} halfWidth={STREET - 4} from={160} to={-900} color="#d9a77f" haze={haze} />
      <Houses houses={VILLAGE_HOUSES} walls={VILLAGE_WALLS} roofs={VILLAGE_ROOFS} haze={haze} />
      <Trees
        items={VILLAGE_TREES}
        crowns={['#6fbf6a', '#f2a7b8', '#9ad27f', '#4f9e62']}
        size={1.6}
        haze={haze}
        painted
      />
      {/* the gates the ship flies through */}
      {TORII_Z.map((z) => (
        <Torii key={z} position={[0, g, z]} scale={1.6} />
      ))}
      {/* Ichiraku Ramen on the street, Naruto on the watch tower across from it */}
      <AnimeModel
        url={ANIME_MODELS.ichiraku}
        size={ICHIRAKU.size}
        fit="max"
        position={[ICHIRAKU.x, g, ICHIRAKU.z]}
        rotationY={Math.PI / 2}
        haze={haze}
        cull
        id={id}
        frame={frame}
      />
      <mesh position={[NARUTO_TOWER.x, g + NARUTO_TOWER.h / 2, NARUTO_TOWER.z]}>
        <cylinderGeometry args={[NARUTO_TOWER.r, NARUTO_TOWER.r * 1.15, NARUTO_TOWER.h, 10]} />
        <meshStandardMaterial color="#efd2b0" roughness={1} flatShading />
      </mesh>
      <AnimeModel
        url={ANIME_MODELS.naruto}
        size={14}
        position={[NARUTO_TOWER.x, g + NARUTO_TOWER.h, NARUTO_TOWER.z]}
        rotationY={-Math.PI / 3}
        haze={haze}
        id={id}
        frame={frame}
      />
      {/* paper lanterns drifting down the street */}
      <Motes count={180} box={[44, 30, 900]} center={[0, g + 18, -350]} color="#ffd08a" seed={4} />
    </>
  );
}

// ── Proof: the frontier town ─────────────────────────────────────────────────

function Proof({ frame, id, haze, paint }: WorldProps) {
  const g = GROUND.proof;
  return (
    <>
      {/* the desert floor beyond the town's own terrain (just below it, so the town wins) */}
      <PaintedGround y={g - 0.4} width={5000} from={2200} to={-2800} haze={haze} paint={paint} />
      <AnimeModel
        url={ANIME_MODELS.town}
        size={TOWN.scale}
        fit="none"
        position={TOWN.position}
        haze={haze}
        paint={paint}
        cull
        id={id}
        frame={frame}
      />
      {/* the street runs on past the town: the rural set lines it out to Kinnaird House */}
      {RURAL.map((r) => (
        <ModelPart
          key={r.name}
          url={ANIME_MODELS.rural}
          name={r.name}
          scale={RURAL_SCALE}
          position={[r.x, g - 0.4, r.z]}
          rotationY={r.rotY}
          haze={haze}
          paint={paint}
        />
      ))}
      <AnimeModel
        url={ANIME_MODELS.kinnaird}
        size={KINNAIRD.size}
        fit="max"
        position={[KINNAIRD.x, g, KINNAIRD.z]}
        haze={haze}
        cull
        id={id}
        frame={frame}
      />
      {/* painted ranges: warm sandstone buttes far off, sage hills nearer */}
      <FollowShip frame={frame} id={id}>
        <PaintedRange
          radius={1000}
          y={g - 100}
          height={420}
          lit="#dba57c"
          shadow="#a2705f"
          haze={haze}
          seed={11}
          freq={2.6}
          low={0.3}
          high={0.82}
          aerial={0.25}
        />
        <PaintedRange
          radius={760}
          y={g - 70}
          height={230}
          lit="#b8b27c"
          shadow="#7b7a60"
          haze={haze}
          seed={17}
          freq={3.4}
          low={0.16}
          high={0.55}
          aerial={0.06}
          soft={2}
        />
      </FollowShip>
      {/* Ryuk watching from above the rooftops; the notebook drifting beside the ship */}
      <AnimeModel
        url={ANIME_MODELS.ryuk}
        size={RYUK.size}
        position={[RYUK.x, RYUK.y, RYUK.z]}
        rotationY={-Math.PI / 2.4}
        bob={0.8}
        haze={haze}
        id={id}
        frame={frame}
      />
      <AnimeModel
        url={ANIME_MODELS.deathNote}
        size={DEATH_NOTE.size}
        fit="max"
        position={[DEATH_NOTE.x, DEATH_NOTE.y, DEATH_NOTE.z]}
        spin={0.5}
        bob={0.5}
        id={id}
        frame={frame}
      />
      <Motes count={120} box={[120, 50, 700]} center={[0, g + 25, -300]} color="#fff4dc" seed={9} />
    </>
  );
}

// ── Horizon: the blossom valley ──────────────────────────────────────────────

function Horizon({ frame, id, haze }: WorldProps) {
  const g = GROUND.horizon;
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const farms = low ? FARMS.filter((f) => !f.far) : FARMS;
  return (
    <>
      <Ground y={g} color="#8ea477" haze={haze} />
      <Strip y={g} halfWidth={8} from={160} to={-900} color="#d8b08a" haze={haze} />
      <LightRoad y={g + 0.4} from={150} to={-880} step={11} color="#ffd23f" />
      <Fields
        items={FIELDS}
        y={g}
        colors={['#b9c97a', '#d8c07a', '#9cbf86', '#c7d9a0']}
        haze={haze}
      />
      {farms.map((f) => (
        <AnimeModel
          key={`${f.x},${f.z}`}
          url={ANIME_MODELS.farm}
          size={FARM_SIZE}
          fit="max"
          position={[f.x, g, f.z]}
          rotationY={f.rotY}
          haze={haze}
          cull
          id={id}
          frame={frame}
        />
      ))}
      <Trees
        items={ROAD_TREES}
        crowns={['#f6a8c8', '#f8c0d6', '#ef93b8']}
        size={1.1}
        haze={haze}
        painted
      />
      <Trees
        items={FIELD_TREES}
        crowns={['#f6a8c8', '#7fb07a', '#f8c0d6', '#94c27f']}
        size={1.5}
        haze={haze}
        painted
      />
      {/* painted ranges at dusk: blue-violet peaks far off, green hills nearer */}
      <FollowShip frame={frame} id={id}>
        <PaintedRange
          radius={1000}
          y={g - 90}
          height={450}
          lit="#958bd8"
          shadow="#5c4e9c"
          haze={haze}
          seed={23}
          freq={2.2}
          low={0.3}
          high={0.95}
          aerial={0.22}
        />
        <PaintedRange
          radius={760}
          y={g - 60}
          height={240}
          lit="#6f9c74"
          shadow="#3e5e5d"
          haze={haze}
          seed={29}
          freq={3}
          low={0.15}
          high={0.6}
          aerial={0.05}
          soft={2}
        />
      </FollowShip>
      {/* the blossom hill: Tanjiro and Nezuko look out over the road */}
      <mesh position={[HILL.x, g - HILL.radius + HILL.height, HILL.z]} scale={[1, 1, 1]}>
        <sphereGeometry args={[HILL.radius, 16, 10]} />
        <meshStandardMaterial color="#9cc08a" roughness={1} flatShading />
      </mesh>
      <AnimeModel
        url={ANIME_MODELS.tanjiro}
        size={32}
        position={[HILL.x - 5, g + HILL.height - 0.6, HILL.z + 2]}
        rotationY={-0.35}
        haze={haze}
        id={id}
        frame={frame}
      />
      <AnimeModel
        url={ANIME_MODELS.nezuko}
        size={26}
        position={[HILL.x + 6, g + HILL.height - 0.8, HILL.z - 1]}
        rotationY={-0.15}
        haze={haze}
        id={id}
        frame={frame}
      />
      <AnimeModel
        url={ANIME_MODELS.katana}
        size={13}
        fit="max"
        position={[-14, 14, -120]}
        spin={0.6}
        bob={0.6}
        id={id}
        frame={frame}
      />
      <Motes count={300} box={[400, 140, 900]} center={[0, 30, -350]} color="#ffffff" seed={13} />
    </>
  );
}

interface WorldProps {
  readonly frame: JourneyFrame;
  readonly id: string;
  readonly haze: Haze;
  /** the painted materials' shared uniforms (the frontier town) */
  readonly paint: Paint;
}

function World({ area, ...props }: WorldProps & { area: AreaId }): ReactNode {
  if (area === 'discipline') return <Discipline {...props} />;
  if (area === 'proof') return <Proof {...props} />;
  return <Horizon {...props} />;
}

const SKY_COLORS = Object.fromEntries(
  (Object.keys(AREAS) as AreaId[]).map((a) => [
    a,
    {
      sky: AREAS[a].sky.map((c) => new THREE.Color(c)),
      light: new THREE.Color(AREAS[a].light),
      entrySky: AREAS[a].entrySky?.map((c) => new THREE.Color(c)),
      entryLight: AREAS[a].entryLight ? new THREE.Color(AREAS[a].entryLight) : undefined,
    },
  ]),
) as Record<
  AreaId,
  { sky: THREE.Color[]; light: THREE.Color; entrySky?: THREE.Color[]; entryLight?: THREE.Color }
>;
const tmpColor = new THREE.Color();

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
    const world = useRef<THREE.Group>(null);
    const fill = useRef<THREE.HemisphereLight>(null);
    const sunTarget = useMemo(() => new THREE.Object3D(), []);
    const haze = useMemo(() => createHaze(HAZE_NEAR, HAZE_FAR), []);
    const sun = useRef<THREE.Group>(null);
    const paint = useMemo(() => createPaint(GROUND[area], SUN_DIR), []);
    const live = useMemo(
      () => ({ current: [0, 1, 2, 3].map(() => new THREE.Color()) as THREE.Color[] }),
      [],
    );
    const sea = useMemo(
      () => ({ opacity: { current: 0 }, tint: { current: new THREE.Color() }, z: { current: 0 } }),
      [],
    );
    useFrame(() => {
      if (frame.id !== id) return;
      const t = frame.t;
      const z = shipZ(t);
      ship.current?.position.set(0, 0, z);
      dome.current?.position.set(0, 0, z);
      light.current?.position.set(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z + z);
      sunTarget.position.set(0, 0, z);
      // sky and light meet the neighbouring world halfway at each boundary (anime.ts)
      const m = skyMix(area, t);
      for (let i = 0; i < 4; i += 1)
        live.current[i]!.copy(SKY_COLORS[m.a].sky[i]!).lerp(SKY_COLORS[m.b].sky[i]!, m.k);
      light.current?.color.copy(SKY_COLORS[m.a].light).lerp(SKY_COLORS[m.b].light, m.k);
      // a world that opens on its neighbour's palette turns to its own (SC11-A: sunset to day)
      const entry = SKY_COLORS[area];
      if (entry.entrySky && entry.entryLight) {
        const e = entrySky(t);
        for (let i = 0; i < 4; i += 1)
          live.current[i]!.copy(tmpColor.copy(entry.entrySky[i]!).lerp(live.current[i]!, e));
        light.current?.color.copy(tmpColor.copy(entry.entryLight).lerp(light.current.color, e));
      }
      fill.current?.groundColor.copy(live.current[1]!);
      horizonColor(live.current, haze.color.value);
      for (let i = 0; i < 4; i += 1) haze.sky.value[i]!.copy(live.current[i]!);
      // the world rises into place round the ship, and sinks away below the cloud sea
      const k = presence(t);
      if (world.current) {
        world.current.visible = k > 0.002;
        world.current.position.y = -(1 - k) * DROP;
      }
      paint.drop.value = -(1 - k) * DROP;
      // a leaving world also dissolves into the horizon (no inked ground line left in the sky)
      haze.near.value = HAZE_NEAR * k;
      haze.far.value = 40 + (HAZE_FAR - 40) * k;
      // the painted sun of the first world leaves with it
      if (sun.current) {
        sun.current.scale.setScalar(t < 0.5 ? 1 : Math.max(k, 0.001));
        // at infinity: it travels with the ship (at t = 0 it sits exactly where SC10 left it)
        sun.current.position.z = SUN_BEYOND[2] + 220 + z;
      }
      sea.opacity.current = cloudSea(area, t);
      sea.tint.current.copy(live.current[1]!);
      sea.z.current = z;
    });
    return (
      <group>
        <group ref={dome}>
          <SkyDome colors={def.sky} live={live} painted />
        </group>
        <directionalLight ref={light} target={sunTarget} color={def.light} intensity={2.6} />
        <primitive object={sunTarget} />
        <hemisphereLight ref={fill} args={['#ffffff', def.sky[1], 1.1]} />
        {area === 'discipline' && (
          <>
            {/* the SC10 sky continues: same clouds and sun, shifted into this frame */}
            <CloudDeck frame={frame} id={id} />
            <PaintedSun
              ref={sun}
              radius={34}
              position={[SUN_BEYOND[0], SUN_BEYOND[1], SUN_BEYOND[2] + 220]}
            />
          </>
        )}
        <group ref={world} visible={false}>
          <World area={area} frame={frame} id={id} haze={haze} paint={paint} />
        </group>
        <CloudSea
          level={SEA_LEVEL}
          opacity={sea.opacity}
          tint={sea.tint}
          haze={haze}
          follow={sea.z}
        />
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
