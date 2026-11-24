import type { AreaId } from './anime.ts';

/**
 * SC11 world layouts (no React; unit-tested). Each world is a whole landscape the ship flies
 * *through*: the ship keeps the flight line x = 0, y = 0 (keel), z 0 → -220, and the ground sits
 * below it, filled out to the horizon, where the haze dissolves it into the sky.
 *
 *   discipline: a lantern village street (procedural houses and towers round Ichiraku)
 *   proof:      the West Street town (A049), its street extended by the rural set (A050), with
 *               Kinnaird House closing the vista
 *   horizon:    a farm valley (A048 tiles) under blossom trees, Tanjiro and Nezuko on the hill
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
  discipline: -30,
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

// ── Discipline: the village ──────────────────────────────────────────────────

export interface House extends Block {
  readonly tower: boolean;
  /** palette indices (wall, roof) */
  readonly wall: number;
  readonly roof: number;
}

export const VILLAGE_WALLS = ['#f4e3c8', '#efd2b0', '#f7ead8', '#e8c9a8', '#f2dcc0'] as const;
export const VILLAGE_ROOFS = ['#d6443f', '#e0703a', '#4f8f9a', '#b8504a', '#6a8fb8'] as const;

/** Where the hero props stand in the village (kept clear of houses). */
export const ICHIRAKU = { x: -40, z: -125, size: 34 } as const;
export const NARUTO_TOWER = { x: 40, z: -205, h: 26, r: 7 } as const;
export const TORII_Z = [-40, -175, -320] as const;
/** Street half-width: the first row of houses starts beyond it. */
export const STREET = 21;

export const VILLAGE_HOUSES: readonly House[] = (() => {
  const rand = seeded(31);
  const out: House[] = [];
  for (const side of [-1, 1])
    for (let row = 0; row < 5; row += 1) {
      let z = 90 - rand() * 20;
      while (z > -820) {
        const tower = row > 0 && rand() < 0.2;
        const w = tower ? 14 + rand() * 6 : 16 + rand() * 12;
        const d = tower ? w : 14 + rand() * 10;
        const h = tower ? 34 + rand() * 22 : row === 0 ? 10 + rand() * 12 : 12 + rand() * 18;
        const x = side * (STREET + w / 2 + 3 + row * 40 + rand() * 8);
        const clearIchiraku = Math.hypot(x - ICHIRAKU.x, z - ICHIRAKU.z) > 34;
        const clearTower = Math.hypot(x - NARUTO_TOWER.x, z - NARUTO_TOWER.z) > 22;
        if (clearIchiraku && clearTower)
          out.push({
            x,
            y: GROUND.discipline,
            z,
            w,
            d,
            h,
            tower,
            wall: Math.floor(rand() * VILLAGE_WALLS.length),
            roof: Math.floor(rand() * VILLAGE_ROOFS.length),
          });
        z -= d + 6 + rand() * 10;
      }
    }
  return out;
})();

/** Round-crowned trees filling the village's back rows and the hills (x beyond the houses). */
export const VILLAGE_TREES = scatter(41, 320, {
  minX: 60,
  maxX: 520,
  z0: 160,
  z1: -900,
  y: GROUND.discipline,
});

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
export const RYUK = { x: 40, y: 14, z: -110, size: 20 } as const;
export const DEATH_NOTE = { x: 9, y: 12, z: -58, size: 6 } as const;

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

/**
 * The hill where Tanjiro and Nezuko stand, right of the road ahead: at the rest point the ship's
 * bow fills the left of the frame and the panel the right, so they stand in the gap between, facing
 * the oncoming ship (the hill's top is at y = GROUND + height = 0).
 */
export const HILL = { x: 50, z: -380, radius: 40, height: 30 } as const;

/** Blossom trees lining the road, then scattered across the fields. */
export const ROAD_TREES = (() => {
  const rand = seeded(57);
  const out: Array<{ x: number; y: number; z: number; s: number }> = [];
  for (let z = 120; z > -760; z -= 15 + rand() * 6)
    for (const side of [-1, 1]) {
      const x = side * (21 + rand() * 4);
      const nearHill = Math.hypot(x - HILL.x, z - HILL.z) < HILL.radius + 4;
      if (!nearHill) out.push({ x, y: GROUND.horizon, z, s: 0.85 + rand() * 0.4 });
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
 * Transitions between worlds (handoff): a world sinks below a sea of cloud as the ship climbs out
 * of it, and the next rises up out of the same cloud. 0 = gone (DROP below), 1 = in place.
 */
export const DROP = 520;
