/**
 * SC11 anime worlds: converts the Sketchfab models Raju supplied (raw-assets/Naruto, deathnote,
 * demonslayer; all approved, CC-BY 4.0 except the ramen shop CC-BY-NC) into web-ready GLBs.
 *   node scripts/optimize-anime.ts
 * Unzips each into a scratch folder, then: dedup → prune → weld → simplify (static and skinned
 * meshes alike; the vertex buffer is only compacted, so skin weights survive) → textures resized
 * → KTX2 ETC1S → Meshopt. Outputs go to public/assets/models/anime_*.glb.
 * Needs KTX-Software (toktx) on PATH or in %LOCALAPPDATA%\Programs\KTX-Software\bin.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  join as joinMeshes,
  palette,
  prune,
  simplify,
  weld,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public', 'assets', 'models');
const GLTF = join(ROOT, 'node_modules', '.bin', 'gltf-transform');
const ktxBin = join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'KTX-Software', 'bin');
const env = { ...process.env, PATH: `${process.env['PATH'] ?? ''}${delimiter}${ktxBin}` };

interface Job {
  readonly zip: string;
  readonly out: string;
  /** target triangles (undefined = keep) */
  readonly tris?: number;
  /** longest texture side */
  readonly tex: number;
  /** skinned: never join or palette (the skeleton must stay intact) */
  readonly skinned?: boolean;
  /** flat-colour materials merged into one palette texture */
  readonly palette?: boolean;
  /** static only: normals dropped so vertices weld and simplify (recomputed at load) */
  readonly smooth?: boolean;
}

const JOBS: readonly Job[] = [
  // Naruto world (SC11a)
  {
    zip: 'Naruto/scene.gltf',
    out: 'anime_naruto.glb',
    tris: 14000,
    tex: 512,
    smooth: true,
  },
  { zip: 'Naruto/ichiraku_ramen_naruto.zip', out: 'anime_ichiraku.glb', tris: 7000, tex: 512 },
  // Death Note world (SC11b)
  { zip: 'deathnote/death_note.zip', out: 'anime_deathnote.glb', tex: 256 },
  {
    zip: 'deathnote/ryuk_from_death_note.zip',
    out: 'anime_ryuk.glb',
    tris: 18000,
    tex: 512,
    skinned: true,
  },
  {
    zip: 'deathnote/free_london_kinnaird_house.zip',
    out: 'anime_kinnaird.glb',
    tris: 22000,
    tex: 1024,
    smooth: true,
  },
  // Demon Slayer world (SC11c)
  {
    zip: 'demonslayer/tanjiro_kamado_from_demon_slayer_-_fully_rigged.zip',
    out: 'anime_tanjiro.glb',
    tris: 16000,
    tex: 512,
    skinned: true,
  },
  {
    zip: 'demonslayer/nezuko_kamado-demon_slayer.zip',
    out: 'anime_nezuko.glb',
    tris: 18000,
    tex: 512,
    smooth: true,
  },
  { zip: 'demonslayer/blossom_katana.zip', out: 'anime_katana.glb', tris: 5000, tex: 512 },
  {
    zip: 'demonslayer/low_poly_farm_v2.zip',
    out: 'anime_farm.glb',
    tris: 20000,
    tex: 64,
    palette: true,
    smooth: true,
  },
];

function run(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { env, stdio: ['ignore', 'ignore', 'pipe'], shell: true });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr?.toString() ?? ''}`);
}

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const tris = (doc: Awaited<ReturnType<typeof io.read>>) => {
  let n = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) n += (p.getIndices()?.getCount() ?? 0) / 3;
  return Math.round(n);
};

mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
for (const job of JOBS) {
  if (only && !job.out.includes(only)) continue;
  const scratch = mkdtempSync(join(tmpdir(), 'anime-'));
  try {
    // a zip, or a loose glTF already unpacked in raw-assets
    const loose = job.zip.endsWith('.gltf');
    if (!loose) {
      const unzip = spawnSync('unzip', ['-qo', join(ROOT, 'raw-assets', job.zip), '-d', scratch], {
        stdio: 'pipe',
      });
      if (unzip.status !== 0) throw new Error(`unzip ${job.zip}: ${unzip.stderr?.toString()}`);
    }
    const doc = await io.read(
      loose ? join(ROOT, 'raw-assets', job.zip) : join(scratch, 'scene.gltf'),
    );
    const before = tris(doc);
    await doc.transform(dedup(), prune(), weld());
    if (job.palette) await doc.transform(palette({ min: 2 }), weld());
    if (job.smooth)
      for (const mesh of doc.getRoot().listMeshes())
        for (const prim of mesh.listPrimitives()) prim.setAttribute('NORMAL', null);
    if (job.smooth) await doc.transform(weld());
    if (!job.skinned) await doc.transform(joinMeshes());
    const start = tris(doc);
    if (job.tris && start > job.tris) {
      for (const error of [0.005, 0.015, 0.04, 0.1, 0.25, 0.5]) {
        await doc.transform(
          simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, job.tris / start), error }),
        );
        if (tris(doc) <= job.tris * 1.2) break;
      }
    }
    await doc.transform(prune());
    const t1 = join(scratch, '1.glb');
    const t2 = join(scratch, '2.glb');
    await io.write(t1, doc);
    run(GLTF, ['resize', t1, t2, '--width', String(job.tex), '--height', String(job.tex)]);
    run(GLTF, ['etc1s', t2, t1, '--quality', '150']);
    const file = join(OUT, job.out);
    run(GLTF, ['meshopt', t1, file]);
    const sha = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
    console.log(
      `${job.out}: ${before} -> ${tris(await io.read(file))} tris, ${doc.getRoot().listMaterials().length} mats, ${(statSync(file).size / 1024).toFixed(0)} KB, sha256 ${sha}`,
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
