import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';

/**
 * SC06 Orbital Sunrise story maths (no React/three, unit-tested). Everything is a pure function of
 * story time t, so reverse scrolling is exact.
 */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);
export const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));

export const EARTH = { radius: 170, centre: [-20, -110, -420] as const } as const;
export const MOON = { radius: 70, position: [-380, 130, -1100] as const } as const;
export const SUN_DISTANCE = 1500;

/** Sun elevation angle (rad) relative to the horizon plane: below the limb → above it. */
export const sunAngle = (t: number) => -0.34 + span(t, 0.02, 0.62) * 0.5;

/** Unit direction to the Sun, written into `out` (x,y,z). */
export function sunDirection(t: number, out: [number, number, number]): void {
  const a = sunAngle(t);
  const x = 0.82;
  const y = Math.sin(a) * 0.9;
  const z = -0.12;
  const l = Math.hypot(x, y, z);
  out[0] = x / l;
  out[1] = y / l;
  out[2] = z / l;
}

/** Sun intensity on the ship: dark until the limb is cleared, then full. */
export const sunLight = (t: number) => 0.04 + 1.7 * span(t, 0.18, 0.5);

/** Ship heading (rad about y). Bow starts toward -z, then turns outward at the end. */
export const shipYaw = (t: number) => -Math.PI / 2 + span(t, 0.86, 0.99) * 0.5;
/** Main-engine level: the burn after the turn. */
export const engineLevel = (t: number) => span(t, 0.9, 0.98);
/** Ship drift forward along its heading, small and steady. */
export const shipDrift = (t: number) => -t * 6 - span(t, 0.9, 1) * 20;

const keys: ShotKey[] = [
  { t: 0, position: [-10, 12, 70], target: [-20, -50, -300], fov: 50 },
  { t: 0.35, position: [-25, 10, 80], target: [60, -60, -320], fov: 50 },
  // the Sun clears the limb on the right while the ship holds the left of frame
  { t: 0.7, position: [-40, 10, 110], target: [660, 150, -590], fov: 60 },
  { t: 1, position: [-30, 12, 50], target: [-10, 10, -200], fov: 46 },
];

export const sunriseShot = (t: number, out: ShotState) => void sampleKeys(keys, t, out);
