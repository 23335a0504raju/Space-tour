/**
 * Plan view of the SC02/SC03 set in room coordinates: the bridge (A036) as placed by layout.ts,
 * cut at a height, with the 1 m grid and the chapter layout drawn on top.
 *   node scripts/plan-view.ts [cutY=1.6] [name=plan] [minX minZ span]   (zoom window, room metres)
 * Writes spike-results/models/<name>-cut<cutY>.png. Needs the raw GLB (no KTX2 in this tool):
 * raw-assets/sf_bridge_console/bridge.raw.glb (gltf-transform copy of the Sketchfab download).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import * as THREE from 'three';
import { createShotState } from '../src/engine/camera/shots.ts';
import { BRIDGE, CHAIR_REST, DESK, LIFT, PIT, SEAT } from '../src/chapters/room/layout.ts';
import {
  PATH_POINTS,
  departureKeys,
  departureShot,
  roomKeys,
  walkerAt,
} from '../src/chapters/greybox/departure.ts';
import type { PlanRequest } from '../src/tools/planView.ts';

const cutY = Number(process.argv[2] ?? 1.6);
const name = process.argv[3] ?? 'plan';
const zoom = process.argv.slice(4, 7).map(Number);
const view =
  zoom.length === 3 && zoom.every(Number.isFinite)
    ? { minX: zoom[0] ?? -9, minZ: zoom[1] ?? -15, span: zoom[2] ?? 17 }
    : { minX: -9, minZ: -15, span: 17 };
const outDir = join(import.meta.dirname, '..', 'spike-results', 'models');
mkdirSync(outDir, { recursive: true });

const circle = (x: number, z: number, r: number) =>
  Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    return [x + Math.cos(a) * r, z + Math.sin(a) * r] as const;
  });
const walk = Array.from({ length: 81 }, (_, i) => {
  const p = new THREE.Vector3();
  walkerAt(i / 80, p);
  return [p.x, p.z] as const;
});
const shot = createShotState();
const camPath = Array.from({ length: 81 }, (_, i) => {
  departureShot(i / 80, shot);
  return [shot.position.x, shot.position.z] as const;
});

const req: PlanRequest = {
  url: '/raw-assets/sf_bridge_console/bridge.raw.glb',
  position: BRIDGE.position,
  rotationY: BRIDGE.rotationY,
  cutY: cutY,
  view,
  overlay: {
    lines: [
      {
        pts: [
          [-1, DESK.z - 0.475],
          [1, DESK.z - 0.475],
          [1, DESK.z + 0.475],
          [-1, DESK.z + 0.475],
        ],
        color: '#ffd166',
        label: 'desk',
        closed: true,
      },
      { pts: circle(PIT.x, PIT.z, PIT.radius), color: '#7fb4ff', label: 'pit', closed: true },
      { pts: circle(LIFT.x, LIFT.z, LIFT.radius), color: '#f4f7ff', label: 'lift', closed: true },
      { pts: walk, color: '#06d6a0', label: 'walk' },
      { pts: camPath, color: '#ef476f', label: 'SC03 cam' },
      { pts: PATH_POINTS.map(([x, z]) => [x, z] as const), color: 'rgba(6,214,160,0.35)' },
    ],
    points: [
      { x: SEAT[0], z: SEAT[2], color: '#ffffff', label: 'seat' },
      { x: CHAIR_REST.x, z: CHAIR_REST.z + 0.05, color: '#999', label: '', r: 3 },
      ...roomKeys.map((k) => ({
        x: k.position[0],
        z: k.position[2],
        color: '#ff9f1c',
        label: `SC02 t${k.t}`,
      })),
      ...departureKeys.map((k) => ({
        x: k.position[0],
        z: k.position[2],
        color: '#ef476f',
        label: `SC03 t${k.t}`,
        r: 4,
      })),
    ],
  },
};

const server = await createServer({
  root: join(import.meta.dirname, '..'),
  server: { port: 5185, strictPort: true },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto('http://localhost:5185/tools/plan-view.html');
  await page.waitForFunction(() => typeof window.planRender === 'function');
  const info = await page.evaluate((r) => window.planRender?.(r), req);
  const file = join(outDir, `${name}-cut${cutY}${zoom.length === 3 ? '-zoom' : ''}.png`);
  await page.locator('#wrap').screenshot({ path: file });
  console.log(`✓ ${file}`, info);
} finally {
  await browser.close();
  await server.close();
}
