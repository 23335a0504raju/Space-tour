import * as THREE from 'three';
import { createShotState, sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';
import { CHASE_08_09, CHASE_09_10, blendShot, carry, chaseShot, run, smooth } from '../handoff.ts';
import { GATE } from '../crossing/crossing.ts';
import type { Vec3 } from '../handoff.ts';

/**
 * SC09 Saturn story data (no React; unit-tested). The planet sits at the origin, the ring plane is
 * XZ (tilted slightly), the Sun is behind the planet, so the whole scene is backlit. Band
 * highlights and the camera are pure functions of story time t.
 */
export const SATURN = { radius: 40, ringInner: 54, ringOuter: 112, tilt: 0.1 } as const;
/** Direction to the Sun: behind and a little above the planet, as seen from the camera. */
export const SUN = [-0.3, 0.22, -1] as const;

/** Radial ranges (0 = inner edge, 1 = outer edge), one per stack group; the gap sits between 3 and 4. */
export const BAND_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 0.2],
  [0.2, 0.4],
  [0.4, 0.58],
  [0.62, 0.8],
  [0.8, 1],
];
export const GAP: readonly [number, number] = [0.58, 0.62];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);

/** Highlight level 0..1 of band `i`: they light one after another and all stay lit at the rest point. */
export const bandLevel = (i: number, t: number) => ease(clamp01((t - (0.14 + i * 0.1)) / 0.1));

const keys: ShotKey[] = [
  // edge-on from far away: a thin line across the planet
  { t: 0, position: [0, 1.5, 270], target: [0, 0, 0], fov: 38 },
  // the camera rises and the rings open up
  { t: 0.45, position: [34, 42, 215], target: [-8, 0, 0], fov: 40 },
  // rest point: the whole ring system open, planet on the right of the left-hand panel
  { t: 0.75, position: [60, 92, 150], target: [-24, -4, 0], fov: 44 },
  { t: 1, position: [72, 118, 112], target: [-24, -6, 0], fov: 46 },
];

/**
 * The ship arrives from Jupiter (handoff.ts): it opens behind the chase camera exactly where SC08
 * left it, slows, and holds off the rings while the camera rises.
 */
export const SHIP_START: Vec3 = [-12, -10.5, 200];
export const SHIP_PARK: Vec3 = [-34, -14, 105];
export const ARRIVE = 0.3;
/** On toward the edge of the system: up over the rings and past the planet. */
export const SHIP_EXIT: Vec3 = [-150, 60, -260];
export const LEAVE = 0.84;
export function saturnShip(t: number, out: THREE.Vector3): THREE.Vector3 {
  if (t <= ARRIVE) return run(SHIP_START, SHIP_PARK, t / ARRIVE, 'out', out);
  if (t < LEAVE) return out.set(...SHIP_PARK);
  return run(SHIP_PARK, SHIP_EXIT, (t - LEAVE) / (1 - LEAVE), 'in', out);
}
/** SC10's black hole (on its flight line, GATE.z ahead of its ship) carried into this frame. */
export const HOLE_AHEAD: Vec3 = carry(SHIP_EXIT, [0, 0, GATE.z], [0, 0, 0]);
/** The hole is drawn only for the way out (from the end of the rest point, out of shot). */
export const HOLE_FROM = 0.8;

const ship = new THREE.Vector3();
const chase = createShotState();
export function saturnShot(t: number, out: ShotState): void {
  sampleKeys(keys, t, out);
  // the opening chases the ship (as SC08 ended), then hands over to the keys
  saturnShip(t, ship);
  const w = 1 - smooth((t - 0.04) / 0.2);
  if (w > 0) {
    chaseShot(ship, CHASE_08_09, chase);
    blendShot(out, chase, w);
  }
  // the way out: behind the ship again, the black hole ahead, exactly as SC10 opens
  const leaving = smooth((t - LEAVE) / 0.1);
  if (leaving > 0) {
    chaseShot(ship, CHASE_09_10, chase);
    blendShot(out, chase, leaving);
  }
}
