import { describe, expect, it } from 'vitest';
import { EARTH, engineLevel, SHIP_YAW, sunAngle, sunDirection, sunLight } from './sunrise.ts';

describe('SC06 sunrise maths', () => {
  it('the Sun starts below the limb and ends above it', () => {
    expect(sunAngle(0)).toBeLessThan(0);
    expect(sunAngle(0.7)).toBeGreaterThan(0.1);
  });
  it('sun direction is a unit vector and light ramps up monotonically', () => {
    const d: [number, number, number] = [0, 0, 0];
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      sunDirection(t, d);
      expect(Math.hypot(...d)).toBeCloseTo(1, 6);
      expect(sunLight(t)).toBeGreaterThanOrEqual(prev);
      prev = sunLight(t);
    }
  });
  it('is path independent and the engines burn only on departure', () => {
    expect(SHIP_YAW).toBe(-Math.PI / 2);
    expect(engineLevel(0.7)).toBe(0);
    expect(engineLevel(1)).toBeCloseTo(1, 6);
    expect(EARTH.radius).toBeGreaterThan(0);
  });
});
