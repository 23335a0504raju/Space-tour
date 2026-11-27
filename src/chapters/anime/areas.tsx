import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ChapterImpl, ChapterSceneProps, JourneyFrame } from '../contract.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { HelVela } from '../ship/HelVela.tsx';
import { AREAS, ORDER, areaShot, entrySky, shipZ } from './anime.ts';
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
  FOREST_TREES,
  GROUND,
  KINNAIRD,
  ROAD_TREES,
  RURAL,
  RURAL_SCALE,
  RYUK,
  SWORD_STAND,
  TOWN,
  VALLEY_CAST,
  VILLAGE,
  VILLAGE_CAST,
} from './layout.ts';
import type { CastSpot } from './layout.ts';
import {
  Clouds,
  PaintedSun,
  PaintedRange,
  LightRoad,
  Motes,
  RingedPlanet,
  SkyDome,
} from './parts.tsx';
import { Fields, Ground, ModelPart, PaintedGround, Strip, Trees, Village } from './world.tsx';
import { VoyageSky } from './Voyage.tsx';
import { arrival, presence, shipPitch, spaceAt, voyageAt } from './voyage.ts';

/**
 * SC11 · The Anime-Inspired Universe: three whole worlds crossed in one continuous flight
 * (FINAL_STORYLINE SC11). The ship flies through each one: down a village street, down the main
 * street of a frontier town, along a blossom road through farmland (layout.ts). The screen-space
 * style pass (style 2) turns everything into cel colour with ink outlines. Between worlds the ship
 * leaves one planet and flies to the next (voyage.ts, Voyage.tsx). Everything is a function of t;
 * only the drifting motes are ambient.
 */
/** Engine glow cruising low over a world; it opens up for the crossing. */
const CRUISE = 0.45;
const SUN_DIR = new THREE.Vector3(0.5, 0.45, 0.7).normalize().multiplyScalar(100);
/** How much further than their world the painted ranges fall (m). */
const RANGE_SINK = 1500;
/** Open space: the sky every world fades into overhead as the air runs out (horizon → zenith). */
const SPACE_SKY = ['#1c1546', '#120f35', '#0a0824', '#050416'].map((c) => new THREE.Color(c));
const SPACE_LIGHT = new THREE.Color('#dfe4ff');
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

// ── Discipline: the Hidden Leaf village ──────────────────────────────────────

/**
 * The painted ranges, level with the ship. As the world is left or reached they fall further than
 * the world itself, out of the frame, so none is left standing round the planet. (The flat ground
 * needs no such help: fully hazed, it is the sky behind it, haze.ts.)
 */
function Ranges({
  area,
  frame,
  id,
  children,
}: {
  area: AreaId;
  frame: JourneyFrame;
  id: string;
  children: ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (frame.id !== id || !g.current) return;
    // cubed: nothing shifts against the buildings while the world is still close
    const sink = (1 - presence(area, frame.t)) ** 3 * RANGE_SINK;
    g.current.position.set(0, -sink, shipZ(frame.t));
  });
  return <group ref={g}>{children}</group>;
}

/** The characters placed in a world (layout.ts), facing the oncoming ship. */
function Cast({
  list,
  haze,
  frame,
  id,
}: {
  list: readonly CastSpot[];
  haze: Haze;
  frame: JourneyFrame;
  id: string;
}) {
  return (
    <>
      {list.map((c) => (
        <AnimeModel
          key={c.who}
          url={ANIME_MODELS[c.who]}
          size={c.size}
          position={c.position}
          rotationY={c.rotationY}
          haze={haze}
          id={id}
          frame={frame}
        />
      ))}
    </>
  );
}

function Discipline({ frame, id, haze, paint }: WorldProps) {
  const g = GROUND.discipline;
  return (
    <>
      {/* painted ranges on the horizon: a pale far range and a nearer forested one */}
      <Ranges area="discipline" frame={frame} id={id}>
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
      </Ranges>
      {/* the forest floor round the village island (it covers the model's outer water ring) */}

      <Ground y={VILLAGE.forestFloor} color="#4d7d45" haze={haze} />
      <Trees
        items={FOREST_TREES}
        crowns={['#4f9e4a', '#3f8a52', '#74b455', '#2f7048']}
        size={1.5}
        haze={haze}
        painted
      />

      <Village url={ANIME_MODELS.village} haze={haze} paint={paint} />
      <Cast list={VILLAGE_CAST} haze={haze} frame={frame} id={id} />
      {/* leaves drifting over the roofs */}
      <Motes count={140} box={[160, 70, 520]} center={[0, g + 45, -180]} color="#bfe27a" seed={4} />
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
      <Ranges area="proof" frame={frame} id={id}>
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
      </Ranges>
      {/* Ryuk standing in the street, the notebook at their feet */}
      <AnimeModel
        url={ANIME_MODELS.ryuk}
        size={RYUK.size}
        position={[RYUK.x, RYUK.y, RYUK.z]}
        rotationY={-0.65}
        haze={haze}
        id={id}
        frame={frame}
      />
      <AnimeModel
        url={ANIME_MODELS.deathNote}
        size={DEATH_NOTE.size}
        fit="max"
        position={[DEATH_NOTE.x, DEATH_NOTE.y, DEATH_NOTE.z]}
        rotationY={0.5}
        haze={haze}
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
      <Ranges area="horizon" frame={frame} id={id}>
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
      </Ranges>
      {/* Tanjiro, Nezuko and Inosuke on the road, their sword stand on the grass beside them */}
      <Cast list={VALLEY_CAST} haze={haze} frame={frame} id={id} />
      <AnimeModel
        url={ANIME_MODELS.katana}
        size={SWORD_STAND.size}
        fit="max"
        position={SWORD_STAND.position}
        rotationY={0.35}
        haze={haze}
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
  /** the painted materials' shared uniforms (the village and the frontier town) */
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
const tmpSky = new THREE.Color();

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
  const previous = ORDER[ORDER.indexOf(area) - 1];
  const next = ORDER[ORDER.indexOf(area) + 1];
  function AreaScene({ id, frame }: ChapterSceneProps) {
    const ship = useRef<THREE.Group>(null);
    const planets = useRef<THREE.Group>(null);
    const engine = useMemo(() => ({ current: CRUISE }), []);
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
    useFrame(() => {
      if (frame.id !== id) return;
      const t = frame.t;
      const z = shipZ(t);
      const voyage = voyageAt(area, t);
      const space = spaceAt(voyage);
      ship.current?.position.set(0, 0, z);
      ship.current?.rotation.set(shipPitch(voyage), 0, 0);
      engine.current = CRUISE + 0.55 * space;
      dome.current?.position.set(0, 0, z);
      light.current?.position.set(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z + z);
      sunTarget.position.set(0, 0, z);
      // the world's own sky and light, turning to open space on the way to its neighbours (both
      // sides of a boundary are fully in space, so the join cannot be seen)
      const own = SKY_COLORS[area];
      // SC11-A opens on SC10's sunset palette and turns to day
      const e = own.entrySky ? entrySky(t) : 1;
      for (let i = 0; i < 4; i += 1) {
        tmpSky.copy(own.sky[i]!);
        if (own.entrySky) tmpSky.copy(tmpColor.copy(own.entrySky[i]!).lerp(tmpSky, e));
        live.current[i]!.copy(tmpSky).lerp(SPACE_SKY[i]!, space);
      }
      if (light.current) {
        light.current.color.copy(own.light);
        if (own.entryLight)
          light.current.color.copy(tmpColor.copy(own.entryLight).lerp(light.current.color, e));
        light.current.color.lerp(SPACE_LIGHT, space);
      }
      fill.current?.groundColor.copy(live.current[1]!);
      horizonColor(live.current, haze.color.value);
      for (let i = 0; i < 4; i += 1) haze.sky.value[i]!.copy(live.current[i]!);
      // the world rises into place round the ship, and sinks away below it
      const k = presence(area, t);
      if (world.current) {
        world.current.visible = k > 0.002;
        world.current.position.y = -(1 - k) * DROP;
      }
      paint.drop.value = -(1 - k) * DROP;
      // a leaving world also sinks into the air: its ground is lost in the horizon colour before
      // the planet's cloud cover comes up through it (no flat land left round the globe)
      haze.near.value = HAZE_NEAR * k;
      haze.far.value = 40 + (HAZE_FAR - 40) * k;
      // the painted sun of the first world leaves with it
      if (sun.current) {
        sun.current.scale.setScalar(t < 0.5 ? 1 : Math.max(k, 0.001));
        // at infinity: it travels with the ship (at t = 0 it sits exactly where SC10 left it)
        sun.current.position.z = SUN_BEYOND[2] + 220 + z;
      }
      // the ringed planets of the last world come into view with it
      if (planets.current) {
        const a = arrival(area, t);
        planets.current.visible = a > 0.002;
        planets.current.position.set(0, -(1 - a) * DROP * 0.35, 0);
      }
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
        <VoyageSky area={area} previous={previous} next={next} frame={frame} id={id} />
        {area === 'horizon' && (
          <group ref={planets} visible={false}>
            <HorizonPlanets />
          </group>
        )}
        <group ref={ship}>
          <HelVela engine={engine} rotation={[0, -Math.PI / 2, 0]} />
        </group>
      </group>
    );
  }
  return {
    Scene: AreaScene,
    shot: (t, out) => areaShot(area, t, out),
    background: def.sky[1],
  };
}

export const sc11aDiscipline = makeArea('discipline');
export const sc11bProof = makeArea('proof');
export const sc11cHorizon = makeArea('horizon');
