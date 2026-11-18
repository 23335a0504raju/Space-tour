import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';

/**
 * SC07 Outbound story maths (no React/three scene code; unit-tested). The ship flies down -z at a
 * steady rate; the Moon, Mars and the belt are fixed in the chapter's local frame. Everything is a
 * pure function of t, so reverse scrolling is exact.
 */
export const TRAVEL = 1000;
export const shipZ = (t: number) => -Math.min(1, Math.max(0, t)) * TRAVEL;

/** Earth, left behind: seen over the bow at the start. Lit from the ship's side (its own sun). */
export const EARTH = { radius: 240, position: [-60, -250, 380] as const } as const;
export const EARTH_SUN = [0.7, 0.35, -0.45] as const;
export const MOON = { radius: 38, position: [-58, -6, -190] as const } as const;
/** Mercury: a small cratered world passed on the starboard side, between the Moon and Mars. */
export const MERCURY = { radius: 34, position: [78, 6, -385] as const } as const;
export const MARS = { radius: 60, position: [-95, 10, -560] as const } as const;
export const BELT = { centre: [0, 0, -840] as const, spread: [300, 50, 230] as const } as const;
/** Sun direction (unit-ish): from behind-right (the camera side), so each body is seen with a different phase. */
export const SUN = [0.55, 0.35, 0.75] as const;

/** Camera offsets relative to the ship (position, then look-at offset). */
const rel: ShotKey[] = [
  // look back over the bow: the ship and the whole lit Earth shrinking behind it
  { t: 0, position: [12, 4, -35], target: [-30, -60, 200], fov: 50 },
  // swing abeam, then settle into the chase camera (behind and above, looking ahead)
  { t: 0.035, position: [38, 8, 2], target: [0, -10, 60], fov: 50 },
  { t: 0.09, position: [14, 6, 46], target: [-10, 0, -80], fov: 54 },
  // Moon pass: it grows ahead on the left, then sweeps past the port side
  { t: 0.15, position: [12, 6, 42], target: [-22, -2, -70], fov: 56 },
  { t: 0.19, position: [12, 6, 40], target: [-34, -4, -34], fov: 58 },
  { t: 0.3, position: [14, 7, 46], target: [-8, 0, -90], fov: 54 },
  // Mercury: ahead-right, growing, then past (the camera swings across to the right)
  { t: 0.33, position: [24, 6, 46], target: [30, 0, -80], fov: 54 },
  { t: 0.375, position: [20, 7, 60], target: [34, 0, -30], fov: 48 },
  { t: 0.43, position: [18, 6, 44], target: [10, 0, -90], fov: 54 },
  // Mars: ahead-left, growing, then past
  { t: 0.48, position: [14, 7, 46], target: [-26, 2, -70], fov: 56 },
  { t: 0.56, position: [12, 6, 38], target: [-44, 4, -34], fov: 60 },
  { t: 0.68, position: [14, 6, 44], target: [-10, 0, -90], fov: 56 },
  // belt entry: behind and above the ship for parallax
  { t: 0.8, position: [10, 7, 18], target: [0, 0, -50], fov: 60 },
  { t: 1, position: [-8, 5, 14], target: [2, 0, -60], fov: 62 },
];

export function outboundShot(t: number, out: ShotState): void {
  sampleKeys(rel, t, out);
  const z = shipZ(t);
  out.position.z += z;
  out.target.z += z;
}
