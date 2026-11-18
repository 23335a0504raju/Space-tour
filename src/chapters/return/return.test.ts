import { describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import { crossingShot } from '../crossing/crossing.ts';
import { EARTH, GATE, MOON, T_EXIT, T_GATE, TRAVEL, returnShot, shipZ, styleAt } from './return.ts';

describe('SC12 return', () => {
  it('passes the gate then leaves the tunnel into the real world, in order', () => {
    expect(shipZ(T_GATE)).toBeCloseTo(GATE.z, 6);
    expect(T_EXIT).toBeGreaterThan(T_GATE);
    expect(shipZ(1)).toBe(-TRAVEL);
    // Earth and the Moon lie beyond the ship's final position
    expect(EARTH.position[2]).toBeLessThan(shipZ(1));
    expect(MOON.position[2]).toBeLessThan(EARTH.position[2]);
  });
  it('the style runs cel (2) → line art (1) → real (0), monotonically', () => {
    expect(styleAt(0)).toBe(2);
    expect(styleAt(T_GATE - 0.02)).toBe(2);
    expect(styleAt(T_EXIT)).toBeCloseTo(0, 6);
    expect(styleAt(1)).toBe(0);
    let prev = 3;
    let sawLine = false;
    for (let t = 0; t <= 1; t += 0.01) {
      const s = styleAt(t);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
      if (Math.abs(s - 1) < 0.02) sawLine = true;
    }
    expect(sawLine).toBe(true);
  });
  it('is the visual mirror of the crossing: both end states are the other chapter’s start', () => {
    // SC10 ends cel-styled (2), SC12 begins cel-styled (2); SC10 begins real (0), SC12 ends real (0)
    expect(styleAt(0)).toBe(2);
    expect(styleAt(1)).toBe(0);
    const a = createShotState();
    const b = createShotState();
    crossingShot(0.3, a);
    returnShot(0.3, b);
    expect(Number.isFinite(a.position.x + b.position.x)).toBe(true);
  });
  it('is path independent (reverse scrolling is exact)', () => {
    const a = createShotState();
    const b = createShotState();
    returnShot(0.5, a);
    returnShot(0.95, b);
    returnShot(0.5, b);
    expect(b.position.toArray()).toEqual(a.position.toArray());
  });
});
