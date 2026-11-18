import { describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import { BAND_RANGES, GAP, bandLevel, saturnShot } from './saturn.ts';

describe('SC09 Saturn', () => {
  it('has five ordered, non-overlapping bands with the gap between 3 and 4', () => {
    expect(BAND_RANGES).toHaveLength(5);
    BAND_RANGES.forEach(([lo, hi], i) => {
      expect(hi).toBeGreaterThan(lo);
      if (i > 0) expect(lo).toBeGreaterThanOrEqual(BAND_RANGES[i - 1]?.[1] ?? 0);
    });
    expect(BAND_RANGES[2]?.[1]).toBeLessThanOrEqual(GAP[0]);
    expect(BAND_RANGES[3]?.[0]).toBeGreaterThanOrEqual(GAP[1]);
  });
  it('lights the bands one after another and all are lit at the rest point', () => {
    for (let i = 1; i < 5; i += 1) {
      expect(bandLevel(i, 0.3)).toBeLessThanOrEqual(bandLevel(i - 1, 0.3));
    }
    for (let i = 0; i < 5; i += 1) {
      expect(bandLevel(i, 0)).toBe(0);
      expect(bandLevel(i, 0.75)).toBe(1);
    }
  });
  it('camera is path independent and rises over the chapter', () => {
    const a = createShotState();
    const b = createShotState();
    saturnShot(0.6, a);
    saturnShot(0.1, b);
    saturnShot(0.6, b);
    expect(b.position.toArray()).toEqual(a.position.toArray());
    const lo = createShotState();
    const hi = createShotState();
    saturnShot(0, lo);
    saturnShot(0.75, hi);
    expect(hi.position.y).toBeGreaterThan(lo.position.y + 50);
  });
});
