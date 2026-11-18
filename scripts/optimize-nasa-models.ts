/**
 * NASA public-domain 3D models for the belt (SC07) and the project installations (SC08).
 * Source: https://github.com/nasa/NASA-3D-Resources (NASA media guidelines: no copyright, free use).
 *   node scripts/optimize-nasa-models.ts
 * Downloads the four GLBs into raw-assets/nasa-models/ (gitignored), then for each output:
 *   weld -> palette (merge flat-colour materials into one) -> join -> simplify -> Meshopt.
 * The merged palette keeps each craft at 1-2 draw calls instead of 16-33.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import {
  dedup,
  flatten,
  join as joinMeshes,
  meshopt,
  palette,
  prune,
  simplify,
  weld,
} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const ROOT = join(import.meta.dirname, '..');
const RAW = join(ROOT, 'raw-assets', 'nasa-models');
const OUT = join(ROOT, 'public', 'assets', 'models');
const BASE = 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models';

const SOURCES = {
  bennu: '1999%20RQ36%20asteroid/1999%20RQ36%20asteroid.glb',
  juno: 'Juno%20(B)/Juno%20(B).glb',
  landsat8: 'Landsat%208/Landsat%208.glb',
  voyager: 'Voyager%20Probe%20(A)/Voyager%20Probe%20(A).glb',
} as const;

/** [source, output, target triangles] */
const JOBS: ReadonlyArray<readonly [keyof typeof SOURCES, string, number]> = [
  ['bennu', 'nasa_bennu_lo.glb', 320],
  ['bennu', 'nasa_bennu.glb', 9000],
  ['bennu', 'nasa_bennu_mid.glb', 2500],
  ['juno', 'nasa_juno.glb', 14000],
  ['landsat8', 'nasa_landsat8.glb', 16000],
  ['voyager', 'nasa_voyager.glb', 12000],
];

mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });
for (const [key, path] of Object.entries(SOURCES)) {
  const file = join(RAW, `${key}.glb`);
  if (existsSync(file)) continue;
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log('downloaded', key);
}

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const tris = (doc: Awaited<ReturnType<typeof io.read>>) => {
  let n = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) n += (p.getIndices()?.getCount() ?? 0) / 3;
  return Math.round(n);
};

for (const [key, out, target] of JOBS) {
  const src = join(RAW, `${key}.glb`);
  const doc = await io.read(src);
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose();
  const before = tris(doc);
  await doc.transform(dedup(), flatten());
  if (key !== 'bennu') await doc.transform(palette({ min: 2 }));
  // Split normals stop vertices welding, so nothing would simplify (and Bennu came out shredded).
  // Keep positions (and the palette UVs of the craft) only; normals are recomputed at load:
  // flat for the craft, smooth for the asteroid.
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives())
      for (const semantic of prim.listSemantics())
        if (semantic !== 'POSITION' && !(semantic === 'TEXCOORD_0' && key !== 'bennu'))
          prim.setAttribute(semantic, null);
  await doc.transform(weld(), joinMeshes(), prune());
  const start = tris(doc);
  for (const error of [0.01, 0.03, 0.06, 0.12]) {
    await doc.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, target / start), error }),
    );
    if (tris(doc) <= target * 1.15) break;
  }
  doc.createExtension(EXTMeshoptCompression);
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const file = join(OUT, out);
  await io.write(file, doc);
  const sha = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
  console.log(
    `${out}: ${before} -> ${tris(doc)} tris, ${doc.getRoot().listMaterials().length} materials, ${(statSync(file).size / 1024).toFixed(0)} KB, sha256 ${sha}`,
  );
}
