import { ORDER } from './anime.ts';
import type { AreaId } from './anime.ts';

/**
 * The voyage between two SC11 worlds (no React; unit-tested). Each world is a planet: the ship
 * climbs out of it, the world sinks under its cloud cover and the cover curves away into a globe;
 * the ship crosses open space past it while the next planet grows ahead, dives to that planet's
 * clouds, and the new world rises out of them. One continuous flight, no fade and no cut.
 *
 * A join runs across the boundary of two chapters on one parameter u (0..1): the leaving chapter
 * plays u = 0..0.5 over its last stretch, the arriving one u = 0.5..1 over its first. Both draw the
 * same picture at the same u, relative to the ship, so the boundary cannot be seen.
 */

/** The leaving world starts its climb at this local t. */
export const EXIT = 0.76;
/** The arriving world is in place at this local t. */
export const ENTRY = 0.22;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const span = (x: number, a: number, b: number) => smooth((x - a) / (b - a));

export interface Voyage {
  /** index of the join: between ORDER[join] and ORDER[join + 1] */
  readonly join: number;
  readonly u: number;
}

/** Where a chapter is in a voyage, or null while it is simply flying through its own world. */
export function voyageAt(area: AreaId, t: number): Voyage | null {
  const i = ORDER.indexOf(area);
  if (i > 0 && t < ENTRY) return { join: i - 1, u: 0.5 + 0.5 * clamp01(t / ENTRY) };
  if (i < ORDER.length - 1 && t > EXIT)
    return { join: i, u: 0.5 * clamp01((t - EXIT) / (1 - EXIT)) };
  return null;
}

/**
 * How far a world has arrived, 0..1. The first world rises as SC10's cloud deck sinks; the others
 * rise out of their planet's clouds at the end of a voyage.
 */
export function arrival(area: AreaId, t: number): number {
  if (ORDER.indexOf(area) === 0) return smooth(t / 0.18);
  const v = t < ENTRY ? voyageAt(area, t) : null;
  return v ? span(v.u, 0.74, 0.98) : 1;
}

/**
 * How much of a world is still there as it is left, 1..0. It sinks as the ship climbs away; the
 * last one hands over to SC12's clear sky.
 */
export function departure(area: AreaId, t: number): number {
  if (ORDER.indexOf(area) === ORDER.length - 1) return smooth((1 - t) / 0.16);
  const v = t > EXIT ? voyageAt(area, t) : null;
  return v ? 1 - span(v.u, 0.02, 0.3) : 1;
}

/** How present a world is, 0..1 (the world group sits DROP × (1 − presence) below its place). */
export const presence = (area: AreaId, t: number) => arrival(area, t) * departure(area, t);

/** How far the sky has turned into open space, 0..1. 1 across every chapter boundary of a join. */
export const spaceAt = (v: Voyage | null) =>
  v ? span(v.u, 0.06, 0.34) * (1 - span(v.u, 0.7, 0.94)) : 0;

/** The ship's nose: up as it climbs away, down as it dives to the next planet (radians). */
export function shipPitch(v: Voyage | null): number {
  if (!v) return 0;
  const climb = Math.sin(Math.PI * clamp01(v.u / 0.44));
  const dive = Math.sin(Math.PI * clamp01((v.u - 0.56) / 0.44));
  return 0.2 * climb - 0.16 * dive;
}

// ── the planets ──────────────────────────────────────────────────────────────

/** A planet's place relative to the ship: [u, x, y, z, radius]. */
type Key = readonly [number, number, number, number, number];

/**
 * The planet being left. It starts out of sight under the world, comes up as the cloud cover under
 * the ship (its top at y −45), then falls away down and to the left as a globe.
 */
const LEAVING: readonly Key[] = [
  [0, 0, -1650, -200, 900],
  [0.19, 0, -945, -200, 900],
  [0.3, -30, -800, -270, 640],
  [0.42, -130, -450, -330, 300],
  [0.5, -190, -330, -280, 220],
  [0.64, -280, -360, -110, 200],
  [0.8, -420, -520, 220, 180],
];

/** The planet ahead: a far point of light that grows into the next world's cloud cover. */
const AHEAD: readonly Key[] = [
  [0.18, 190, 170, -1060, 0],
  [0.34, 135, 105, -950, 70],
  [0.5, 80, 28, -700, 140],
  [0.64, 30, -230, -560, 310],
  [0.75, 0, -740, -330, 720],
  [0.82, 0, -945, -200, 900],
  [1, 0, -1650, -200, 900],
];

export interface PlanetState {
  visible: boolean;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export const createPlanetState = (): PlanetState => ({
  visible: false,
  x: 0,
  y: 0,
  z: 0,
  radius: 0,
});

/**
 * Catmull-Rom through the keys with uneven spacing: the planet never stops at a key, which a
 * segment-by-segment ease would do (a visible stutter in a continuous flight).
 */
function sample(keys: readonly Key[], u: number, out: PlanetState): void {
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  out.visible = u >= first[0] && u <= last[0];
  const x = Math.min(last[0], Math.max(first[0], u));
  let i = 0;
  while (i < keys.length - 2 && x > keys[i + 1]![0]) i += 1;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const h = b[0] - a[0];
  const s = (x - a[0]) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  for (let k = 1; k <= 4; k += 1) {
    const slope = (j: number) => {
      const p = keys[Math.max(0, j - 1)]!;
      const n = keys[Math.min(keys.length - 1, j + 1)]!;
      return (n[k]! - p[k]!) / (n[0] - p[0]);
    };
    const v =
      (2 * s3 - 3 * s2 + 1) * a[k]! +
      (s3 - 2 * s2 + s) * h * slope(i) +
      (-2 * s3 + 3 * s2) * b[k]! +
      (s3 - s2) * h * slope(i + 1);
    if (k === 1) out.x = v;
    else if (k === 2) out.y = v;
    else if (k === 3) out.z = v;
    else out.radius = Math.max(0, v);
  }
  out.visible &&= out.radius > 0.5;
}

export const leavingPlanet = (u: number, out: PlanetState) => sample(LEAVING, u, out);
export const aheadPlanet = (u: number, out: PlanetState) => sample(AHEAD, u, out);

/** How much cloud covers a planet: all of it under the ship, parting as it becomes a globe. */
export const cloudCover = (radius: number) => span(radius, 240, 760);
