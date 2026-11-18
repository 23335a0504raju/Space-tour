import { describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import {
  DECK,
  WALK,
  astronautX,
  astronautYaw,
  beaconRise,
  homecomingShot,
  walkWeight,
  walkedDistance,
} from './homecoming.ts';

describe('SC13 homecoming', () => {
  it('the astronaut walks onto the deck and ends standing on it', () => {
    expect(astronautX(0)).toBe(WALK.fromX);
    expect(astronautX(1)).toBeCloseTo(WALK.toX, 6);
    expect(DECK.x + WALK.toX).toBeLessThan(DECK.x + DECK.halfX);
    expect(DECK.x + WALK.fromX).toBeGreaterThanOrEqual(DECK.x - DECK.halfX - 1.5);
    expect(walkWeight(0.1)).toBe(1);
    expect(walkWeight(0.5)).toBe(0);
  });
  it('distance only grows while walking, then holds still (no foot sliding)', () => {
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.02) {
      expect(walkedDistance(t)).toBeGreaterThanOrEqual(prev);
      prev = walkedDistance(t);
    }
    expect(walkedDistance(0.6)).toBe(walkedDistance(1));
  });
  it('turns toward the camera after standing, and the beacon rises afterwards', () => {
    expect(astronautYaw(0.2)).toBeCloseTo(Math.PI / 2, 6);
    expect(astronautYaw(1)).toBeLessThan(Math.PI / 2);
    expect(beaconRise(0.4)).toBe(0);
    expect(beaconRise(1)).toBe(1);
  });
  it('is path independent', () => {
    const a = createShotState();
    const b = createShotState();
    homecomingShot(0.5, a);
    homecomingShot(0.9, b);
    homecomingShot(0.5, b);
    expect(b.position.toArray()).toEqual(a.position.toArray());
  });
});
