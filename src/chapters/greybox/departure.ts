import * as THREE from 'three';
import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';
import { CHAIR_REST, ROOM, SEAT } from '../room/layout.ts';

/**
 * SC03 Departure motion: every value here is a pure function of story time t, so scrolling back
 * plays the scene back exactly. Kept free of React so it can be tested in node (departure.test.ts).
 */
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);
export const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * clamp01(x)) - 1) / 2;

/** Story-time windows. */
export const STAND = { start: 0.04, end: 0.26 } as const;
export const WALK = { start: 0.26, end: 0.96 } as const;

/**
 * The chair is pushed back from the desk while the astronaut stands, so the body never shares
 * space with it (P3 review: the chair cut through the legs on the way to the door).
 */
export function chairPose(t: number) {
  const k = span(t, 0.05, 0.2);
  return {
    x: CHAIR_REST.x - 0.12 * k,
    z: CHAIR_REST.z + 0.7 * k,
    rotY: CHAIR_REST.rotY - 0.3 * k,
  };
}

/**
 * Walk path on the floor, a centripetal Catmull–Rom sampled by arc length: step right along the
 * desk (clear of the pushed-back chair), arc across the room, then straight through the doorway.
 */
const PATH = new THREE.CatmullRomCurve3(
  [
    [SEAT[0], SEAT[2]],
    [0.8, -1.55],
    [1.95, -0.35],
    [ROOM.halfW - 0.75, ROOM.doorZ],
    [ROOM.halfW + 1.25, ROOM.doorZ],
  ].map(([x = 0, z = 0]) => new THREE.Vector3(x, 0, z)),
  false,
  'centripetal',
);
PATH.arcLengthDivisions = 400;
export const PATH_LENGTH = PATH.getLength();
/** Arc length at which the body crosses the door plane. */
const DOOR_D = PATH_LENGTH - 1.25;

/** Distance walked (m) at story time t. */
export const walkedDistance = (t: number) =>
  PATH_LENGTH * easeInOutSine((t - WALK.start) / (WALK.end - WALK.start));

const tmpT = new THREE.Vector3();
/**
 * Astronaut ground position and heading at t. Heading = atan2(dx, dz) (the rig faces +z); it turns
 * from the desk (π) onto the path while standing up.
 */
export function walkerAt(t: number, out: THREE.Vector3): number {
  const u = clamp01(walkedDistance(t) / PATH_LENGTH);
  PATH.getPointAt(u, out);
  PATH.getTangentAt(u, tmpT);
  const along = Math.atan2(tmpT.x, tmpT.z);
  const delta = Math.atan2(Math.sin(along - Math.PI), Math.cos(along - Math.PI));
  return Math.PI + span(t, 0.18, 0.3) * delta;
}

/** Door opening 0–1: starts when the walker is 1.8 m from the door, fully open at 0.9 m. */
export const doorOpen = (t: number) => span(walkedDistance(t), DOOR_D - 1.8, DOOR_D - 0.9);

// ── Camera ──────────────────────────────────────────────────────────────────────
// Positions stay clear of the walk path at the matching t (departure.test.ts checks it).
export const departureKeys: ShotKey[] = [
  { t: 0, position: [1.45, 1.5, -0.55], target: [0, 1.05, -2.3], fov: 40 },
  // swing round to the left-front: watch them stand, the chair roll back, the first steps
  { t: 0.3, position: [-0.75, 1.5, 0.55], target: [0.25, 1.0, -1.5], fov: 44 },
  { t: 0.62, position: [0.15, 1.55, 2.35], target: [2.2, 1.1, 0.2], fov: 48 },
  // hold behind as the astronaut steps through, then follow into the light
  { t: 0.82, position: [1.2, 1.55, 2.45], target: [3.6, 1.2, 1.4], fov: 48 },
  { t: 1, position: [3.0, 1.45, 1.45], target: [6, 1.2, 1.4], fov: 55 },
];

/** How much the camera aims at the walker instead of the keyed target. */
const follow = (t: number) => span(t, 0.28, 0.4) * (1 - span(t, 0.78, 0.9));
const walker = new THREE.Vector3();

export function departureShot(t: number, out: ShotState): void {
  sampleKeys(departureKeys, t, out);
  const w = follow(t);
  if (w > 0) {
    walkerAt(t, walker);
    walker.y = 1.15;
    out.target.lerp(walker, w * 0.85);
  }
}
