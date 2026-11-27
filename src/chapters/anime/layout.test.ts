import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { beforeAll, describe, expect, it } from 'vitest';
import { createShotState } from '../../engine/camera/shots.ts';
import { ORDER, areaShot, shipZ } from './anime.ts';
import type { AreaId } from './anime.ts';
import {
  DEATH_NOTE,
  DROP,
  FARMS,
  FARM_FOOTPRINT,
  FOREST_TREES,
  GROUND,
  RURAL,
  RYUK,
  SHIP_ENVELOPE,
  SWORD_STAND,
  TOWN,
  VALLEY_CAST,
  VILLAGE,
  VILLAGE_CAST,
} from './layout.ts';
import { presence } from './voyage.ts';

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

type Tri = readonly [number[], number[], number[]];
/** The shipped village model's triangles, placed in the chapter frame, bucketed on a 20 m grid. */
const CELL = 20;
const buckets = new Map<string, Tri[]>();

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const file = join(process.cwd(), 'public', 'assets', 'models', 'anime_village.glb');
  const doc = await io.readBinary(new Uint8Array(readFileSync(file)));
  const c = Math.cos(VILLAGE.yaw);
  const s = Math.sin(VILLAGE.yaw);
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!;
      const idx = prim.getIndices()!;
      const v = [0, 0, 0];
      const points = Array.from({ length: pos.getCount() }, (_, i) => {
        pos.getElement(i, v);
        const x = m[0] * v[0]! + m[4] * v[1]! + m[8] * v[2]! + m[12];
        const y = m[1] * v[0]! + m[5] * v[1]! + m[9] * v[2]! + m[13];
        const z = m[2] * v[0]! + m[6] * v[1]! + m[10] * v[2]! + m[14];
        return [
          VILLAGE.position[0] + VILLAGE.scale * (c * x + s * z),
          VILLAGE.position[1] + VILLAGE.scale * y,
          VILLAGE.position[2] + VILLAGE.scale * (-s * x + c * z),
        ];
      });
      for (let f = 0; f < idx.getCount(); f += 3) {
        const tri = [0, 1, 2].map((k) => points[idx.getScalar(f + k)]!) as unknown as Tri;
        const cells = (axis: number) => {
          const values = tri.map((q) => q[axis]!);
          return [
            Math.floor(Math.min(...values) / CELL),
            Math.floor(Math.max(...values) / CELL),
          ] as const;
        };
        const [i0, i1] = cells(0);
        const [j0, j1] = cells(2);
        for (let i = i0; i <= i1; i += 1)
          for (let j = j0; j <= j1; j += 1) {
            const key = `${i},${j}`;
            const list = buckets.get(key);
            if (list) list.push(tri);
            else buckets.set(key, [tri]);
          }
      }
    }
  }
});

/** The village's highest surface above (x, z), or -Infinity beyond it. */
function villageHeight(x: number, z: number): number {
  let h = -Infinity;
  for (const [a, b, c] of buckets.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
    const den = (b[2]! - c[2]!) * (a[0]! - c[0]!) + (c[0]! - b[0]!) * (a[2]! - c[2]!);
    if (Math.abs(den) < 1e-9) continue;
    const l0 = ((b[2]! - c[2]!) * (x - c[0]!) + (c[0]! - b[0]!) * (z - c[2]!)) / den;
    const l1 = ((c[2]! - a[2]!) * (x - c[0]!) + (a[0]! - c[0]!) * (z - c[2]!)) / den;
    const l2 = 1 - l0 - l1;
    if (l0 < 0 || l1 < 0 || l2 < 0) continue;
    h = Math.max(h, l0 * a[1]! + l1 * b[1]! + l2 * c[1]!);
  }
  return h;
}

describe('SC11 world layouts', () => {
  it('the ship flies over the village without touching it, as it rises and sinks too', () => {
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const drop = (1 - presence('discipline', t)) * DROP;
      for (let x = -SHIP_ENVELOPE.halfWidth; x <= SHIP_ENVELOPE.halfWidth; x += 3.5)
        for (let z = -32; z <= 32; z += 4)
          expect(villageHeight(x, shipZ(t) + z) - drop).toBeLessThan(SHIP_ENVELOPE.bottom - 1);
    }
  });

  it('the village cameras stay clear of every roof and cliff', () => {
    const s = createShotState();
    const around = [
      [0, 0],
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
    ] as const;
    for (let t = 0; t <= 1.0001; t += 0.005) {
      areaShot('discipline', t, s);
      const drop = (1 - presence('discipline', t)) * DROP;
      for (const [dx, dz] of around)
        expect(villageHeight(s.position.x + dx, s.position.z + dz) - drop).toBeLessThan(
          s.position.y - 2,
        );
    }
  });

  it('everyone stands on solid ground: nobody hovers', () => {
    for (const c of VILLAGE_CAST) {
      const [x, y, z] = c.position;
      expect(Math.abs(y - villageHeight(x, z)), c.who).toBeLessThan(0.3);
    }
    for (const c of VALLEY_CAST) expect(c.position[1], c.who).toBe(GROUND.horizon);
    expect(SWORD_STAND.position[1]).toBe(GROUND.horizon);
    // the town's road layer is lifted a little above its floor
    for (const y of [RYUK.y, DEATH_NOTE.y]) expect(Math.abs(y - GROUND.proof)).toBeLessThan(0.6);
  });

  it('the ship never flies through anyone', () => {
    const worlds = [
      ['discipline', VILLAGE_CAST],
      ['proof', [{ who: 'ryuk', position: [RYUK.x, RYUK.y, RYUK.z], size: RYUK.size }]],
      ['horizon', VALLEY_CAST],
    ] as const;
    for (const [area, cast] of worlds)
      for (let t = 0; t <= 1.0001; t += 0.005) {
        const drop = (1 - presence(area, t)) * DROP;
        for (const c of cast) {
          const [x, y, z] = c.position;
          const hit =
            Math.abs(x) - c.size * 0.35 < SHIP_ENVELOPE.halfWidth &&
            Math.abs(z - shipZ(t)) < 32 &&
            y - drop < SHIP_ENVELOPE.top &&
            y + c.size - drop > SHIP_ENVELOPE.bottom;
          expect(hit, `${c.who} at t ${t.toFixed(3)}`).toBe(false);
        }
      }
  });

  it('the forest grows outside the village island', () => {
    const { x, z, radius } = VILLAGE.island;
    for (const t of FOREST_TREES)
      expect(Math.hypot(t.x - x, t.z - z)).toBeGreaterThanOrEqual(radius - 1e-6);
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

  it('worlds rise in and sink away; between them only their planets and open space', () => {
    for (const a of ORDER) {
      expect(presence(a, 0)).toBe(0);
      expect(presence(a, 1)).toBe(0);
      expect(presence(a, 0.55)).toBe(1);
    }
  });
});
