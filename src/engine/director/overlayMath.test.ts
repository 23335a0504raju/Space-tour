import { describe, expect, it } from 'vitest';
import { CARD_IN_S, CARD_OUT_S, boundaryDip, easeVisibility, restOpacity } from './overlayMath.ts';

describe('easeVisibility', () => {
  const run = (from: number, wanted: number, seconds: number) => {
    let v = from;
    for (let t = 0; t < seconds - 1e-9; t += 0.01) v = easeVisibility(v, wanted, 0.01);
    return v;
  };
  it('takes its time to enter, and leaves faster', () => {
    expect(run(0, 1, CARD_IN_S / 2)).toBeCloseTo(0.5, 2);
    expect(run(0, 1, CARD_IN_S)).toBeCloseTo(1, 6);
    expect(run(1, 0, CARD_OUT_S)).toBeCloseTo(0, 6);
    expect(CARD_OUT_S).toBeLessThan(CARD_IN_S);
  });
  it('settles exactly on what the scroll asks for, from either side', () => {
    expect(run(0, 1, 5)).toBe(1);
    expect(run(1, 0, 5)).toBe(0);
    expect(easeVisibility(0.4, 0.4, 0.016)).toBe(0.4);
  });
});

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
