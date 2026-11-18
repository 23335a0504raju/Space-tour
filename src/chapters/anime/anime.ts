import { sampleKeys } from '../../engine/camera/shots.ts';
import type { ShotKey, ShotState } from '../../engine/camera/shots.ts';

/**
 * SC11 anime-universe story data (no React; unit-tested). Three areas, each a chapter with its own
 * local frame: the ship flies down -z through it (a pure function of t) with a chase camera. The
 * overlay panel sits opposite the area's landmark at the rest point (right, left, right).
 * ANIME_UNIVERSE_FRAMEWORK: structure only; these worlds are generic stand-ins.
 */
export const TRAVEL = 220;
export const shipZ = (t: number) => -Math.min(1, Math.max(0, t)) * TRAVEL;

export type AreaId = 'discipline' | 'proof' | 'horizon';

export interface AreaDef {
  readonly id: AreaId;
  /** Sky gradient, horizon → zenith (flattened into painted bands by the style pass). */
  readonly sky: readonly [string, string, string, string];
  readonly light: string;
  readonly keys: readonly ShotKey[];
}

const keys = (list: ShotKey[]): readonly ShotKey[] => list;

export const AREAS: Readonly<Record<AreaId, AreaDef>> = {
  discipline: {
    id: 'discipline',
    sky: ['#ffd6b8', '#f7a9a0', '#c96f8f', '#5a3a78'],
    light: '#ffe2c8',
    keys: keys([
      // the first frame matches SC10's last frame, so the crossing flows straight in (no cut)
      { t: 0, position: [-22, 9, 52], target: [0, 3, -30], fov: 50 },
      { t: 0.25, position: [10, 6, 50], target: [-10, 2, -50], fov: 54 },
      // rest: the ring mandala fills the left, the panel sits on the right
      { t: 0.55, position: [16, 7, 46], target: [-28, 4, -40], fov: 56 },
      { t: 1, position: [-6, 6, 40], target: [0, 2, -60], fov: 52 },
    ]),
  },
  proof: {
    id: 'proof',
    sky: ['#fff1c9', '#bfe6d6', '#6fc3c9', '#2f6f9a'],
    light: '#fff6dc',
    keys: keys([
      { t: 0, position: [-6, 6, 40], target: [0, 2, -60], fov: 52 },
      { t: 0.3, position: [-14, 8, 48], target: [14, 3, -50], fov: 54 },
      // rest: islands and spires on the right, the panel on the left
      { t: 0.55, position: [-16, 7, 46], target: [28, 4, -40], fov: 56 },
      { t: 1, position: [8, 8, 44], target: [0, 0, -60], fov: 52 },
    ]),
  },
  horizon: {
    id: 'horizon',
    sky: ['#ffc9b0', '#b79be0', '#5b4aa8', '#171044'],
    light: '#d6c8ff',
    keys: keys([
      { t: 0, position: [8, 8, 44], target: [0, 0, -60], fov: 52 },
      { t: 0.3, position: [14, 8, 48], target: [-14, 4, -50], fov: 54 },
      // rest: the ringed planet on the left, the panel on the right
      { t: 0.55, position: [16, 7, 46], target: [12, 6, -40], fov: 58 },
      { t: 1, position: [0, 10, 40], target: [-10, 8, -80], fov: 52 },
    ]),
  },
};

export function areaShot(area: AreaId, t: number, out: ShotState): void {
  sampleKeys(AREAS[area].keys, t, out);
  const z = shipZ(t);
  out.position.z += z;
  out.target.z += z;
}

/** Landmark positions (chapter frame) that the rest-point cameras look at; tested against the frame. */
export const LANDMARKS: Readonly<Record<AreaId, readonly [number, number, number]>> = {
  discipline: [-55, 10, -125],
  proof: [55, -8, -110],
  horizon: [-95, 22, -330],
};
