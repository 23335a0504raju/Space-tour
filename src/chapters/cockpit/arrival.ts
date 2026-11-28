import * as THREE from 'three';
import type { ShotKey } from '../../engine/camera/shots.ts';
import { DOOR_VIEW } from '../room/doorView.ts';

/**
 * SC04's opening (lift → cockpit join): the camera faces the lift door in the cockpit's rear
 * bulkhead exactly as SC03 left it; the door slides open, the astronaut steps out, walks round the
 * pilot seat and sits down before the crew record. Pure functions of story time t (unit-tested).
 */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);
export const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));

/** The door in the rear bulkhead (its face toward the seats, -z). */
export const COCKPIT_DOOR = [0.9, 0, 1.59] as const;
export const doorOpen = (t: number) => span(t, 0.02, 0.08);

export const PILOT_SEAT: [number, number, number] = [-0.5, 0.06, -0.12];

/** Beats (story time). */
export const ARRIVAL = { walk: [0.08, 0.22], sit: [0.22, 0.31] } as const;

/**
 * The floating screens (0 folded into the dash, 1 open): they unfold as he sits, and fold away
 * before the camera drops to the ignition switch and flies out through the windscreen.
 */
export const SCREENS_OPEN = { unfold: [0.23, 0.32], fold: [0.75, 0.83] } as const;
export const screensOpen = (t: number) =>
  span(t, SCREENS_OPEN.unfold[0], SCREENS_OPEN.unfold[1]) *
  (1 - span(t, SCREENS_OPEN.fold[0], SCREENS_OPEN.fold[1]));

/**
 * The close-up on the launch control that ends the chapter (Ignition.tsx): the rings of light
 * appear as the camera comes down, the safety cover lifts (arming), the button goes down and the
 * light goes out from it, then the camera leaves through the windscreen.
 */
export const IGNITION = {
  show: [0.775, 0.84],
  arm: [0.815, 0.862],
  press: [0.872, 0.884],
  fire: [0.88, 0.93],
} as const;

export interface IgnitionState {
  show: number;
  arm: number;
  press: number;
  fire: number;
}

export function ignitionAt(t: number, out: IgnitionState): IgnitionState {
  out.show = span(t, IGNITION.show[0], IGNITION.show[1]);
  out.arm = span(t, IGNITION.arm[0], IGNITION.arm[1]);
  out.press = span(t, IGNITION.press[0], IGNITION.press[1]);
  out.fire = span(t, IGNITION.fire[0], IGNITION.fire[1]);
  return out;
}

/** Out of the lift, round the left of the pilot seat (clear of the pedestal), to its front. */
const PATH = new THREE.CatmullRomCurve3(
  [
    [0.9, 2.15],
    [0.9, 1.15],
    [-0.2, 0.75],
    [-1.15, 0.45],
    [-1.18, -0.45],
    [-0.5, -0.66],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  'centripetal',
);
PATH.arcLengthDivisions = 300;
export const ARRIVAL_LENGTH = PATH.getLength();
export const STAND_AT = PATH.getPointAt(1);

/** Distance walked (m) at t. */
export const arrivalDistance = (t: number) =>
  ARRIVAL_LENGTH * span(t, ARRIVAL.walk[0], ARRIVAL.walk[1]);

const tangent = new THREE.Vector3();
/** Ground position and heading (rad, the rig faces +z) at t, up to the start of the sit. */
export function arrivalAt(t: number, out: THREE.Vector3): number {
  const u = clamp01(arrivalDistance(t) / ARRIVAL_LENGTH);
  PATH.getPointAt(u, out);
  if (t < ARRIVAL.walk[0]) return Math.PI; // facing out of the lift, into the cockpit (-z)
  PATH.getTangentAt(u, tangent);
  return Math.atan2(tangent.x, tangent.z);
}

/** The camera: the door view at t = 0 (SC03's last frame), then with him to the seat. */
export const arrivalKeys: ShotKey[] = [
  {
    t: 0,
    position: [COCKPIT_DOOR[0], DOOR_VIEW.height, COCKPIT_DOOR[2] - DOOR_VIEW.distance],
    target: [COCKPIT_DOOR[0], DOOR_VIEW.height, COCKPIT_DOOR[2]],
    fov: DOOR_VIEW.fov,
  },
  // the door opens: back off to see him in the lit cab
  { t: 0.06, position: [0.7, 1.6, 0.55], target: [0.9, 1.25, 2.0], fov: 54 },
  // waiting in front of the seats, looking back: he steps out of the lift toward us
  { t: 0.1, position: [0.45, 1.75, -0.75], target: [0.55, 1.15, 1.2], fov: 56 },
  // and walks round the left seat
  { t: 0.16, position: [0.5, 1.8, -0.8], target: [-0.7, 1.1, 0.1], fov: 56 },
  // he sits
  { t: 0.24, position: [0.35, 1.8, 0.55], target: [-0.8, 1.0, -0.45], fov: 48 },
];

/**
 * The camera's last pose (cockpit → launch pad join): out through the windscreen opening, just
 * beyond the bow, looking along the heading (-z). SC05 opens at the same place in its own frame.
 */
export const COCKPIT_OUT = {
  position: [0, 1.8, -2.4] as const,
  target: [0, 1.65, -60] as const,
  fov: 50,
};
