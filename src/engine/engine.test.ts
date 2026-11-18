import { describe, expect, it } from 'vitest';
import { measureWalk } from './characters/stride.ts';
import type { FootSample } from './characters/stride.ts';
import { FrameStats } from './metrics/frameStats.ts';
import { dprForBudget, PIXEL_BUDGET_MP } from './quality/pixelBudget.ts';

describe('FrameStats', () => {
  it('summarises percentiles', () => {
    const s = new FrameStats(100);
    for (let i = 1; i <= 100; i += 1) s.push(i);
    const r = s.summary();
    expect(r.frames).toBe(100);
    expect(r.p50).toBe(51);
    expect(r.p95).toBe(96);
    expect(r.max).toBe(100);
  });

  it('keeps only the most recent frames and ignores invalid input', () => {
    const s = new FrameStats(3);
    [10, 20, 30, 40, Number.NaN, -5].forEach((v) => s.push(v));
    expect(s.size).toBe(3);
    expect(s.summary().max).toBe(40);
    expect(s.summary().p50).toBe(30);
  });

  it('is empty-safe', () => {
    expect(new FrameStats().summary().avgFps).toBe(0);
  });
});

describe('dprForBudget', () => {
  it('caps a 2.5K laptop panel to about 2.1 MP on Balanced', () => {
    // 2560×1600 panel at 150% scaling → CSS 1707×1067, DPR 1.5 → 4.1 MP native.
    const dpr = dprForBudget(1707, 1067, 1.5, PIXEL_BUDGET_MP.balanced);
    const mp = (1707 * dpr * 1067 * dpr) / 1e6;
    expect(dpr).toBeLessThan(1.5);
    expect(mp).toBeLessThanOrEqual(2.15);
  });

  it('never exceeds the device DPR', () => {
    expect(dprForBudget(800, 600, 1, PIXEL_BUDGET_MP.balanced)).toBe(1);
  });

  it('respects the minimum DPR', () => {
    expect(dprForBudget(10000, 10000, 2, 0.1, 0.5)).toBe(0.5);
  });
});

describe('measureWalk', () => {
  // Synthetic in-place walk: 1 s cycle; each foot is planted for half the cycle, moving
  // backwards at 1.2 m/s, then swings forwards in the air.
  const foot = (phase: number): FootSample[] =>
    Array.from({ length: 120 }, (_, i) => {
      const t = i / 120;
      const u = (t + phase) % 1;
      const planted = u < 0.5;
      const h = planted ? 0.3 - 1.2 * u : -0.3 + 1.2 * (u - 0.5);
      return { t, y: planted ? 0 : 0.1 * Math.sin(Math.PI * (u - 0.5) * 2), h };
    });

  it('recovers the ground speed and direction', () => {
    const m = measureWalk([foot(0), foot(0.5)]);
    expect(m.speed).toBeCloseTo(1.2, 2);
    expect(m.direction).toBe(1);
    expect(m.samples).toBeGreaterThan(50);
  });

  it('detects reversed walking direction', () => {
    const mirrored = (s: FootSample[]) => s.map((x) => ({ ...x, h: -x.h }));
    expect(measureWalk([mirrored(foot(0))]).direction).toBe(-1);
  });

  it('returns zero speed without usable samples', () => {
    expect(measureWalk([]).speed).toBe(0);
  });
});
