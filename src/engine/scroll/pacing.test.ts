import { describe, expect, it } from 'vitest';
import {
  PACING,
  admitWheel,
  chargeBurst,
  clampLead,
  createBurst,
  follow,
  wheelStep,
} from './pacing.ts';

const VH = 900;

describe('scroll pacing', () => {
  it('passes a mouse notch whole and clamps a huge delta to one capped step', () => {
    expect(wheelStep(100, 0, VH)).toBe(100);
    expect(wheelStep(5000, 0, VH)).toBe(PACING.maxStep * VH);
    expect(wheelStep(-5000, 0, VH)).toBe(-PACING.maxStep * VH);
  });

  it('normalises line and page delta modes', () => {
    expect(wheelStep(3, 1, VH)).toBe(48);
    expect(wheelStep(1, 2, VH)).toBe(PACING.maxStep * VH);
  });

  it('delivers one notch in full, like the reference: half in 0.1 s, 90 % within 0.35 s', () => {
    let y = 0;
    const target = clampLead(0, wheelStep(100, 0, VH), VH);
    for (let i = 0; i < 6; i += 1) y = follow(y, target, 1);
    expect(y).toBeGreaterThan(45);
    expect(y).toBeLessThan(60);
    for (let i = 6; i < 21; i += 1) y = follow(y, target, 1);
    expect(y).toBeGreaterThan(90);
    for (let i = 0; i < 90; i += 1) y = follow(y, target, 1);
    expect(y).toBe(100);
  });

  it('keeps up with a brisk mouse wheel (10 notches per second) without losing input', () => {
    let y = 0;
    let target = 0;
    for (let f = 0; f < 120; f += 1) {
      if (f % 6 === 0) target = clampLead(y, target + wheelStep(100, 0, VH), VH);
      y = follow(y, target, 1);
    }
    for (let f = 0; f < 60; f += 1) y = follow(y, target, 1);
    expect(y).toBe(2000);
  });

  it('speed is bounded smoothly by the lead: never more than maxLead × ease per frame', () => {
    let y = 0;
    let target = 0;
    let fastest = 0;
    for (let i = 0; i < 120; i += 1) {
      target = clampLead(y, target + 400, VH); // input far beyond the lead, every frame
      const next = follow(y, target, 1);
      fastest = Math.max(fastest, next - y);
      y = next;
    }
    expect(fastest).toBeLessThanOrEqual(PACING.maxLead * VH * PACING.ease + 1e-6);
  });

  it('eases out without a constant-speed plateau (one ease, no cap)', () => {
    let y = 0;
    const steps: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      const next = follow(y, 300, 1);
      steps.push(next - y);
      y = next;
    }
    for (let i = 1; i < steps.length; i += 1) expect(steps[i]!).toBeLessThan(steps[i - 1]!);
  });

  it('discards input beyond the lead instead of queueing it', () => {
    let target = 1000;
    for (let i = 0; i < 200; i += 1) target = clampLead(1000, target + 90, VH);
    expect(target).toBe(1000 + PACING.maxLead * VH);
    expect(clampLead(1000, 0, VH)).toBe(1000 - PACING.maxLead * VH);
  });

  /** Same wiring as usePacedWheel: deltas[f] is the wheel delta at frame f (0 = no event). */
  function simulate(deltas: number[]): { screens: number; spent: number } {
    const burst = createBurst();
    let y = 0;
    let target = 0;
    const frames = deltas.length + 180;
    for (let f = 0; f < frames; f += 1) {
      const d = deltas[f] ?? 0;
      if (d && admitWheel(burst, f * (1000 / 60), VH))
        target = clampLead(y, target + wheelStep(d, 0, VH), VH);
      const next = follow(y, target, 1);
      chargeBurst(burst, next - y, target - y, VH);
      y = next;
    }
    return { screens: y / VH, spent: burst.spent };
  }

  it('a hard trackpad flick (1 s of momentum) travels about one chapter', () => {
    const { screens } = simulate(Array.from({ length: 60 }, (_, i) => 160 * 0.95 ** i));
    expect(screens).toBeGreaterThan(1);
    expect(screens).toBeLessThan(2.2);
  });

  it('a very hard fling (2 s of momentum, 9 screens of input) still stops after about one chapter', () => {
    const { screens } = simulate(Array.from({ length: 120 }, (_, i) => 260 * 0.97 ** i));
    expect(screens).toBeLessThan(2.2);
  });

  it('never cuts a steady wheel: 60 notches at 10 per second all arrive', () => {
    const deltas = Array.from({ length: 360 }, (_, f) => (f % 6 === 0 ? 100 : 0));
    const { screens, spent } = simulate(deltas);
    expect(spent).toBe(0);
    expect(screens * VH).toBeCloseTo(6000, 0);
  });

  it('a pause starts a fresh stream, so a spent fling does not block the next scroll', () => {
    const b = createBurst();
    expect(admitWheel(b, 0, VH)).toBe(true);
    b.spent = 10 * VH;
    expect(admitWheel(b, 16, VH)).toBe(false);
    expect(admitWheel(b, 16 + PACING.streamGapMs + 1, VH)).toBe(true);
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
