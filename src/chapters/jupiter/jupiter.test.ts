import { describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import { STATIONS, jupiterShot } from './jupiter.ts';

describe('SC08 Jupiter', () => {
  it('has one distinct installation per flagship', () => {
    expect(new Set(STATIONS.map((s) => s.kind)).size).toBe(3);
  });
  it('at each rest point the camera looks at its own station', () => {
    const s = createShotState();
    [0.25, 0.5, 0.75].forEach((t, i) => {
      jupiterShot(t, s);
      const dist = (p: readonly number[]) =>
        Math.hypot((p[0] ?? 0) - s.target.x, (p[1] ?? 0) - s.target.y, (p[2] ?? 0) - s.target.z);
      const here = STATIONS[i]?.position ?? [0, 0, 0];
      expect(dist(here)).toBeLessThan(8);
      STATIONS.forEach((o, j) => {
        if (j !== i) expect(dist(o.position)).toBeGreaterThan(dist(here));
      });
    });
  });
  it('camera is path independent', () => {
    const a = createShotState();
    const b = createShotState();
    jupiterShot(0.6, a);
    jupiterShot(0.1, b);
    jupiterShot(0.6, b);
    expect(b.position.toArray()).toEqual(a.position.toArray());
  });
});
