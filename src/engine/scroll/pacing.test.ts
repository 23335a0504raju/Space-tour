import { describe, expect, it } from 'vitest';
import { PACING, clampLead, follow, wheelStep } from './pacing.ts';

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
  it('discards input beyond the lead instead of queueing it', () => {
    let target = 1000;
    for (let i = 0; i < 200; i += 1) target = clampLead(1000, target + 90);
    expect(target).toBe(1000 + PACING.maxLead);
    expect(clampLead(1000, 0)).toBe(1000 - PACING.maxLead);
  });
  it('settles within 0.5 s of the last wheel event after a long flick', () => {
    let y = 1000;
    let target = y;
    for (let i = 0; i < 120; i += 1) {
      target = clampLead(y, target + 90);
      y = follow(y, target, 1);
    }
    // wheel goes quiet: the page keeps following for idleMs, then the remaining lead is dropped
    const idleFrames = Math.ceil((PACING.idleMs / 1000) * 60);
    for (let i = 0; i < idleFrames; i += 1) y = follow(y, target, 1);
    target = y;
    const travelled = Math.abs(follow(y, target, 1) - y);
    expect(travelled).toBe(0);
    expect(idleFrames / 60).toBeLessThan(0.3);
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
