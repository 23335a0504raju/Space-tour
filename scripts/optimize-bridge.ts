/**
 * SC02 bridge (A036): "SF bridge console / 科幻風艦橋" by 林柏勳 (Lin), CC BY 4.0, Sketchfab.
 *   node scripts/optimize-bridge.ts [rawDir] [out.glb]
 * Defaults: raw-assets/sf_bridge_console/scene.gltf → public/assets/models/bridge.glb
 *
 * 1. Material fix: Sketchfab exported one shared material as alphaMode BLEND. The deck, walls and
 *    consoles become OPAQUE (a transparent room sorts wrongly and costs fill rate); the four
 *    hologram parts (the animated globe and rings) keep a BLEND copy of the material.
 * 2. dedup → prune → weld; textures resized to 2048 → KTX2 ETC1S; Meshopt.
 * 3. Prints the deck height (largest upward-facing area) in metres, for placing the set.
 * Requires KTX-Software (ktx/toktx) on PATH or in %LOCALAPPDATA%\Programs\KTX-Software\bin.
 */
import { spawnSync } from 'node:child_process';
import { rmSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import type { Node as GltfNode } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const ROOT = join(import.meta.dirname, '..');
const src = process.argv[2] ?? join(ROOT, 'raw-assets', 'sf_bridge_console', 'scene.gltf');
const out = process.argv[3] ?? join(ROOT, 'public', 'assets', 'models', 'bridge.glb');
const GLTF = join(ROOT, 'node_modules', '.bin', 'gltf-transform');
const ktxBin = join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'KTX-Software', 'bin');
const env = { ...process.env, PATH: `${process.env['PATH'] ?? ''}${delimiter}${ktxBin}` };

function run(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { env, stdio: ['ignore', 'ignore', 'pipe'], shell: true });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr?.toString() ?? ''}`);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();

// ── 1. material: opaque room, transparent hologram ──────────────────────────
const shared = root.listMaterials()[0];
if (!shared) throw new Error('bridge: no material');
const holo = shared.clone().setName('Bridge_Hologram').setAlphaMode('BLEND');
shared.setName('Bridge_Shell').setAlphaMode('OPAQUE');
let holoParts = 0;
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  // the room is node "1"; every other mesh is a part of the animated hologram
  const isShell = node.getName().startsWith('1_');
  if (!isShell) holoParts += 1;
  for (const prim of mesh.listPrimitives()) prim.setMaterial(isShell ? shared : holo);
}
if (holoParts !== 4) console.warn(`bridge: expected 4 hologram parts, found ${holoParts}`);

// ── 1b. remove the bridge's crew seats in the way of the story ──────────────────────
// One of the bridge's own crew seats stands where the astronaut's desk now is (room (-0.7, -1.7),
// located by raycasting the opening frame), so two chairs read at the desk (Raju's review,
// 2026-11-19). Triangles whose centroid lies in this model-space box (deck + 0.05 m … + 1.6 m)
// are dropped; the deck floor is outside it.
// A second seat stands on the raised west platform, beside the walk to the lift (same review):
// room x -4.75…-4.25, z -6.5…-5.25, platform + 0.05 … + 1.4 m.
const REMOVE_BOXES = [
  { minX: -1.1, maxX: 0.1, minY: 2.6, maxY: 4.15, minZ: 3.0, maxZ: 4.2 },
  { minX: -4.6, maxX: -4.0, minY: 3.1, maxY: 4.5, minZ: -1.25, maxZ: 0.1 },
  // the seat on the platform's walkway itself (raycast: room (-5.0, -5.2), back up to 1.7 m)
  { minX: -5.25, maxX: -4.35, minY: 3.1, maxY: 4.5, minZ: -0.45, maxZ: 0.65 },
];
let removed = 0;
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh || !node.getName().startsWith('1_')) continue;
  const m = node.getWorldMatrix() as unknown as number[];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    if (!pos || !idx) continue;
    const keep: number[] = [];
    const world = (i: number): number[] => {
      const [x = 0, y = 0, z = 0] = pos.getElement(idx.getScalar(i), []) as number[];
      return [0, 1, 2].map(
        (r) => (m[r] ?? 0) * x + (m[4 + r] ?? 0) * y + (m[8 + r] ?? 0) * z + (m[12 + r] ?? 0),
      );
    };
    for (let i = 0; i < idx.getCount(); i += 3) {
      const c = [0, 1, 2].map((a) => (world(i)[a]! + world(i + 1)[a]! + world(i + 2)[a]!) / 3);
      const [cx = 0, cy = 0, cz = 0] = c;
      const inside = REMOVE_BOXES.some(
        (b) =>
          cx > b.minX && cx < b.maxX && cy > b.minY && cy < b.maxY && cz > b.minZ && cz < b.maxZ,
      );
      if (inside) removed += 1;
      else keep.push(idx.getScalar(i), idx.getScalar(i + 1), idx.getScalar(i + 2));
    }
    idx.setArray(new Uint32Array(keep));
  }
}
console.log(`removed ${removed} triangles (the crew seats beside the desk and on the walk)`);

// ── 1c. the loose parts those cuts left behind ─────────────────────────────
// Casters and an armrest fell outside the boxes and hung round the astronaut's legs during the
// stand-up (Raju's review, 2026-11-27). Any separate piece lying wholly within reach of a removed
// seat goes with it; the deck and the consoles are large connected pieces that reach beyond.
const REACH = 0.35;
let scraps = 0;
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh || !node.getName().startsWith('1_')) continue;
  const m = node.getWorldMatrix() as unknown as number[];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    if (!pos || !idx) continue;
    const points = Array.from({ length: pos.getCount() }, (_, i) => {
      const [x = 0, y = 0, z = 0] = pos.getElement(i, []) as number[];
      return [0, 1, 2].map(
        (r) => (m[r] ?? 0) * x + (m[4 + r] ?? 0) * y + (m[8 + r] ?? 0) * z + (m[12 + r] ?? 0),
      );
    });
    // connected pieces, welding corners that share a position
    const count = idx.getCount() / 3;
    const parent = Array.from({ length: count }, (_, i) => i);
    const find = (i: number): number =>
      parent[i] === i ? i : (parent[i] = find(parent[i] as number));
    const first = new Map<string, number>();
    for (let t = 0; t < count; t += 1)
      for (let k = 0; k < 3; k += 1) {
        const key = points[idx.getScalar(t * 3 + k)]!.map((n) => n.toFixed(3)).join(',');
        const other = first.get(key);
        if (other === undefined) first.set(key, t);
        else parent[find(t)] = find(other);
      }
    const outside = new Map<number, boolean[]>();
    for (let t = 0; t < count; t += 1) {
      const piece = find(t);
      let out = outside.get(piece);
      if (!out) outside.set(piece, (out = REMOVE_BOXES.map(() => false)));
      for (let k = 0; k < 3; k += 1) {
        const [x = 0, y = 0, z = 0] = points[idx.getScalar(t * 3 + k)]!;
        REMOVE_BOXES.forEach((b, i) => {
          const inside =
            x > b.minX - REACH &&
            x < b.maxX + REACH &&
            y > b.minY - 0.15 &&
            y < b.maxY &&
            z > b.minZ - REACH &&
            z < b.maxZ + REACH;
          if (!inside) out![i] = true;
        });
      }
    }
    const keep: number[] = [];
    for (let t = 0; t < count; t += 1) {
      if (outside.get(find(t))!.every(Boolean))
        keep.push(idx.getScalar(t * 3), idx.getScalar(t * 3 + 1), idx.getScalar(t * 3 + 2));
      else scraps += 1;
    }
    idx.setArray(new Uint32Array(keep));
  }
}
console.log(`removed ${scraps} triangles of loose seat parts`);

// ── 3. deck height: area-weighted histogram of upward-facing triangles (world space) ──
function worldMatrix(n: GltfNode): number[] {
  return n.getWorldMatrix() as unknown as number[];
}
const bins = new Map<number, number>();
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh || !node.getName().startsWith('1_')) continue;
  const m = worldMatrix(node);
  const tf = (x: number, y: number, z: number): [number, number, number] => [
    (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0),
    (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0),
    (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0),
  ];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    if (!pos || !idx) continue;
    const p = (i: number) => {
      const v = pos.getElement(idx.getScalar(i), []) as number[];
      return tf(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
    };
    for (let i = 0; i < idx.getCount(); i += 3) {
      const a = p(i);
      const b = p(i + 1);
      const c = p(i + 2);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [
        (u[1] ?? 0) * (w[2] ?? 0) - (u[2] ?? 0) * (w[1] ?? 0),
        (u[2] ?? 0) * (w[0] ?? 0) - (u[0] ?? 0) * (w[2] ?? 0),
        (u[0] ?? 0) * (w[1] ?? 0) - (u[1] ?? 0) * (w[0] ?? 0),
      ];
      const len = Math.hypot(n[0] ?? 0, n[1] ?? 0, n[2] ?? 0);
      if (len === 0 || (n[1] ?? 0) / len < 0.95) continue; // upward-facing only
      const y = Math.round(((a[1] + b[1] + c[1]) / 3) * 20) / 20; // 5 cm bins
      bins.set(y, (bins.get(y) ?? 0) + len / 2);
    }
  }
}
const floors = [...bins.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);
console.log('upward-facing area by height (m → m²):');
for (const [y, area] of floors) console.log(`  y ${y.toFixed(2)}  ${area.toFixed(1)}`);

// ── 2. structure, then textures and compression via the CLI ─────────────────
await doc.transform(dedup(), prune(), weld());
const tmp1 = `${out}.1.glb`;
const tmp2 = `${out}.2.glb`;
await io.write(tmp1, doc);
run(GLTF, ['resize', tmp1, tmp2, '--width', '2048', '--height', '2048']);
run(GLTF, ['etc1s', tmp2, tmp1, '--quality', '160']);
run(GLTF, ['meshopt', tmp1, out]);
rmSync(tmp1);
rmSync(tmp2);
console.log(
  `bridge.glb: ${(statSync(out).size / 1024).toFixed(0)} KB (hologram parts: ${holoParts})`,
);
