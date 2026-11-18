import * as THREE from 'three';
import type { AspectClass } from '../../chapters/types.ts';

/** Camera state a chapter writes for its local time t. */
export interface ShotState {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
  fov: number;
}

export const createShotState = (): ShotState => ({
  position: new THREE.Vector3(),
  target: new THREE.Vector3(),
  fov: 50,
});

export type Vec3 = readonly [number, number, number];

export interface ShotKey {
  /** Local time in [0, 1]. Keys must be sorted by t. */
  readonly t: number;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * Keyframed camera: eased interpolation between keys. Pure in t, so any t, reached from any
 * direction, produces the same camera (the reverse-scroll guarantee for cameras).
 */
export function sampleKeys(keys: readonly ShotKey[], t: number, out: ShotState): ShotState {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) throw new Error('sampleKeys: no keys');
  let a = first;
  let b = last;
  if (t <= first.t) b = first;
  else if (t >= last.t) a = last;
  else {
    for (let i = 1; i < keys.length; i += 1) {
      const k = keys[i];
      if (k && t <= k.t) {
        a = keys[i - 1] ?? first;
        b = k;
        break;
      }
    }
  }
  const span = b.t - a.t;
  const u = span > 0 ? smooth(Math.min(1, Math.max(0, (t - a.t) / span))) : 0;
  out.position.set(
    a.position[0] + (b.position[0] - a.position[0]) * u,
    a.position[1] + (b.position[1] - a.position[1]) * u,
    a.position[2] + (b.position[2] - a.position[2]) * u,
  );
  out.target.set(
    a.target[0] + (b.target[0] - a.target[0]) * u,
    a.target[1] + (b.target[1] - a.target[1]) * u,
    a.target[2] + (b.target[2] - a.target[2]) * u,
  );
  out.fov = a.fov + (b.fov - a.fov) * u;
  return out;
}

/** Portrait screens see less horizontally: widen the field of view instead of cropping the subject. */
export function fovForAspect(fov: number, aspect: AspectClass): number {
  if (aspect === 'portrait') return Math.min(fov * 1.35, 85);
  if (aspect === 'ultrawide') return fov * 0.9;
  return fov;
}
