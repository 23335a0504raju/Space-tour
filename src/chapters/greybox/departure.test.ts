import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createShotState } from '../../engine/camera/shots.ts';
import { ROOM } from '../room/layout.ts';
import { WALK, chairPose, departureShot, doorOpen, walkerAt } from './departure.ts';

/** Chair footprint in its own frame (Poly Haven modern_arm_chair_01 bounds, metres). */
const CHAIR_LOCAL = { minX: -0.41, maxX: 0.41, minZ: -0.575, maxZ: 0.41 };

/** Ground distance from a point to the chair's footprint at story time t (0 = inside). */
function distanceToChair(t: number, p: THREE.Vector3): number {
  const c = chairPose(t);
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  // world → chair local (rotation about y by -rotY)
  const cos = Math.cos(-c.rotY);
  const sin = Math.sin(-c.rotY);
  const lx = dx * cos + dz * sin;
  const lz = -dx * sin + dz * cos;
  const ox = Math.max(CHAIR_LOCAL.minX - lx, 0, lx - CHAIR_LOCAL.maxX);
  const oz = Math.max(CHAIR_LOCAL.minZ - lz, 0, lz - CHAIR_LOCAL.maxZ);
  return Math.hypot(ox, oz);
}

const samples = (a: number, b: number, n = 400) =>
  Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

describe('SC03 departure motion', () => {
  const p = new THREE.Vector3();

  it('keeps the standing body clear of the chair (P3 review: chair blended into the legs)', () => {
    let min = Infinity;
    for (const t of samples(0.22, 1)) {
      walkerAt(t, p);
      min = Math.min(min, distanceToChair(t, p));
    }
    // body centre ≥ 20 cm from the chair footprint once standing
    expect(min).toBeGreaterThan(0.2);
  });

  it('keeps the camera away from the walker', () => {
    const shot = createShotState();
    let min = Infinity;
    for (const t of samples(0, 1)) {
      departureShot(t, shot);
      walkerAt(t, p);
      min = Math.min(min, Math.hypot(shot.position.x - p.x, shot.position.z - p.z));
    }
    expect(min).toBeGreaterThan(1.0);
  });

  it('opens the door fully before the body reaches the door plane, and not earlier than needed', () => {
    for (const t of samples(0, 1)) {
      walkerAt(t, p);
      if (p.x >= ROOM.halfW - 0.35) expect(doorOpen(t)).toBe(1);
      if (t <= WALK.start + 0.2) expect(doorOpen(t)).toBe(0);
    }
  });

  it('passes through the middle of the doorway', () => {
    for (const t of samples(0, 1)) {
      walkerAt(t, p);
      if (p.x > ROOM.halfW - 0.3 && p.x < ROOM.halfW + 0.3)
        expect(Math.abs(p.z - ROOM.doorZ)).toBeLessThan(ROOM.doorW / 2 - 0.3);
    }
  });

  it('is a pure function of t (reverse scrolling is exact)', () => {
    const forward = samples(0, 1, 50).map((t) => {
      const h = walkerAt(t, p);
      return [p.x, p.z, h, doorOpen(t), chairPose(t).z];
    });
    const backward = samples(0, 1, 50)
      .reverse()
      .map((t) => {
        const h = walkerAt(t, p);
        return [p.x, p.z, h, doorOpen(t), chairPose(t).z];
      })
      .reverse();
    expect(backward).toEqual(forward);
  });
});
