import { describe, expect, it } from 'vitest';
import { PACING, follow, wheelStep } from './pacing.ts';

describe('scroll pacing', () => {
  it('clamps a huge wheel delta to one capped step', () => {
    expect(wheelStep(5000, 0, 900)).toBe(PACING.maxStep);
    expect(wheelStep(-5000, 0, 900)).toBe(-PACING.maxStep);
    expect(wheelStep(100, 0, 900)).toBeCloseTo(55, 6);
  });
  it('normalises line and page delta modes', () => {
    expect(wheelStep(3, 1, 900)).toBeCloseTo(3 * 16 * PACING.gain, 6);
    expect(wheelStep(1, 2, 900)).toBe(PACING.maxStep);
  });
  it('never travels faster than maxSpeed, even with a far target', () => {
    let y = 0;
    for (let i = 0; i < 60; i += 1) y = follow(y, 1e6, 1);
    expect(y).toBeLessThanOrEqual(PACING.maxSpeed * 60 + 1e-6);
    expect(y).toBeGreaterThan(PACING.maxSpeed * 50);
  });
  it('settles exactly on the target and is frame-rate independent', () => {
    let a = 0;
    for (let i = 0; i < 120; i += 1) a = follow(a, 100, 1);
    expect(a).toBe(100);
    let b = 0;
    for (let i = 0; i < 60; i += 1) b = follow(b, 100, 2);
    expect(b).toBe(100);
  });
});
