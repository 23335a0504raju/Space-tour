import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';

/**
 * SC12 The Return story maths (no React; unit-tested): the crossing in reverse. The ship flies
 * through the gate home, the art style runs cel colour → ink line art → real rendering inside the
 * tunnel, then a calm emergence into real space with Earth and the Moon at dawn. Everything is a
 * pure function of t, so scrolling back re-draws it exactly.
 */
export const TRAVEL = 260;
export const shipZ = (t: number) => -Math.min(1, Math.max(0, t)) * TRAVEL;

export const GATE = { z: -65, radius: 14 } as const;
export const TUNNEL = { start: -65, end: -182, radius: 11 } as const;
export const T_GATE = -GATE.z / TRAVEL;
export const T_EXIT = -TUNNEL.end / TRAVEL;

/** The real world waiting beyond the tunnel (chapter frame). The Sun is low on the left, so the day side is a lit left half. */
export const EARTH = { radius: 240, position: [-40, -140, -640] as const } as const;
export const MOON = { radius: 55, position: [210, 60, -900] as const } as const;
export const DAWN_SUN = [-0.75, 0.15, 0.55] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);
const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));

/** 2 cel colour → 1 line art → 0 real. Starts to un-draw as the gate is entered. */
export const styleAt = (t: number) =>
  2 - span(t, T_GATE, T_GATE + 0.08) - span(t, T_GATE + 0.08, T_GATE + 0.16);

/**
 * SC11c hands over with ink on shapes; entering the gate there is only light to draw, so the ink
 * follows colour boundaries again and the line-art stage draws the tunnel.
 */
export const colourInkAt = (t: number) => span(t, T_GATE - 0.08, T_GATE);

/** The gate is open and glowing as it is approached. */
export const gateOpen = (t: number) => 0.9 + 0.1 * span(t, 0, 0.12);

const rel: ShotKey[] = [
  // SC11c's last frame (handoff): behind the ship, the ringed planet ahead on the left
  { t: 0, position: [0, 10, 40], target: [-10, 8, -80], fov: 52 },
  // fast push toward the gate, then wide and tight inside the tunnel
  { t: 0.2, position: [8, 7, 50], target: [0, 0, -50], fov: 60 },
  { t: 0.45, position: [0, 6, 46], target: [0, 0, -50], fov: 68 },
  { t: 0.7, position: [-6, 7, 46], target: [0, 0, -60], fov: 58 },
  // calm: drift out and sideways so the whole planet and the Moon open up
  { t: 0.85, position: [-14, 6, 48], target: [8, -6, -80], fov: 50 },
  { t: 1, position: [-24, 8, 58], target: [14, -12, -90], fov: 48 },
];

export function returnShot(t: number, out: ShotState): void {
  sampleKeys(rel, t, out);
  const z = shipZ(t);
  out.position.z += z;
  out.target.z += z;
}

/** The hole swells as the ship leaves the painted sky for it. */
export const holeRadiusAt = (t: number) => 6 + 10 * span(t, 0, 0.25);
