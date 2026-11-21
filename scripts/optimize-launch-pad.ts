/**
 * SC05 launch platform (A037): "SCI FI HANGAR" by Lezalit (Sketchfab "Kerem Kavalci"), CC BY 4.0.
 *   node scripts/optimize-launch-pad.ts [in.glb] [out.glb]
 * Defaults: raw-assets/sci_fi_hangar/hangar.glb → public/assets/models/launch-pad.glb
 * (make hangar.glb first: gltf-transform copy raw-assets/sci_fi_hangar/scene.gltf …/hangar.glb)
 * Steps: dedup/prune/weld → simplify to ~RATIO of the triangles → textures ≤1024 → KTX2 ETC1S → Meshopt.
 */
import { spawnSync } from 'node:child_process';
import { rmSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = join(import.meta.dirname, '..');
const src = process.argv[2] ?? join(ROOT, 'raw-assets', 'sci_fi_hangar', 'hangar.glb');
const out = process.argv[3] ?? join(ROOT, 'public', 'assets', 'models', 'launch-pad.glb');
const RATIO = process.env['RATIO'] ?? '0.3';
const GLTF = join(ROOT, 'node_modules', '.bin', 'gltf-transform');
const ktxBin = join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'KTX-Software', 'bin');
const env = { ...process.env, PATH: `${process.env['PATH'] ?? ''}${delimiter}${ktxBin}` };
function run(args: string[]): void {
  const r = spawnSync(GLTF, args, { env, stdio: ['ignore', 'pipe', 'pipe'], shell: true });
  if (r.status !== 0) throw new Error(`${args.join(' ')}\n${r.stderr?.toString() ?? ''}`);
}
/**
 * The eight splayed blast fins stand on the ground like paper planes once the deck is level with it.
 * Triangles whose centroid is beyond FIN_RADIUS of the well axis (model x 0, z 0.2) and outside the
 * runway's half-width are dropped (this also trims the two intake ducts at the rear).
 */
const FIN_RADIUS = Number(process.env['FIN_RADIUS'] ?? 2.3);
const RUNWAY_HALF = 1.8;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
let dropped = 0;
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = node.getWorldMatrix() as unknown as number[];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    if (!pos || !idx) continue;
    const w = (i: number): number[] => {
      const [x = 0, y = 0, z = 0] = pos.getElement(idx.getScalar(i), []) as number[];
      return [0, 1, 2].map(
        (r) => (m[r] ?? 0) * x + (m[4 + r] ?? 0) * y + (m[8 + r] ?? 0) * z + (m[12 + r] ?? 0),
      );
    };
    const keep: number[] = [];
    for (let i = 0; i < idx.getCount(); i += 3) {
      const a = w(i);
      const b = w(i + 1);
      const c = w(i + 2);
      const cx = ((a[0] ?? 0) + (b[0] ?? 0) + (c[0] ?? 0)) / 3;
      const cz = ((a[2] ?? 0) + (b[2] ?? 0) + (c[2] ?? 0)) / 3;
      // big fin triangles can have a centroid inside the radius while a corner reaches far out
      const reach = [a, b, c].some(
        (p) => Math.hypot(p[0] ?? 0, (p[2] ?? 0) - 0.2) > 2.6 && Math.abs(p[0] ?? 0) > RUNWAY_HALF,
      );
      if (reach || (Math.hypot(cx, cz - 0.2) > FIN_RADIUS && Math.abs(cx) > RUNWAY_HALF))
        dropped += 1;
      else keep.push(idx.getScalar(i), idx.getScalar(i + 1), idx.getScalar(i + 2));
    }
    idx.setArray(new Uint32Array(keep));
  }
}
console.log('dropped', dropped, 'fin triangles');
const trimmed = `${out}.t.glb`;
await io.write(trimmed, doc);
const a = `${out}.a.glb`;
const b = `${out}.b.glb`;
run(['dedup', trimmed, a]);
run(['weld', a, b]);
run(['simplify', b, a, '--ratio', RATIO, '--error', '0.01']);
run(['resize', a, b, '--width', '1024', '--height', '1024']);
run(['etc1s', b, a, '--quality', '160']);
run(['meshopt', a, out]);
rmSync(a);
rmSync(b);
rmSync(trimmed);
console.log(`launch-pad.glb: ${(statSync(out).size / 1024).toFixed(0)} KB (ratio ${RATIO})`);
