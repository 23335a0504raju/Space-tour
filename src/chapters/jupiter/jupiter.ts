import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';
import type { AspectClass } from '../types.ts';

/**
 * SC08 Jupiter story data (no React; unit-tested). The three installations hold still in the
 * chapter's local frame; the camera visits each at the rest points 0.25 / 0.5 / 0.75 (the overlay
 * panel sits on the opposite side of the frame from the station: right, left, right).
 */
export const JUPITER = { radius: 230, position: [170, -190, -400] as const } as const;
export const SUN = [0.9, 0.3, 0.7] as const;

export type StationKind = 'traffic' | 'documents' | 'vault';
export const STATIONS: ReadonlyArray<{
  readonly kind: StationKind;
  readonly position: readonly [number, number, number];
}> = [
  { kind: 'traffic', position: [-14, 3, -24] },
  { kind: 'documents', position: [9, 0, -30] },
  { kind: 'vault', position: [16, 14, -50] },
];

const keys: ShotKey[] = [
  { t: 0, position: [6, 10, 34], target: [14, -22, -150], fov: 56 },
  // station 1 on the left of the frame (panel on the right)
  { t: 0.25, position: [-4, 4, -6], target: [-9, 2.5, -24], fov: 44 },
  // station 2 on the right (panel on the left)
  { t: 0.5, position: [-2, 0, -10], target: [5, -2, -30], fov: 44 },
  // station 3 on the left again
  { t: 0.75, position: [8, 9, -20], target: [21, 13, -50], fov: 44 },
  { t: 1, position: [12, 9, -6], target: [30, -4, -90], fov: 52 },
];

/**
 * Phones: the card fills the lower half, so each station is centred in the upper band instead of
 * sitting at a side of the frame (it was cut at the left edge), seen from a little further back.
 */
const pull = (k: ShotKey, s: readonly [number, number, number], k2: number): ShotKey => ({
  t: k.t,
  position: [
    s[0] + (k.position[0] - s[0]) * k2,
    s[1] + (k.position[1] - s[1]) * k2,
    s[2] + (k.position[2] - s[2]) * k2,
  ],
  // aim below the craft so it sits high in the frame, above the card
  target: [s[0], s[1] - 5, s[2]],
  fov: k.fov,
});
const portraitKeys: ShotKey[] = keys.map((k, i) => {
  const station = STATIONS[i - 1];
  return station && i >= 1 && i <= 3 ? pull(k, station.position, 1.35) : k;
});

export const jupiterShot = (t: number, out: ShotState, aspect: AspectClass = 'landscape') =>
  void sampleKeys(aspect === 'portrait' ? portraitKeys : keys, t, out);
