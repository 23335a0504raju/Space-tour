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

/** Channel c of a key: 0–2 position, 3–5 target, 6 fov (no allocation in the frame loop). */
function channel(k: ShotKey, c: number): number {
  if (c < 3) return k.position[c] ?? 0;
  if (c < 6) return k.target[c - 3] ?? 0;
  return k.fov;
}

/** Slope of channel c over segment i (key i → key i+1). */
function slope(keys: readonly ShotKey[], i: number, c: number): number {
  const a = keys[i];
  const b = keys[i + 1];
  if (!a || !b || b.t <= a.t) return 0;
  return (channel(b, c) - channel(a, c)) / (b.t - a.t);
}

/**
 * Tangent of channel c at key i (monotone cubic / PCHIP, Fritsch–Carlson with the weighted harmonic
 * mean). Zero at the first and last key (the camera eases into and out of a chapter), zero where
 * the channel turns back or holds, otherwise the camera passes through the key without stopping.
 */
function tangent(keys: readonly ShotKey[], i: number, c: number): number {
  if (i <= 0 || i >= keys.length - 1) return 0;
  const d0 = slope(keys, i - 1, c);
  const d1 = slope(keys, i, c);
  if (d0 * d1 <= 0) return 0;
  const h0 = (keys[i]?.t ?? 0) - (keys[i - 1]?.t ?? 0);
  const h1 = (keys[i + 1]?.t ?? 0) - (keys[i]?.t ?? 0);
  const w0 = 2 * h1 + h0;
  const w1 = h1 + 2 * h0;
  return (w0 + w1) / (w0 / d0 + w1 / d1);
}

const scratch = new Float64Array(7);

/**
 * Keyframed camera: a monotone cubic spline through the keys, per channel. Velocity is continuous
 * across keys, so the camera flows through them instead of stopping at each one (v1 eased every
 * segment to a standstill; UI_SCROLL_AUDIT.md S4). Monotone, so no channel overshoots its
 * neighbouring keys (no swinging through walls or subjects). Pure in t, so any t, reached from any
 * direction, produces the same camera (the reverse-scroll guarantee for cameras).
 */
export function sampleKeys(keys: readonly ShotKey[], t: number, out: ShotState): ShotState {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) throw new Error('sampleKeys: no keys');
  let i = 0;
  if (t <= first.t) i = -1;
  else if (t >= last.t) i = keys.length - 1;
  else while (i < keys.length - 2 && t > (keys[i + 1]?.t ?? Infinity)) i += 1;

  if (i < 0 || i >= keys.length - 1) {
    const k = i < 0 ? first : last;
    for (let c = 0; c < 7; c += 1) scratch[c] = channel(k, c);
  } else {
    const a = keys[i] ?? first;
    const b = keys[i + 1] ?? last;
    const h = b.t - a.t;
    const s = h > 0 ? (t - a.t) / h : 0;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    for (let c = 0; c < 7; c += 1) {
      scratch[c] =
        h00 * channel(a, c) +
        h10 * h * tangent(keys, i, c) +
        h01 * channel(b, c) +
        h11 * h * tangent(keys, i + 1, c);
    }
  }
  out.position.set(scratch[0] ?? 0, scratch[1] ?? 0, scratch[2] ?? 0);
  out.target.set(scratch[3] ?? 0, scratch[4] ?? 0, scratch[5] ?? 0);
  out.fov = scratch[6] ?? 0;
  return out;
}

/** Portrait screens see less horizontally: widen the field of view instead of cropping the subject. */
export function fovForAspect(fov: number, aspect: AspectClass): number {
  if (aspect === 'portrait') return Math.min(fov * 1.35, 85);
  if (aspect === 'ultrawide') return fov * 0.9;
  return fov;
}
