import { describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import { GATE, T_EXIT, T_GATE, TRAVEL, crossingShot, shipZ, styleAt } from './crossing.ts';

describe('SC10 crossing', () => {
  it('the ship passes the gate then leaves the tunnel, in order', () => {
    expect(shipZ(T_GATE)).toBeCloseTo(GATE.z, 6);
    expect(T_EXIT).toBeGreaterThan(T_GATE);
    expect(shipZ(1)).toBe(-TRAVEL);
  });
  it('the art style is realistic before the gate and cel colour after the tunnel', () => {
    expect(styleAt(0)).toBe(0);
    expect(styleAt(T_GATE - 0.05)).toBe(0);
    expect(styleAt(1)).toBeCloseTo(2, 6);
    expect(styleAt(T_EXIT)).toBeCloseTo(2, 6);
  });
  it('the blend is monotonic and passes through line art (1) on the way', () => {
    let prev = -1;
    let sawLine = false;
    for (let t = 0; t <= 1; t += 0.01) {
      const s = styleAt(t);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
      if (Math.abs(s - 1) < 0.02) sawLine = true;
    }
    expect(sawLine).toBe(true);
  });
  it('is path independent (reverse scrolling is exact)', () => {
    const a = createShotState();
    const b = createShotState();
    crossingShot(0.5, a);
    crossingShot(0.9, b);
    crossingShot(0.5, b);
    expect(b.position.toArray()).toEqual(a.position.toArray());
    expect(styleAt(0.6)).toBe(styleAt(0.6));
  });
});
