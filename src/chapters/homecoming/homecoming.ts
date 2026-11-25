import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';
import { createShotState } from '../../engine/camera/shots.ts';
import { blendShot } from '../handoff.ts';
import {
  EARTH as SC12_EARTH,
  DAWN_SUN as SC12_SUN,
  TRAVEL as SC12_TRAVEL,
} from '../return/return.ts';

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

/**
 * Final transmission (the contact card): the camera lifts off the deck into open sky, where the
 * Moon hangs beside the card; its ring of dust sweeps into being, then the rock belt arrives.
 */
export const LIFT = { start: 0.58, end: 0.84 } as const;
/** The card's empty right half, where the Moon must appear (LunarMoon reads its layout box). */
export const MOON_ANCHOR = 'data-moon-anchor';
/** The card's rest point (registry and overlay). */
export const CARD_REST = 0.9;
export const ringForm = (t: number) => span(t, 0.64, 0.9);
export const rocksIn = (t: number) => span(t, 0.72, 0.92);

/** The deck view the lift starts from, and the open-sky view it ends in. */
const DECK_VIEW = { position: [-9, 5.2, 11], target: [-5.6, 4.1, 0], fov: 42 } as const;
const SKY_VIEW = { position: [-10.5, 6.4, 13], target: [-3, 21, -20], fov: 42 } as const;
/** Where the camera rests at the end of the journey (the Moon is placed for this view). */
export const FINAL_VIEW = {
  position: [-10.6, 6.5, 13.3],
  target: [-3, 21.2, -20],
  fov: 42,
} as const;

const keys: ShotKey[] = [
  { t: 0, position: [-14, 10, 60], target: [0, 0, 0], fov: 48 },
  { t: 0.25, position: [-12, 6, 28], target: [-6, 3.6, 0], fov: 46 },
  { t: LIFT.start, ...DECK_VIEW },
  { t: LIFT.end, ...SKY_VIEW },
  { t: 1, ...FINAL_VIEW },
];

/**
 * SC12 → SC13 (continuous flight): SC12 flies along -z, this chapter along -x, so a vector (x, y, z)
 * there is (z, y, -x) here. The chapter opens on SC12's last frame (camera, Earth, sun) and eases
 * to its deck view over the first fifth.
 */
export const fromReturn = (v: readonly [number, number, number]) => [v[2], v[1], -v[0]] as const;
export const HANDOFF = {
  position: fromReturn([-24, 8, 58]),
  target: fromReturn([14, -12, -90]),
  fov: 48,
  /** SC12's Earth relative to its ship at the end, in this frame */
  earth: fromReturn([
    SC12_EARTH.position[0],
    SC12_EARTH.position[1],
    SC12_EARTH.position[2] + SC12_TRAVEL,
  ]),
  earthRadius: SC12_EARTH.radius,
  sun: fromReturn(SC12_SUN),
} as const;
/** 1 at the boundary (SC12's picture) → 0 once the deck view has taken over. */
export const handoffWeight = (t: number) => 1 - span(t, 0, 0.22);

const pose = createShotState();
export function homecomingShot(t: number, out: ShotState): void {
  sampleKeys(keys, t, out);
  const w = handoffWeight(t);
  if (w > 0) {
    pose.position.set(...HANDOFF.position);
    pose.target.set(...HANDOFF.target);
    pose.fov = HANDOFF.fov;
    blendShot(out, pose, w);
  }
}
