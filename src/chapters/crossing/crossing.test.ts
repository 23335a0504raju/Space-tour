import { describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import {
  GATE,
  T_EXIT,
  T_GATE,
  T_OUT,
  TRAVEL,
  TUNNEL,
  backdropAt,
  crossingShot,
  emptySkyAt,
  shipZ,
  spaceSkyAt,
  styleAt,
} from './crossing.ts';

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
    expect(styleAt(T_OUT)).toBeCloseTo(2, 6);
  });
  it('the camera leaves the tunnel through its mouth, never through the wall', () => {
    const s = createShotState();
    for (let t = 0; t <= 1; t += 0.005) {
      crossingShot(t, s);
      const inside = s.position.z < TUNNEL.start && s.position.z > TUNNEL.end;
      if (inside) expect(Math.hypot(s.position.x, s.position.y)).toBeLessThan(TUNNEL.radius * 0.9);
    }
    crossingShot(T_OUT, s);
    expect(s.position.z).toBeLessThan(TUNNEL.end);
  });
  it('the stars are gone before the sky is painted', () => {
    expect(spaceSkyAt(0.7)).toBe(1);
    expect(spaceSkyAt(T_OUT)).toBe(0);
  });
  it('dark pixels stay open space until the sky is left empty, then become drawn things', () => {
    // while the tunnel and space are on screen the painted sky replaces whatever is dark
    expect(backdropAt(0)).toBe(1);
    expect(backdropAt(T_OUT)).toBe(1);
    // the ship's own colour is back before the join, so SC11 (backdrop 0) matches the last frame
    expect(backdropAt(1)).toBe(0);
    // and the sky never relies on the dark rule once that starts to fade
    for (let t = 0; t <= 1; t += 0.005) if (backdropAt(t) < 1) expect(emptySkyAt(t)).toBe(true);
    // the switch to an empty sky happens only once the picture is fully painted
    expect(emptySkyAt(T_OUT - 0.01)).toBe(false);
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
