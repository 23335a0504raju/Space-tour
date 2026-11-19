import { describe, expect, it } from 'vitest';
import { createShotState, fovForAspect, sampleKeys } from './camera/shots.ts';
import type { ShotKey } from './camera/shots.ts';
import { recommendTier } from './quality/detect.ts';

const keys: ShotKey[] = [
  { t: 0, position: [0, 0, 10], target: [0, 0, 0], fov: 40 },
  { t: 0.5, position: [10, 0, 10], target: [0, 1, 0], fov: 50 },
  { t: 1, position: [10, 5, 0], target: [0, 2, 0], fov: 60 },
];

describe('sampleKeys', () => {
  it('hits keys exactly', () => {
    const s = sampleKeys(keys, 0.5, createShotState());
    expect(s.position.toArray()).toEqual([10, 0, 10]);
    expect(s.fov).toBe(50);
  });

  it('clamps outside the key range', () => {
    expect(sampleKeys(keys, -1, createShotState()).position.toArray()).toEqual([0, 0, 10]);
    expect(sampleKeys(keys, 2, createShotState()).position.toArray()).toEqual([10, 5, 0]);
  });

  it('is path-independent (same camera whichever direction t is reached from)', () => {
    const out = createShotState();
    const direct = sampleKeys(keys, 0.37, createShotState()).position.toArray();
    for (const t of [0.9, 0.1, 0.6]) sampleKeys(keys, t, out);
    expect(sampleKeys(keys, 0.37, out).position.toArray()).toEqual(direct);
  });

  const x = (k: readonly ShotKey[], t: number) => sampleKeys(k, t, createShotState()).position.x;
  const speed = (k: readonly ShotKey[], t: number, h = 1e-4) =>
    (x(k, t + h) - x(k, t - h)) / (2 * h);

  // x moves steadily through the middle key (uneven spacing, as real chapters have)
  const flowing: ShotKey[] = [
    { t: 0, position: [0, 0, 0], target: [0, 0, -1], fov: 50 },
    { t: 0.3, position: [4, 0, 0], target: [0, 0, -1], fov: 50 },
    { t: 1, position: [10, 0, 0], target: [0, 0, -1], fov: 50 },
  ];

  it('flows through interior keys instead of stopping (v1 stopped at every key)', () => {
    expect(speed(flowing, 0.3)).toBeGreaterThan(5);
  });

  it('has no velocity jump at a key (continuous first derivative)', () => {
    const h = 1e-4;
    const left = (x(flowing, 0.3) - x(flowing, 0.3 - h)) / h;
    const right = (x(flowing, 0.3 + h) - x(flowing, 0.3)) / h;
    expect(Math.abs(left - right)).toBeLessThan(0.01 * Math.abs(left));
  });

  it('eases into and out of the chapter (zero velocity at the first and last key)', () => {
    expect(Math.abs(speed(flowing, 0.0001, 1e-5))).toBeLessThan(0.1);
    expect(Math.abs(speed(flowing, 0.9999, 1e-5))).toBeLessThan(0.1);
  });

  it('never overshoots its keys (monotone), so a camera cannot swing through a wall', () => {
    for (let i = 0; i <= 200; i += 1) {
      const t = i / 200;
      const v = x(keys, t);
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeLessThanOrEqual(10 + 1e-9);
    }
    // where a channel turns or holds (x: 0 → 10 → 10), it settles at the key
    expect(Math.abs(speed(keys, 0.5))).toBeLessThan(0.01);
  });
});

describe('fovForAspect', () => {
  it('widens for portrait, within limits', () => {
    expect(fovForAspect(50, 'portrait')).toBeGreaterThan(50);
    expect(fovForAspect(80, 'portrait')).toBeLessThanOrEqual(85);
    expect(fovForAspect(50, 'landscape')).toBe(50);
  });
});

describe('recommendTier', () => {
  const base = {
    webgl2: true,
    deviceMemoryGb: 16,
    cores: 16,
    saveData: false,
    coarsePointer: false,
  };
  it('recommends Balanced for the reference laptop', () => {
    expect(recommendTier(base)).toBe('balanced');
  });
  it('recommends the Brief without WebGL2', () => {
    expect(recommendTier({ ...base, webgl2: false })).toBe('brief');
  });
  it('recommends Low for phones, Save-Data and low-memory devices', () => {
    expect(recommendTier({ ...base, coarsePointer: true })).toBe('low');
    expect(recommendTier({ ...base, saveData: true })).toBe('low');
    expect(recommendTier({ ...base, deviceMemoryGb: 4 })).toBe('low');
  });
  it('treats unknown signals as capable (Safari/Firefox hide them)', () => {
    expect(recommendTier({ ...base, deviceMemoryGb: null, cores: null })).toBe('balanced');
  });
});
