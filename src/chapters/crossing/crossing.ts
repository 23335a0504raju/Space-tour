import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';
import { LOOK_BACK } from './solarSystem.ts';

/**
 * SC10 The Edge & The Crossing story maths (no React; unit-tested). The ship flies down -z through
 * the quiet edge of the system, the gate, a tunnel, and out into a painted sky. The art-style blend
 * (realistic → ink line art → cel colour) is a pure function of t, so scrolling back un-draws it.
 */
export const TRAVEL = 220;
export const shipZ = (t: number) => -Math.min(1, Math.max(0, t)) * TRAVEL;

export const GATE = { z: -110, radius: 14 } as const;
export const TUNNEL = { start: -110, end: -200, radius: 11 } as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);
const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));

/** Story time at which the ship passes the gate / leaves the tunnel. */
export const T_GATE = -GATE.z / TRAVEL;
export const T_EXIT = -TUNNEL.end / TRAVEL;

/**
 * 0 realistic · 1 ink line art · 2 cel colour. The fall itself is real (lensing, darkness, a light at
 * the end); the world is only re-drawn as the ship breaks out into the light.
 */
export const styleAt = (t: number) => span(t, 0.74, 0.84) + span(t, 0.84, T_EXIT);

/** The disk is already blazing when the story begins; it brightens a little on approach. */
export const gateOpen = (t: number) => 0.9 + 0.1 * span(t, 0, 0.3);

const BACK = LOOK_BACK.toArray() as [number, number, number];
const rel: ShotKey[] = [
  // the join from SC09 (handoff.ts): behind the ship, the hole a dim ring ahead
  { t: 0, position: [18, 6, 52], target: [0, 0, -60], fov: 48 },
  // the look back (Raju, 2026-11-22): round past the bow to the Sun and the planets behind us
  { t: 0.07, position: [30, 9, 4], target: [BACK[0] * 0.5, BACK[1] * 0.5, BACK[2] * 0.5], fov: 54 },
  { t: 0.13, position: [-12, 6, -30], target: BACK, fov: 62 },
  { t: 0.2, position: [-15, 7, -33], target: BACK, fov: 62 },
  // and forward again to the hole, much larger now
  { t: 0.3, position: [22, 8, 54], target: [0, 0, -50], fov: 50 },
  { t: 0.48, position: [14, 6, 46], target: [0, 0, -50], fov: 54 },
  { t: 0.7, position: [4, 5, 40], target: [0, 0, -50], fov: 60 },
  { t: 0.9, position: [-14, 7, 46], target: [0, 2, -40], fov: 54 },
  { t: 1, position: [-22, 9, 52], target: [0, 3, -30], fov: 50 },
];

export function crossingShot(t: number, out: ShotState): void {
  sampleKeys(rel, t, out);
  const z = shipZ(t);
  out.position.z += z;
  out.target.z += z;
}

/** The hole starts as a distant dim ring and swells as the ship closes in: you watch it grow, then it takes the ship. */
export const holeRadiusAt = (t: number) => 3 + 13 * span(t, 0, 0.42);
/** The hole's full size (its quad is built for it; smaller radii scale it down). */
export const HOLE_RADIUS = 16;
