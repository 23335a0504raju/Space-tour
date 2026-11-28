import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createHoloGeometry, panePoint } from '../holo/geometry.ts';
import { KIND, SCREEN } from '../holo/panes.ts';
import type { Pane } from '../holo/panes.ts';
import { ATLAS, CODE, PANES, RECTS } from './holoLayout.ts';
import { DESK, FACE_HOLOGRAM } from './layout.ts';

const screens = PANES.filter((p) => p.kind === KIND.screen && p.screen !== SCREEN.glass);

/** Room-space bounds of one pane. */
function bounds(pane: Pane) {
  const box = new THREE.Box3();
  for (const u of [-0.5, 0, 0.5]) {
    for (const v of [-0.5, 0.5]) {
      box.expandByPoint(panePoint(pane, u * pane.width, v * pane.height));
    }
  }
  return box;
}

describe('SC02 floating screens', () => {
  it('floats every screen clear of the desk', () => {
    for (const pane of screens) {
      const box = bounds(pane);
      expect(box.min.y - pane.float).toBeGreaterThan(DESK.top + 0.2);
    }
  });

  it("keeps the screens behind Raju's hologram", () => {
    for (const pane of screens) {
      const box = bounds(pane);
      if (box.max.x < FACE_HOLOGRAM.x - 0.24) continue;
      expect(box.max.z).toBeLessThan(FACE_HOLOGRAM.z - 0.03);
    }
  });

  it('hangs the screens side by side without crossing', () => {
    const boxes = screens.map(bounds).sort((a, b) => a.min.x - b.min.x);
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
    expect(CODE.top + CODE.line * CODE.lines).toBeLessThanOrEqual(RECTS.main.h);
  });

  it('draws all panes in one geometry', () => {
    const g = createHoloGeometry(PANES);
    const vertices = g.getAttribute('position').count;
    for (const name of ['uv', 'aRect', 'aPane', 'aMotion', 'aLook']) {
      expect(g.getAttribute(name).count).toBe(vertices);
    }
    expect(g.getIndex()!.count / 3).toBeLessThan(300);
    g.dispose();
  });
});
