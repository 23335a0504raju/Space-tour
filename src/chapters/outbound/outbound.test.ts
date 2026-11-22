import { describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import { BELT, END_Z, MARS, MOON, TRAVEL, outboundShot, shipZ } from './outbound.ts';

describe('SC07 outbound maths', () => {
  it('the ship flies the full route and clamps outside [0,1]', () => {
    expect(shipZ(0)).toBe(-0);
    expect(shipZ(1)).toBe(END_Z);
    expect(shipZ(2)).toBe(END_Z);
    // it ends past the belt, in open space
    expect(END_Z).toBeLessThan(BELT.centre[2] - BELT.spread[2]);
    expect(shipZ(0.9)).toBe(-0.9 * TRAVEL);
  });
  it('passes close to the Moon, then Mars, then reaches the belt, in order', () => {
    const z = (b: { position: readonly number[] }) => b.position[2] ?? 0;
    expect(z(MOON)).toBeGreaterThan(z(MARS));
    expect(z(MARS)).toBeGreaterThan(BELT.centre[2]);
    expect(-BELT.centre[2]).toBeLessThan(TRAVEL + BELT.spread[2]);
  });
  it('camera is path independent and always looks ahead of the ship', () => {
    const a = createShotState();
    const b = createShotState();
    outboundShot(0.4, a);
    outboundShot(0.9, b);
    outboundShot(0.4, b);
    expect(b.position.toArray()).toEqual(a.position.toArray());
    expect(a.target.z).toBeLessThan(shipZ(0.4));
  });
});
