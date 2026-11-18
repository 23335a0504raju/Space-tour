import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createShotState } from '../../engine/camera/shots.ts';
import { HELVELA } from '../ship/helvelaDimensions.ts';
import {
  BEATS,
  CLOUDS,
  PAD,
  altitude,
  armSwing,
  ascentShot,
  clampsOpen,
  engine,
  liftJets,
  pitch,
  shipPose,
} from './ascent.ts';

const samples = (a: number, b: number, n = 1000) =>
  Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

describe('SC05 ascent story (HelVela VTOL departure)', () => {
  it('holds the ship on its cradles until the clamps release, then only climbs', () => {
    let last = -1;
    for (const t of samples(0, 1)) {
      const a = altitude(t);
      if (t <= BEATS.liftoff) expect(a).toBe(0);
      if (a > 0) expect(clampsOpen(t)).toBe(1);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
  });

  it('orders the beats: arm away → ignition → release → vertical lift → pitch-up climb', () => {
    expect(armSwing(BEATS.ignition[0] + 0.05)).toBeGreaterThan(0.5);
    expect(engine(BEATS.arm[0])).toBe(0);
    expect(engine(BEATS.liftoff)).toBe(1);
    expect(liftJets(BEATS.liftoff)).toBe(1);
    // vertical lift: no pitch until the hover
    expect(pitch(BEATS.hover - 0.01)).toBe(0);
    expect(pitch(0.7)).toBeGreaterThan(0.2);
    // the lift jets are off once the climb is established
    expect(liftJets(0.6)).toBe(0);
  });

  it('punches through the cloud deck during the onboard shot', () => {
    const shot = createShotState();
    const cross = (h: number) =>
      samples(0, 1).find((t) => (ascentShot(t, shot, true), shot.position.y >= h)) ?? 1;
    expect(cross(CLOUDS.bottom)).toBeGreaterThan(BEATS.onboard[0]);
    expect(cross(CLOUDS.top)).toBeLessThan(BEATS.onboard[1]);
  });

  it('never puts the camera inside the hull, the tower or the ground', () => {
    const shot = createShotState();
    const pos = new THREE.Vector3();
    const local = new THREE.Vector3();
    const half = HELVELA.length / 2 + 1;
    const tw = PAD.tower;
    for (const t of samples(0, 1)) {
      ascentShot(t, shot, true);
      const { x, y, z } = shot.position;
      expect(y).toBeGreaterThan(1);
      // camera in the ship's frame (undo the keel position and the pitch about z)
      const rz = shipPose(t, pos);
      const dx = x - pos.x;
      const dy = y - pos.y;
      local.set(
        dx * Math.cos(-rz) - dy * Math.sin(-rz),
        dx * Math.sin(-rz) + dy * Math.cos(-rz),
        z,
      );
      const inHull =
        Math.abs(local.x) < half &&
        local.y > -1 &&
        local.y < HELVELA.height + 1.5 &&
        Math.abs(local.z) < HELVELA.width / 2 + 1;
      expect(inHull).toBe(false);
      const inTower =
        Math.abs(x - tw.x) < tw.half + 1 && Math.abs(z - tw.z) < tw.half + 1 && y < tw.height + 9;
      expect(inTower).toBe(false);
    }
  });

  it('is a pure function of t, and reduced motion removes only the shake', () => {
    const a = createShotState();
    const b = createShotState();
    for (const t of samples(0, 1, 200)) {
      ascentShot(t, a, false);
      ascentShot(t, b, false);
      expect(a.position.toArray()).toEqual(b.position.toArray());
      ascentShot(t, b, true);
      expect(a.position.distanceTo(b.position)).toBeLessThan(0.4);
      expect(a.target.toArray()).toEqual(b.target.toArray());
    }
  });
});
