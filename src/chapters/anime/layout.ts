import type { AreaId } from './anime.ts';

/**
 * SC11 world layouts (no React; unit-tested). Each world is a whole landscape the ship flies
 * *through*: the ship keeps the flight line x = 0, y = 0 (keel), z 0 → -220, and the ground sits
 * below it, filled out to the horizon, where the haze dissolves it into the sky.
 *
 *   discipline: the Hidden Leaf village (one model: gate, river, main street, tower, stone faces)
 *   proof:      the West Street town (A049), its street extended by the rural set (A050), with
 *               Kinnaird House closing the vista
 *   horizon:    a farm valley (A048 tiles) under blossom trees, Tanjiro and friends on the road
 *
 * Everything is seeded: the same layout on every load, so frames and tests are reproducible.
 */

export function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Ground height below the flight line (the ship keel flies at y = 0). */
export const GROUND: Readonly<Record<AreaId, number>> = {
  discipline: -34,
  proof: -10,
  horizon: -30,
};

/** The ship's hull envelope round the flight line (HelVela II: 12.6 m beam, 6.3 m tall). */
export const SHIP_ENVELOPE = { halfWidth: 7, bottom: -0.5, top: 7 } as const;

/** An axis-aligned building block, centre x/z, base y, size w (x) × d (z) × h. */
export interface Block {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
}

// ── Discipline: the Hidden Leaf village ──────────────────────────────────────

const VILLAGE_YAW = Math.PI / 4;
const VILLAGE_SCALE = 160;
/**
 * The model's own measurements, after turning it 45° so its main axis runs along -z: the street
 * level, the axis (gate → bridge → street → Hokage tower → faces) and the cliff face.
 */
const VILLAGE_SOURCE = { axisX: -1.17, faceZ: -4.7, street: -0.085 } as const;
/** Where those sit in the chapter: the axis just right of the flight line, the faces far ahead. */
const VILLAGE_AT = { axisX: 10, faceZ: -360 } as const;

export const VILLAGE = {
  scale: VILLAGE_SCALE,
  yaw: VILLAGE_YAW,
  position: [
    VILLAGE_AT.axisX - VILLAGE_SOURCE.axisX * VILLAGE_SCALE,
    GROUND.discipline - VILLAGE_SOURCE.street * VILLAGE_SCALE,
    VILLAGE_AT.faceZ - VILLAGE_SOURCE.faceZ * VILLAGE_SCALE,
  ] as const,
  /** the forest plane: over the model's outer water ring, under its beach and its river */
  forestFloor: GROUND.discipline - 0.1 * VILLAGE_SCALE,
  /** the village island's middle and the radius the forest starts beyond */
  island: { x: 20, z: -285, radius: 385 },
} as const;

export interface CastSpot {
  readonly who: 'sage' | 'itachi' | 'jiraiya' | 'pain' | 'obito' | 'tanjiro' | 'nezuko' | 'inosuke';
  /** feet, chapter frame: always on solid ground (tested in layout.test.ts) */
  readonly position: readonly [number, number, number];
  /** metres tall: about two storeys at the village's scale, so they read from the ship */
  readonly size: number;
  /** towards the oncoming ship */
  readonly rotationY: number;
}

/**
 * The Hidden Leaf's people, gathered on the open street before the inner gate and looking back at
 * the ship. Street heights measured on the model. Nobody hovers (Raju, 2026-11-27).
 */
export const VILLAGE_CAST: readonly CastSpot[] = [
  { who: 'sage', position: [14, -35.25, -170], size: 13, rotationY: -0.05 },
  { who: 'jiraiya', position: [7, -34.4, -186], size: 14, rotationY: 0.02 },
  { who: 'itachi', position: [25, -35.3, -194], size: 13, rotationY: -0.18 },
  { who: 'pain', position: [1, -34.4, -203], size: 13, rotationY: 0.06 },
  { who: 'obito', position: [34, -35.3, -204], size: 14, rotationY: -0.23 },
];

/** The forest filling the land round the island, out to the painted ranges. */
export const FOREST_TREES = (() => {
  const rand = seeded(41);
  const out: Array<{ x: number; y: number; z: number; s: number }> = [];
  const { x, z, radius } = VILLAGE.island;
  while (out.length < 380) {
    const a = rand() * Math.PI * 2;
    // denser near the island's edge, where each crown is seen
    const r = radius + rand() ** 1.6 * 330;
    out.push({
      x: x + Math.cos(a) * r,
      y: VILLAGE.forestFloor,
      z: z + Math.sin(a) * r,
      s: 0.8 + rand() * 0.8,
    });
  }
  return out;
})();

// ── Proof: the town ──────────────────────────────────────────────────────────

/**
 * West Street (A049) placement. Measured from the source (scripts/optimize-anime.ts output):
 * the main street runs along -z at x ≈ 691…751 (centre 721), its floor at y = 22, with the
 * buildings between z ≈ -370 and -820. Scale 0.75 makes the street 45 m wide and the false fronts
 * 20–43 m tall, so the 60 m ship flies down the street between them, 10 m above the dirt.
 */
export const TOWN = {
  scale: 0.75,
  position: [-721 * 0.75, GROUND.proof - 22 * 0.75, 330 * 0.75] as const,
  /** the street's half-width between the facades, in chapter metres */
  street: 22,
} as const;

/** The rural set (A050): building node, side, distance along -z; they extend the street. */
export interface RuralSpot {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** yaw so the front faces the street */
  readonly rotY: number;
}
export const RURAL_SCALE = 3.4;
const RURAL_NAMES = [
  'Rural_WoodenBuilding_1',
  'Rural_StoreSmall_4',
  'Rural_Diner_1',
  'Rural_StoreSmall_8',
  'Rural_WoodenBuilding_4',
  'Rural_StoreSmall_2',
  'Rural_HouseOld_1',
  'Rural_StoreSmall_6',
  'Rural_WoodenBuilding_2',
  'Rural_QuonsetHut_1',
  'Rural_StoreSmall_5',
  'Rural_Diner_2',
  'Rural_WoodenBuilding_5',
  'Rural_StoreSmall_1',
  'Rural_WoodenBuilding_3',
  'Rural_StoreSmall_7',
] as const;
export const RURAL: readonly RuralSpot[] = RURAL_NAMES.map((name, i) => {
  const side = i % 2 ? 1 : -1;
  const rank = Math.floor(i / 2);
  return {
    name,
    x: side * (TOWN.street + 22 + (rank % 2) * 6),
    z: -385 - rank * 30,
    rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
  };
});

export const KINNAIRD = { x: 0, z: -660, size: 90 } as const;
/** Ryuk, standing in the open street, low enough for the ship to pass over. */
export const RYUK = { x: 8, y: -9.6, z: -103, size: 8.6 } as const;
/** The notebook, dropped on the sand at Ryuk's feet. */
export const DEATH_NOTE = { x: 13, y: -9.5, z: -104, size: 3 } as const;

// ── Horizon: the farm valley ─────────────────────────────────────────────────

/** Farm tiles (A048) down both sides of the road; `low` drops the far half. */
export interface FarmTile {
  readonly x: number;
  readonly z: number;
  readonly rotY: number;
  readonly far: boolean;
}
export const FARM_SIZE = 100;
export const FARMS: readonly FarmTile[] = [
  { x: -80, z: 10, rotY: Math.PI / 2, far: false },
  { x: 80, z: -40, rotY: -Math.PI / 2, far: false },
  { x: 70, z: -150, rotY: Math.PI, far: false },
  { x: -72, z: -225, rotY: 0, far: false },
  { x: 80, z: -280, rotY: -Math.PI / 2, far: true },
  { x: -80, z: -410, rotY: Math.PI / 2, far: true },
  { x: 72, z: -540, rotY: Math.PI, far: true },
  { x: -72, z: -560, rotY: 0, far: true },
];
/** The farm's footprint at FARM_SIZE (source 37.5 × 49.8, longest side along z). */
export const FARM_FOOTPRINT = { x: FARM_SIZE * (37.5 / 49.8), z: FARM_SIZE } as const;

/** The Demon Slayer three on the road ahead, facing the oncoming ship (it passes overhead). */
export const VALLEY_CAST: readonly CastSpot[] = [
  { who: 'inosuke', position: [-4, -30, -204], size: 14, rotationY: 0.12 },
  { who: 'tanjiro', position: [5, -30, -192], size: 15, rotationY: 0.08 },
  { who: 'nezuko', position: [13, -30, -202], size: 13, rotationY: 0.0 },
];

/** Tanjiro's sword stand, set down on the grass beside them. */
export const SWORD_STAND = { position: [-17, -30, -196] as const, size: 12 } as const;

/** Blossom trees lining the road, then scattered across the fields. */
export const ROAD_TREES = (() => {
  const rand = seeded(57);
  const out: Array<{ x: number; y: number; z: number; s: number }> = [];
  for (let z = 120; z > -760; z -= 15 + rand() * 6)
    for (const side of [-1, 1]) {
      const x = side * (21 + rand() * 4);
      out.push({ x, y: GROUND.horizon, z, s: 0.85 + rand() * 0.4 });
    }
  return out;
})();
export const FIELD_TREES = scatter(61, 220, {
  minX: 130,
  maxX: 560,
  z0: 160,
  z1: -900,
  y: GROUND.horizon,
});

/** Crop patches between the farms and the mountains (flat coloured fields). */
export const FIELDS = (() => {
  const rand = seeded(67);
  const out: Array<{ x: number; z: number; w: number; d: number; c: number }> = [];
  for (let i = 0; i < 110; i += 1) {
    const side = rand() < 0.5 ? -1 : 1;
    out.push({
      x: side * (125 + rand() * 420),
      z: 140 - rand() * 1000,
      w: 40 + rand() * 60,
      d: 40 + rand() * 70,
      c: Math.floor(rand() * 4),
    });
  }
  return out;
})();

// ── shared ───────────────────────────────────────────────────────────────────

/** Seeded points on both sides of the flight line, |x| in [minX, maxX]. */
export function scatter(
  seed: number,
  count: number,
  o: { minX: number; maxX: number; z0: number; z1: number; y: number },
): ReadonlyArray<{ x: number; y: number; z: number; s: number }> {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => {
    const side = rand() < 0.5 ? -1 : 1;
    return {
      x: side * (o.minX + rand() * (o.maxX - o.minX)),
      y: o.y,
      z: o.z0 + rand() * (o.z1 - o.z0),
      s: 0.7 + rand() * 0.8,
    };
  });
}

/** A ring of mountains closing every world's horizon (seeded per world). */
export function mountainRing(seed: number, count: number, radius: number) {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + rand() * 0.1;
    const r = radius * (0.85 + rand() * 0.3);
    return {
      x: Math.cos(a) * r,
      z: -260 + Math.sin(a) * r,
      h: 140 + rand() * 200,
      w: 160 + rand() * 160,
    };
  });
}

/**
 * Transitions between worlds (voyage.ts): a world sinks away below as the ship climbs out of it,
 * and the next rises up out of its planet's clouds. 0 = gone (DROP below), 1 = in place.
 */
export const DROP = 520;
