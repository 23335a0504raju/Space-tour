import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';

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

export const saturnShot = (t: number, out: ShotState) => void sampleKeys(keys, t, out);
