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

  it('eases (no velocity jump) at keys', () => {
    const a = sampleKeys(keys, 0.499, createShotState()).position.x;
    const b = sampleKeys(keys, 0.501, createShotState()).position.x;
    expect(Math.abs(b - a)).toBeLessThan(0.01);
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
