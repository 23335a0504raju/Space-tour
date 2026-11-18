import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';

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

export const jupiterShot = (t: number, out: ShotState) => void sampleKeys(keys, t, out);
