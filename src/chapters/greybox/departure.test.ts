import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createShotState } from '../../engine/camera/shots.ts';
import { DESK, LIFT, PIT, PLATFORM } from '../room/layout.ts';
import { LIFT_INSIDE, WALK, chairPose, departureShot, liftLight, walkerAt } from './departure.ts';

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

  it('ends inside the lift, with its light full only at the end', () => {
    walkerAt(1, p);
    expect(Math.hypot(p.x - LIFT_INSIDE.x, p.z - LIFT_INSIDE.z)).toBeLessThan(0.05);
    expect(liftLight(1)).toBe(1);
    for (const t of samples(0, WALK.start + 0.3)) expect(liftLight(t)).toBe(0);
  });

  it('walks around the desk and the hologram pit, never through them', () => {
    // desk footprint (layout.ts DESK: 2.0 m wide, 0.95 m deep, centred at x 0, z DESK.z)
    const desk = { minX: -1, maxX: 1, minZ: DESK.z - 0.475, maxZ: DESK.z + 0.475 };
    for (const t of samples(WALK.start, 1)) {
      walkerAt(t, p);
      const ox = Math.max(desk.minX - p.x, 0, p.x - desk.maxX);
      const oz = Math.max(desk.minZ - p.z, 0, p.z - desk.maxZ);
      expect(Math.hypot(ox, oz)).toBeGreaterThan(0.3); // body radius plus a margin
      expect(Math.hypot(p.x - PIT.x, p.z - PIT.z)).toBeGreaterThan(PIT.radius + 0.5);
    }
  });

  it('climbs the platform stairs instead of walking through them (Raju review, 2026-11-19)', () => {
    // on the deck before the stair foot, platform height on the platform, lift height at the end
    let maxY = 0;
    for (const t of samples(0, 1)) {
      walkerAt(t, p);
      maxY = Math.max(maxY, p.y);
      if (p.z > -3.3) expect(p.y).toBeLessThan(0.05); // still on the deck
      if (p.x < -5.0 && p.z < -4.5 && p.z > -6.5) expect(p.y).toBeCloseTo(PLATFORM.height, 1);
    }
    expect(maxY).toBeLessThan(PLATFORM.height + 0.06); // never floats above the platform
    walkerAt(1, p);
    expect(p.y).toBeCloseTo(LIFT.y, 2);
  });

  it('is a pure function of t (reverse scrolling is exact)', () => {
    const forward = samples(0, 1, 50).map((t) => {
      const h = walkerAt(t, p);
      return [p.x, p.z, h, liftLight(t), chairPose(t).z];
    });
    const backward = samples(0, 1, 50)
      .reverse()
      .map((t) => {
        const h = walkerAt(t, p);
        return [p.x, p.z, h, liftLight(t), chairPose(t).z];
      })
      .reverse();
    expect(backward).toEqual(forward);
  });
});
