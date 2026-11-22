import type * as THREE from 'three';
import type { ShotState } from '../engine/camera/shots.ts';

/**
 * Continuous flight between chapters (Raju, 2026-11-22: "move from planet to planet, not screen
 * switching"). At a boundary both chapters show the same picture: the same ship at the same place
 * on screen, the same chase-camera offset, the next planet at the same vector from the ship, the
 * same sky (camera-centred stars with one seed, one DeepSky rotation) and the same light. The
 * chapter ending flies toward the next planet; the next chapter carries on the approach.
 *
 * Every frame of every chapter keeps its own axes (the ship heads down -z in all of them), so a
 * vector from the ship means the same thing on both sides of the boundary.
 */

export type Vec3 = readonly [number, number, number];

/** A camera pose relative to the ship: position and look-at offsets, and the lens. */
export interface Chase {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
}

/**
 * SC06 → SC07: below and behind the ship, looking up past it at the Milky Way. Earth's limb, the
 * Sun and SC06's Moon are all out of frame (each chapter draws them differently), so only the
 * ship and the shared sky are on screen at the boundary.
 */
export const CHASE_06_07: Chase = { position: [6, -10, 40], target: [-4, 70, -60], fov: 54 };

/** SC07 → SC08: behind-left of the ship, looking ahead past the bow (SC07's last key). */
export const CHASE_07_08: Chase = { position: [-8, 5, 14], target: [2, 0, -60], fov: 62 };
/** SC08 → SC09: behind and above the ship, Saturn small and edge-on ahead (SC09's first key). */
export const CHASE_08_09: Chase = { position: [12, 12, 70], target: [12, 10.5, -200], fov: 38 };

/** SC09 → SC10: behind-right of the ship, the black hole a dim ring far ahead (SC10's first key). */
export const CHASE_09_10: Chase = { position: [18, 6, 52], target: [0, 0, -60], fov: 48 };

/** Shared light at a boundary, so the ship and the planet ahead are lit the same on both sides. */
export interface Light {
  readonly direction: Vec3;
  readonly color: string;
  readonly intensity: number;
  readonly sky: string;
  readonly ground: string;
  readonly ambient: number;
}
/** SC07's key and fill (its Sun behind-right of the camera). */
export const LIGHT_07: Light = {
  direction: [0.55, 0.35, 0.75],
  color: '#fff2e0',
  intensity: 3.4,
  sky: '#33415f',
  ground: '#08090d',
  ambient: 0.12,
};
/** SC08's own key and fill (warm, Jupiter-lit). */
export const LIGHT_08: Light = {
  direction: [0.9, 0.3, 0.7],
  color: '#fff1de',
  intensity: 3,
  sky: '#6b5a48',
  ground: '#05060a',
  ambient: 0.35,
};

/** Jupiter's spin on the shared clock: every chapter that shows Jupiter shows the same face. */
export const jupiterTurn = (elapsed: number) => 0.6 + elapsed * 0.012;

/** SC10's cold light at the edge of the system. */
export const LIGHT_10: Light = {
  direction: [0.5, 0.35, 0.75],
  color: '#dfe8ff',
  intensity: 2.2,
  sky: '#4a5f8a',
  ground: '#06070b',
  ambient: 0.5,
};

/** Stars for the travel chapters: one seed, camera-centred, so they never jump at a boundary. */
export const TRAVEL_STARS = { count: 6000, radius: 1400, seed: 41 } as const;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** The chase camera for a ship at `ship` (writes into `out`). */
export function chaseShot(ship: THREE.Vector3, chase: Chase, out: ShotState): void {
  out.position.set(
    ship.x + chase.position[0],
    ship.y + chase.position[1],
    ship.z + chase.position[2],
  );
  out.target.set(ship.x + chase.target[0], ship.y + chase.target[1], ship.z + chase.target[2]);
  out.fov = chase.fov;
}

/** Blend `out` toward `pose` by w (0 keeps `out`, 1 is exactly `pose`). */
export function blendShot(out: ShotState, pose: ShotState, w: number): void {
  if (w <= 0) return;
  out.position.lerp(pose.position, w);
  out.target.lerp(pose.target, w);
  out.fov += (pose.fov - out.fov) * w;
}

/** Point on a straight run from a to b at u, easing out (arriving) or in (leaving). */
export function run(a: Vec3, b: Vec3, u: number, ease: 'in' | 'out', out: THREE.Vector3) {
  const c = clamp01(u);
  const e = ease === 'out' ? 1 - (1 - c) * (1 - c) : c * c;
  return out.set(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e);
}

/** a + (b - c), as a tuple (a vector carried from one chapter's frame into another's). */
export const carry = (a: Vec3, b: Vec3, c: Vec3): Vec3 => [
  a[0] + b[0] - c[0],
  a[1] + b[1] - c[1],
  a[2] + b[2] - c[2],
];
