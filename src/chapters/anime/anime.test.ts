import { describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import { crossingShot, styleAt as crossingStyle } from '../crossing/crossing.ts';
import { AREAS, LANDMARKS, TRAVEL, areaShot, shipZ } from './anime.ts';
import type { AreaId } from './anime.ts';

const IDS = Object.keys(AREAS) as AreaId[];

describe('SC11 anime universe', () => {
  it('has three areas with distinct skies', () => {
    expect(IDS).toHaveLength(3);
    expect(new Set(IDS.map((i) => AREAS[i].sky[0])).size).toBe(3);
  });
  it('the ship flies the same route in every area', () => {
    expect(shipZ(1)).toBe(-TRAVEL);
    expect(shipZ(0)).toBe(-0);
  });
  it('SC11-A starts exactly where SC10 ends (no cut), both fully cel-styled', () => {
    const end = createShotState();
    const start = createShotState();
    crossingShot(1, end);
    areaShot('discipline', 0, start);
    // the crossing's last camera, relative to its ship, equals the area's first, relative to its own
    expect(start.position.x).toBeCloseTo(end.position.x, 6);
    expect(start.position.y).toBeCloseTo(end.position.y, 6);
    expect(start.position.z - shipZ(0)).toBeCloseTo(end.position.z - shipZ(1), 6);
    expect(crossingStyle(1)).toBeCloseTo(2, 6);
  });
  it('at each rest point the landmark is in front of the camera and off to the panel-free side', () => {
    const s = createShotState();
    const panelRight: Record<AreaId, boolean> = { discipline: true, proof: false, horizon: true };
    for (const id of IDS) {
      areaShot(id, 0.55, s);
      const [lx, , lz] = LANDMARKS[id];
      // direction of the camera and of the landmark in the XZ plane
      const dir = [s.target.x - s.position.x, s.target.z - s.position.z] as const;
      const to = [lx - s.position.x, lz - s.position.z] as const;
      const cross = dir[0] * to[1] - dir[1] * to[0];
      // looking down -z: cross > 0 means the landmark is to the right, < 0 to the left (screen)
      expect(Math.hypot(...to)).toBeGreaterThan(0);
      // landmark on the left of the frame <=> the panel sits on the right
      expect(cross < 0).toBe(panelRight[id]);
    }
  });
  it('cameras are path independent', () => {
    for (const id of IDS) {
      const a = createShotState();
      const b = createShotState();
      areaShot(id, 0.4, a);
      areaShot(id, 0.9, b);
      areaShot(id, 0.4, b);
      expect(b.position.toArray()).toEqual(a.position.toArray());
    }
  });
});
