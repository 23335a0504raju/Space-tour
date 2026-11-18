/**
 * Hero-ship optimisation (asset-pipeline skill; the FBX source is 1.43 M triangles in 215 meshes).
 *   raw GLB (scripts/convert-fbx.ts) → drop normals/UVs (textures are missing; flat hard-surface
 *   shading is computed in the material) → weld → join by material → simplify → Meshopt.
 * Without the first step nothing simplifies: the FBX gives every triangle its own vertices.
 * The HelVela II source also contains ~1.24 M triangles nobody can see from outside: 8 VIPER
 * fighters parked in an internal hangar and 16 sets of seats, cockpit cradles and dash panels.
 * Those nodes are removed first so the triangle budget goes to the visible hull.
 *   node scripts/optimize-ship.ts <in.raw.glb> <out.glb> [targetTriangles=80000]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, flatten, join, meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const [input, output, targetArg] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: optimize-ship.ts <in.glb> <out.glb> [target]');
const target = Number(targetArg ?? 80000);

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);

const count = () => {
  let tris = 0;
  let prims = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      prims += 1;
      const i = p.getIndices();
      tris += (i ? i.getCount() : (p.getAttribute('POSITION')?.getCount() ?? 0)) / 3;
    }
  return { tris, prims };
};
console.log('input', count());

/**
 * Interior / hidden parts (node names in the HelVela II source), plus `HelVela_II_Heavy_Gun`: the
 * unplaced full-scale master copy of the turret beside the ship (the placed copies are 001–028;
 * FBXLoader ignores the hidden flag it probably had in 3ds Max).
 */
const HIDDEN =
  /^(3-VIPER|Sitze|Cockpit_Cradle|Dash_Panel|Seat_Pipe|Frame|Cockpit_crystal|Vent|Back_Cockpit_Screen|Box|Cockpitglass|HelVela_II_Heavy_Gun$)/;
const EXTRA = process.env['DROP'] ? new RegExp(process.env['DROP']) : null;
let dropped = 0;
for (const node of doc.getRoot().listNodes())
  if (HIDDEN.test(node.getName()) || EXTRA?.test(node.getName())) {
    node.dispose();
    dropped += 1;
  }
await doc.transform(prune());
console.log(`dropped ${dropped} hidden interior nodes`, count());

for (const mesh of doc.getRoot().listMeshes())
  for (const prim of mesh.listPrimitives())
    for (const semantic of prim.listSemantics())
      if (semantic !== 'POSITION') prim.setAttribute(semantic, null);

await doc.transform(dedup(), flatten(), join(), weld(), prune());
console.log('welded + joined', count());

// simplify toward the target; raise the allowed error until it is reached (or a ceiling)
const start = count().tris;
for (const error of [0.001, 0.002, 0.004, 0.008]) {
  await doc.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, target / start), error }),
  );
  const now = count().tris;
  console.log(`simplify error ${error}:`, now);
  if (now <= target * 1.1) break;
}

doc.createExtension(EXTMeshoptCompression);
await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(output, doc);
console.log('output', count());
