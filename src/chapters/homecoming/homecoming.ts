import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';

/**
 * SC13 Homecoming & Final Transmission story maths (no React; unit-tested). The ship holds high
 * orbit at sunrise; the astronaut steps out onto the hull deck, walks a few steps, stands, turns
 * to the camera; a beacon rises and pulses. All pure functions of t.
 */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);
export const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));

/** Ship-local frame: origin on the keel, bow toward -x, +y up. The deck is a platform on the hull top. */
export const DECK = { x: -2, y: 3.6, z: 0, halfX: 5, halfZ: 2.6 } as const;
export const BEACON = { x: 2.2, z: 1.4 } as const;

export const EARTH = { radius: 300, position: [-30, -330, -90] as const } as const;
export const SUN = [-0.8, 0.2, 0.55] as const;

/** Walk timing: steps out onto the deck, then stands. */
export const WALK = { start: 0.04, end: 0.3, fromX: -6.2, toX: -0.6 } as const;
export const walkProgress = (t: number) => clamp01((t - WALK.start) / (WALK.end - WALK.start));
export const astronautX = (t: number) =>
  WALK.fromX + (WALK.toX - WALK.fromX) * ease(walkProgress(t));
/** Distance walked so far (m); drives the clip phase so feet do not slide. */
export const walkedDistance = (t: number) => astronautX(t) - WALK.fromX;
/** Weight of the walk clip (1 while walking, 0 once standing). */
export const walkWeight = (t: number) => 1 - span(t, WALK.end - 0.06, WALK.end);
/** Heading (rad about y; rig faces +z): walks along +x, then turns toward the camera. */
export const astronautYaw = (t: number) => Math.PI / 2 - span(t, 0.3, 0.46) * (Math.PI / 2 - 0.45);

/** The beacon rises out of the deck, then stays; its pulse is ambient. */
export const beaconRise = (t: number) => span(t, 0.46, 0.6);

const keys: ShotKey[] = [
  { t: 0, position: [-14, 10, 60], target: [0, 0, 0], fov: 48 },
  { t: 0.25, position: [-12, 6, 28], target: [-6, 3.6, 0], fov: 46 },
  { t: 0.6, position: [-9, 5.2, 11], target: [-5.6, 4.1, 0], fov: 42 },
  { t: 1, position: [-8.6, 5.3, 12], target: [-5.3, 4.1, 0], fov: 42 },
];

export const homecomingShot = (t: number, out: ShotState) => void sampleKeys(keys, t, out);
