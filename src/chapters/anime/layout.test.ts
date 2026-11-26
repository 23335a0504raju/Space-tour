import { describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import { ORDER, areaShot, cloudSea, presence, shipZ } from './anime.ts';
import type { AreaId } from './anime.ts';
import {
  FARMS,
  FARM_FOOTPRINT,
  GROUND,
  HILL,
  ICHIRAKU,
  NARUTO_TOWER,
  RURAL,
  SHIP_ENVELOPE,
  STREET,
  TORII_Z,
  TOWN,
  VILLAGE_HOUSES,
} from './layout.ts';

/** Every camera position the three worlds use (t in steps of 0.005). */
function cameraPath(area: AreaId) {
  const s = createShotState();
  const out: Array<[number, number, number]> = [];
  for (let t = 0; t <= 1.0001; t += 0.005) {
    areaShot(area, t, s);
    out.push([s.position.x, s.position.y, s.position.z]);
  }
  return out;
}

describe('SC11 world layouts', () => {
  it('no village house stands in the ship corridor or round the camera', () => {
    const flight = [shipZ(1) - 40, 60];
    for (const h of VILLAGE_HOUSES) {
      const inner = Math.abs(h.x) - h.w / 2;
      const overFlight = h.z + h.d / 2 > flight[0]! && h.z - h.d / 2 < flight[1]!;
      if (overFlight) expect(inner).toBeGreaterThan(SHIP_ENVELOPE.halfWidth);
      expect(inner).toBeGreaterThanOrEqual(STREET);
    }
    for (const [x, y, z] of cameraPath('discipline'))
      for (const h of VILLAGE_HOUSES) {
        const inside =
          Math.abs(x - h.x) < h.w / 2 + 1 &&
          Math.abs(z - h.z) < h.d / 2 + 1 &&
          y < h.y + h.h + h.w * 0.6;
        expect(inside).toBe(false);
      }
  });

  it('the village props keep clear of the houses', () => {
    for (const h of VILLAGE_HOUSES) {
      expect(Math.hypot(h.x - ICHIRAKU.x, h.z - ICHIRAKU.z)).toBeGreaterThan(30);
      expect(Math.hypot(h.x - NARUTO_TOWER.x, h.z - NARUTO_TOWER.z)).toBeGreaterThan(20);
    }
  });

  it('the cameras pass between the torii pillars and under the beams', () => {
    // pillars at ±17 × 1.6 m, the top beam's underside 31.4 × 1.6 m above the ground
    for (const [x, y, z] of cameraPath('discipline'))
      for (const tz of TORII_Z)
        if (Math.abs(z - tz) < 4) {
          expect(Math.abs(x)).toBeLessThan(17 * 1.6 - 3);
          expect(y).toBeLessThan(GROUND.discipline + 31.4 * 1.6);
        }
  });

  it('the town cameras stay inside the street, above the dirt', () => {
    for (const [x, y] of cameraPath('proof')) {
      expect(Math.abs(x)).toBeLessThan(TOWN.street);
      expect(y).toBeGreaterThan(GROUND.proof + 5);
    }
    for (const r of RURAL) expect(Math.abs(r.x)).toBeGreaterThan(TOWN.street + 10);
  });

  it('farm tiles keep the road and the cameras clear', () => {
    const maxCam = Math.max(...cameraPath('horizon').map(([x]) => Math.abs(x)));
    for (const f of FARMS) {
      const quarter = Math.abs(Math.sin(f.rotY)) > 0.5;
      const halfX = (quarter ? FARM_FOOTPRINT.z : FARM_FOOTPRINT.x) / 2;
      expect(Math.abs(f.x) - halfX).toBeGreaterThan(maxCam + 8);
    }
  });

  it('the blossom hill keeps off the road and the farm tiles', () => {
    // the sphere cap's footprint radius on the ground
    const cap = Math.sqrt(HILL.radius ** 2 - (HILL.radius - HILL.height) ** 2);
    expect(Math.abs(HILL.x) - cap).toBeGreaterThan(8);
    for (const f of FARMS) {
      const quarter = Math.abs(Math.sin(f.rotY)) > 0.5;
      const hx = (quarter ? FARM_FOOTPRINT.z : FARM_FOOTPRINT.x) / 2;
      const hz = (quarter ? FARM_FOOTPRINT.x : FARM_FOOTPRINT.z) / 2;
      const apart = Math.abs(f.x - HILL.x) > hx + cap || Math.abs(f.z - HILL.z) > hz + cap;
      expect(apart).toBe(true);
    }
  });

  it('worlds rise in and sink away; the cloud sea only fills the joins between them', () => {
    expect(presence(0)).toBe(0);
    expect(presence(1)).toBe(0);
    expect(presence(0.55)).toBe(1);
    // SC10's cloud deck covers the first entry, SC12 opens on clear sky after the last exit
    expect(cloudSea(ORDER[0]!, 0)).toBe(0);
    expect(cloudSea(ORDER[ORDER.length - 1]!, 1)).toBe(0);
    for (const a of ORDER) expect(cloudSea(a, 0.55)).toBe(0);
  });
});
