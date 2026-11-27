import { describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import { ORDER, areaShot, shipZ } from './anime.ts';
import {
  ENTRY,
  EXIT,
  aheadPlanet,
  createPlanetState,
  leavingPlanet,
  presence,
  shipPitch,
  spaceAt,
  voyageAt,
} from './voyage.ts';

describe('SC11 voyage between worlds', () => {
  it('runs once across each boundary, forward only', () => {
    for (let i = 0; i + 1 < ORDER.length; i += 1) {
      let last = -1;
      const steps = [
        ...Array.from({ length: 50 }, (_, k) => [ORDER[i]!, EXIT + (k / 49) * (1 - EXIT)] as const),
        ...Array.from({ length: 49 }, (_, k) => [ORDER[i + 1]!, (k / 49) * ENTRY] as const),
      ];
      for (const [area, t] of steps.slice(1)) {
        const v = voyageAt(area, t)!;
        expect(v.join).toBe(i);
        expect(v.u).toBeGreaterThanOrEqual(last);
        last = v.u;
      }
    }
  });

  it('leaves the first world and the last one to their own joins (SC10, SC12)', () => {
    expect(voyageAt(ORDER[0]!, 0)).toBeNull();
    expect(voyageAt(ORDER[ORDER.length - 1]!, 1)).toBeNull();
    for (const a of ORDER) expect(voyageAt(a, 0.55)).toBeNull();
  });

  it('is in open space only while neither world can be seen', () => {
    for (const a of ORDER)
      for (let t = 0; t <= 1; t += 0.002)
        if (spaceAt(voyageAt(a, t)) > 0.99) expect(presence(a, t)).toBeLessThan(0.05);
  });

  it('starts and ends level, with no space left over', () => {
    for (const u of [0, 1]) {
      expect(spaceAt({ join: 0, u })).toBe(0);
      expect(shipPitch({ join: 0, u })).toBeCloseTo(0, 9);
    }
  });

  it('the planets never swallow the ship or its camera, and never jump', () => {
    const planet = createPlanetState();
    const shot = createShotState();
    for (const place of [leavingPlanet, aheadPlanet]) {
      let last: number[] | null = null;
      for (let u = 0; u <= 1; u += 0.002) {
        place(u, planet);
        if (!planet.visible) {
          last = null;
          continue;
        }
        // the camera in the voyage's own terms: relative to the ship, in either chapter
        const area = u < 0.5 ? ORDER[0]! : ORDER[1]!;
        const t = u < 0.5 ? EXIT + 2 * u * (1 - EXIT) : (2 * u - 1) * ENTRY;
        areaShot(area, t, shot);
        const cam = shot.position;
        for (const [x, y, z] of [
          [0, 0, 0],
          [cam.x, cam.y, cam.z - shipZ(t)],
        ] as const) {
          const gap = Math.hypot(x - planet.x, y - planet.y, z - planet.z) - planet.radius;
          expect(gap).toBeGreaterThan(20);
        }
        // inside the sky dome (1200 m) wherever it can be seen
        expect(Math.hypot(planet.x, planet.y, planet.z) - planet.radius).toBeLessThan(1150);
        const now = [planet.x, planet.y, planet.z, planet.radius];
        if (last) now.forEach((n, k) => expect(Math.abs(n - last![k]!)).toBeLessThan(20));
        last = now;
      }
    }
  });
});
