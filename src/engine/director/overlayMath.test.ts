import { describe, expect, it } from 'vitest';
import { boundaryDip, restOpacity } from './overlayMath.ts';

describe('restOpacity', () => {
  it('is fully visible at the rest point and hidden far away', () => {
    expect(restOpacity(0.5, 0.5)).toBe(1);
    expect(restOpacity(0.9, 0.5)).toBe(0);
  });

  it('ramps symmetrically (same value scrolling in either direction)', () => {
    expect(restOpacity(0.5 + 0.095, 0.5)).toBeCloseTo(restOpacity(0.5 - 0.095, 0.5), 12);
    const v = restOpacity(0.5 + 0.095, 0.5);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it('holds to the end when asked (final contact panel)', () => {
    expect(restOpacity(1, 0.6, { holdToEnd: true })).toBe(1);
    expect(restOpacity(0.3, 0.6, { holdToEnd: true })).toBe(0);
  });
});

describe('boundaryDip', () => {
  it('covers chapter edges but not the middle', () => {
    expect(boundaryDip(0, false, false)).toBe(1);
    expect(boundaryDip(1, false, false)).toBe(1);
    expect(boundaryDip(0.5, false, false)).toBe(0);
  });

  it('never dips at the start or end of the whole journey', () => {
    expect(boundaryDip(0, true, false)).toBe(0);
    expect(boundaryDip(1, false, true)).toBe(0);
  });
});

describe('boundaryDip across a seamless boundary', () => {
  it('stays clear when the start (or end) is skipped', () => {
    expect(boundaryDip(0, true, false)).toBe(0);
    expect(boundaryDip(1, false, true)).toBe(0);
    expect(boundaryDip(1, true, false)).toBe(1);
  });
});
