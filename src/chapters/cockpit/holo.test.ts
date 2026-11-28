import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createHoloGeometry, panePoint } from '../holo/geometry.ts';
import { chapters } from '../registry.ts';
import { ARRIVAL, IGNITION, SCREENS_OPEN, ignitionAt, screensOpen } from './arrival.ts';
import { ATLAS, DASH, PANES, RECTS, SCREENS, onDash } from './holoLayout.ts';

describe('SC04 floating screens', () => {
  it('stays folded through the walk, is open at every card and gone before the exit', () => {
    expect(screensOpen(ARRIVAL.walk[1])).toBe(0);
    const rests = chapters.find((c) => c.id === 'sc04-crew-record')!.restPoints;
    for (const t of rests) expect(screensOpen(t)).toBe(1);
    for (const t of [SCREENS_OPEN.fold[1], 0.86, 1]) expect(screensOpen(t)).toBe(0);
  });

  it('floats clear of the dash, side by side', () => {
    const boxes = Object.values(SCREENS).map((pane) => {
      const box = new THREE.Box3();
      for (const u of [-0.5, 0, 0.5]) {
        for (const v of [-0.5, 0.5]) {
          box.expandByPoint(panePoint(pane, u * pane.width, v * pane.height));
        }
      }
      return box;
    });
    for (const box of boxes) {
      // the panel face under the screen's farthest edge is well below it
      const up = (onDash(0, 0)[2] - box.min.z) / Math.sin(DASH.tilt);
      expect(box.min.y - onDash(0, up)[1]).toBeGreaterThan(0.1);
    }
    boxes.sort((a, b) => a.min.x - b.min.x);
    for (let i = 1; i < boxes.length; i += 1) {
      expect(boxes[i]!.min.x).toBeGreaterThan(boxes[i - 1]!.max.x);
    }
  });

  it('keeps every picture on the atlas, none over another', () => {
    const rects = Object.values(RECTS);
    for (const [i, a] of rects.entries()) {
      expect(a.x + a.w).toBeLessThanOrEqual(ATLAS.width);
      expect(a.y + a.h).toBeLessThanOrEqual(ATLAS.height);
      for (const b of rects.slice(i + 1)) {
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it('assembles piece by piece and is whole when fully open', () => {
    for (const pane of PANES) {
      expect(pane.delay).toBeGreaterThanOrEqual(0);
      expect(pane.delay).toBeLessThanOrEqual(0.5);
    }
  });

  it('draws all panes in one geometry', () => {
    const g = createHoloGeometry(PANES);
    expect(g.getAttribute('aMotion').count).toBe(g.getAttribute('position').count);
    expect(g.getIndex()!.count / 3).toBeLessThan(400);
    g.dispose();
  });
});

describe('SC04 ignition', () => {
  const at = (t: number) => ignitionAt(t, { show: 0, arm: 0, press: 0, fire: 0 });

  it('waits until the crew record is done', () => {
    expect(at(0.7)).toEqual({ show: 0, arm: 0, press: 0, fire: 0 });
  });

  it('presses only once the cover is fully open, and stays pressed to the end', () => {
    expect(IGNITION.press[0]).toBeGreaterThan(IGNITION.arm[1]);
    expect(at(IGNITION.press[0]).arm).toBe(1);
    expect(at(1)).toEqual({ show: 1, arm: 1, press: 1, fire: 1 });
  });
});
