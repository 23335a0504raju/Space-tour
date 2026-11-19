import * as THREE from 'three';
import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';
import { CHAIR_REST, LIFT, PLATFORM, SEAT } from '../room/layout.ts';

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
    // rolls back and away to the right: the walk now leaves to the left (bridge layout)
    x: CHAIR_REST.x + 0.75 * k,
    // only 0.45 back: a low rail runs behind it on the bridge
    z: CHAIR_REST.z + 0.45 * k,
    rotY: CHAIR_REST.rotY + 0.4 * k,
  };
}

/**
 * Walk path across the bridge deck (room metres; layout.ts BRIDGE) as [x, z, floor height], a
 * centripetal Catmull–Rom sampled by arc length: step left along the desk (clear of the pushed-back
 * chair), cross the south-west of the deck to the foot of the platform stairs, CLIMB them (the
 * body rises with the steps: Raju's review, the walk used to pass through them), follow the
 * platform's free west strip north, step down at its north tip, and turn into the lift doorway.
 */
const UP = PLATFORM.height;
export const PATH_POINTS: ReadonlyArray<readonly [number, number, number]> = [
  [SEAT[0], SEAT[2], 0],
  [-1.3, -1.45, 0],
  [-2.9, -1.9, 0],
  [-3.4, -3.0, 0],
  // stairs: foot at the east, top at the west (0.9 m run, 0.5 m rise)
  [-3.6, -3.35, 0],
  [-4.5, -3.6, UP],
  [-5.35, -4.3, UP],
  [-5.4, -6.3, UP],
  [-4.85, -7.4, UP],
  // the platform's north tip, the step down to the deck, then turn into the lift doorway
  [-4.75, -7.8, UP],
  [-4.35, -8.2, 0],
  [-4.3, -8.65, 0],
  [LIFT.x, LIFT.z, LIFT.y],
];
const PATH = new THREE.CatmullRomCurve3(
  PATH_POINTS.map(([x, z, y]) => new THREE.Vector3(x, y, z)),
  false,
  'centripetal',
);
PATH.arcLengthDivisions = 400;
export const PATH_LENGTH = PATH.getLength();

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

/**
 * Lift light 0–1: the platform's light rises over the last 1.6 m of the walk and is full as the
 * astronaut stands on it; the chapter's exit dip to white continues it (match cut to SC04).
 */
export const liftLight = (t: number) =>
  span(walkedDistance(t), PATH_LENGTH - 1.6, PATH_LENGTH - 0.15);

// ── SC02 camera (the room chapter) ──────────────────────────────────────────────
/** SC02 keys: here, not in origin.tsx, so node tools and tests can read them. */
export const roomKeys: ShotKey[] = [
  // Opening frame (behind the start gate's title), from the back of the deck, behind-left of the
  // astronaut: the figure at the desk sits on the right third and the hologram globe glows beyond
  // the monitors, right of centre, past the title block that owns the left half.
  { t: 0, position: [-1.0, 1.65, 0.0], target: [0.74, 1.65, -9.85], fov: 50 },
  // drift right along the back of the deck to the title-card view (desk, astronaut, globe)
  { t: 0.6, position: [2.3, 1.8, 0.2], target: [0, 1.0, -2.2], fov: 44 },
  { t: 1, position: [1.3, 1.55, -0.15], target: [0, 1.05, -2.3], fov: 42 },
];

export const roomShot = (t: number, out: ShotState): void => void sampleKeys(roomKeys, t, out);

// ── Camera ──────────────────────────────────────────────────────────────────────
// Positions stay clear of the walk path at the matching t, and off the pit, desk and console
// block (departure.test.ts checks the walker distance; frames reviewed for the set).
export const departureKeys: ShotKey[] = [
  { t: 0, position: [1.3, 1.55, -0.15], target: [0, 1.05, -2.3], fov: 42 },
  // swing left along the back of the deck: they stand, the chair rolls back
  { t: 0.3, position: [-1.5, 1.55, -0.05], target: [-0.6, 1.1, -1.8], fov: 46 },
  // hold while they pass along the desk, then move in past the end of the low rail
  { t: 0.46, position: [-1.6, 1.6, 0.0], target: [-2.0, 1.1, -1.8], fov: 46 },
  { t: 0.62, position: [-2.0, 1.6, -1.0], target: [-4.2, 1.4, -3.5], fov: 48 },
  // follow them up onto the platform and walk behind them along it to the lift (the console
  // block beside the platform hid them from the deck)
  { t: 0.82, position: [-5.2, 2.05, -3.4], target: [-5.3, 1.8, -7.0], fov: 52 },
  // over the north stairs to the deck east of the lift, looking straight into its doorway
  { t: 0.92, position: [-4.0, 2.0, -7.0], target: [-4.6, 1.3, -8.6], fov: 52 },
  { t: 1, position: [-3.0, 1.75, -7.6], target: [-5.6, 1.3, -8.8], fov: 50 },
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
