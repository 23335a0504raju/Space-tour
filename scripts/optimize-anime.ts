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
  flatten,
  join as joinMeshes,
  palette,
  prune,
  simplify,
  weld,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

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
  /**
   * every textured material becomes its texture's average colour (flat cel colour, no texture
   * noise for the ink-edge pass); with `palette`, the whole set collapses into one material
   */
  readonly flatten?: boolean;
  /** remove line/point primitives (SketchUp edge exports) and see-through glass */
  readonly clean?: boolean;
  /** keep only base-colour textures (no metal/rough, specular, normal maps) */
  readonly baseOnly?: boolean;
  /** never join: named nodes stay separate so the scene can pick parts by name */
  readonly keepNodes?: boolean;
  /**
   * simplify with meshoptimizer's Prune flag: whole disconnected pieces below the error vanish
   * (SketchUp exports are thousands of loose parts the edge-collapse simplifier cannot merge)
   */
  readonly pruneSmall?: boolean;
  /** material name → sRGB hex: repaint materials whose flattened colour reads wrong */
  readonly recolor?: Readonly<Record<string, string>>;
  /** raise coplanar decal layers (a road painted on the terrain) by `dy` world units */
  readonly lift?: { readonly material: RegExp; readonly dy: number };
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
    tris: 8000,
    tex: 512,
    // 23 materials and she stands ~300 m away on the hill: flat cel colours in one palette
    flatten: true,
    palette: true,
    smooth: true,
  },
  { zip: 'demonslayer/blossom_katana.zip', out: 'anime_katana.glb', tris: 5000, tex: 512 },
  {
    zip: 'demonslayer/low_poly_farm_v2.zip',
    out: 'anime_farm.glb',
    tris: 20000,
    tex: 1024,
    palette: true,
    smooth: true,
  },
  // Death Note world (SC11b): the town the ship flies through, and its outskirts
  {
    zip: 'deathnote/west_street.zip',
    out: 'anime_town.glb',
    tris: 90000,
    // the palette texture is 4 px per colour: never shrink it (resizing blends the colours)
    tex: 1024,
    clean: true,
    flatten: true,
    palette: true,
    smooth: true,
    pruneSmall: true,
    lift: { material: /^Wood__Floor_2$/, dy: 0.6 },
    // The textures average out to near-identical dark browns (and the sand to grey), so every
    // material gets a painted frontier colour: warm timber, barn red, cream, sage, dusty blue,
    // slate roofs, blue window dark (the runtime adds light, planks and dirt: anime/painted.ts).
    recolor: {
      LightGray: '#d99c5e',
      Groundcover_Sand_Smooth: '#d99c5e',
      Groundcover_Sand_Smooth_2: '#d99c5e',
      Wood__Floor_2: '#c98a58',
      // walls
      Wood_Lumber_ButtJoined_3: '#d6a56b',
      Wood__Floor_4: '#b8604a',
      Wood_Cherry_Original: '#9c5a40',
      Wood_Lumber_ButtJoined_7: '#e3bd7a',
      Wood__Floor_5: '#7fa393',
      Wood_Lumber_ButtJoined: '#cc6f4c',
      Wood_Cherry_Original_4_5: '#b34a3c',
      Wood_Lumber_ButtJoined_4: '#7d9fba',
      Wood_Lumber_ButtJoined_6_7: '#ecdab4',
      Wood_Lumber_ButtJoined_2: '#dfa564',
      Wood_Lumber_ButtJoined_8: '#6e4638',
      Wood_Lumber_ButtJoined_9: '#b07a50',
      Wood_Lumber_ButtJoined_9_8: '#b07a50',
      Wood_Cherry_Original_2: '#d4866a',
      Wood_Cherry_Original_3: '#94543a',
      Metal_Rusted: '#b8735a',
      // porches, boards, shutters
      Wood__Floor: '#cf9058',
      Wood__Floor_1: '#cf9058',
      Wood__Floor_3: '#bd8c5c',
      Blinds_Wood_Natural: '#a46a42',
      // roofs
      Roofing_Shingles_Variable: '#5c7e99',
      Roofing_Shingles_Variable_1: '#5f8f83',
      Roofing_Shingles_Wood: '#96564c',
      Metal_Seamed: '#76899a',
      // sign boards and window openings
      Wood_Board_Cork_1: '#4a2f2a',
      black: '#34405e',
    },
  },
  {
    zip: 'deathnote/rural_buildings_set_-_low_poly_models.zip',
    out: 'anime_rural.glb',
    tex: 256,
    baseOnly: true,
    keepNodes: true,
  },
];

/** sRGB 0..255 → linear 0..1 (glTF colour factors are linear). */
const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Replace every base-colour texture by its average colour (multiplied into the factor). */
async function flattenTextures(doc: Awaited<ReturnType<typeof io.read>>): Promise<void> {
  for (const mat of doc.getRoot().listMaterials()) {
    const tex = mat.getBaseColorTexture();
    const image = tex?.getImage();
    if (tex && image) {
      const { channels } = await sharp(Buffer.from(image)).stats();
      const f = mat.getBaseColorFactor();
      mat.setBaseColorFactor([
        f[0] * linear(channels[0]?.mean ?? 255),
        f[1] * linear(channels[1]?.mean ?? 255),
        f[2] * linear(channels[2]?.mean ?? 255),
        f[3],
      ]);
      mat.setBaseColorTexture(null);
    }
    mat.setMetallicRoughnessTexture(null).setNormalTexture(null).setOcclusionTexture(null);
    mat.setEmissiveTexture(null).setMetallicFactor(0).setRoughnessFactor(1);
  }
}

/**
 * Drop SketchUp edge lines/points, see-through glass panes, and SketchUp's default back-face
 * material ("material", "material_1"): every face is exported twice, the back copy coplanar with
 * the front, which z-fights and paints the terrain grey. The kept faces become double-sided.
 */
function cleanPrimitives(doc: Awaited<ReturnType<typeof io.read>>): void {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      const name = mat?.getName() ?? '';
      const glass = mat && (mat.getAlphaMode() === 'BLEND' || /glass|translucent/i.test(name));
      if (prim.getMode() !== 4 || glass || /^material(_\d+)?$/.test(name)) prim.dispose();
    }
  // SketchUp leaves many walls facing inward: with the back copies gone, draw both sides
  for (const mat of doc.getRoot().listMaterials()) mat.setDoubleSided(true);
}

/** Move the primitives of one material up by `dy` in world space (through each node's matrix). */
function liftLayer(doc: Awaited<ReturnType<typeof io.read>>, lift: NonNullable<Job['lift']>): void {
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    // world up expressed in the node's local frame: solve M3 · d = (0, dy, 0)
    const a = [m[0], m[1], m[2]];
    const b = [m[4], m[5], m[6]];
    const c = [m[8], m[9], m[10]];
    const det =
      a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) -
      b[0]! * (a[1]! * c[2]! - a[2]! * c[1]!) +
      c[0]! * (a[1]! * b[2]! - a[2]! * b[1]!);
    const y = lift.dy;
    // Cramer's rule with the right-hand side (0, y, 0)
    const d = [
      (-y * (b[0]! * c[2]! - b[2]! * c[0]!)) / det,
      (y * (a[0]! * c[2]! - a[2]! * c[0]!)) / det,
      (-y * (a[0]! * b[2]! - a[2]! * b[0]!)) / det,
    ];
    for (const prim of mesh.listPrimitives()) {
      if (!lift.material.test(prim.getMaterial()?.getName() ?? '')) continue;
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i += 1) {
        pos.getElement(i, v);
        pos.setElement(i, [v[0]! + d[0]!, v[1]! + d[1]!, v[2]! + d[2]!]);
      }
    }
  }
}

/** Prune-simplify every primitive until the document is at or under `target` triangles. */
function pruneSimplify(doc: Awaited<ReturnType<typeof io.read>>, target: number): void {
  const prims = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives());
  const total = prims.reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  for (const prim of prims) {
    const idx = prim.getIndices();
    const pos = prim.getAttribute('POSITION');
    if (!idx || !pos) continue;
    const indices = Uint32Array.from(idx.getArray() ?? []);
    const positions = Float32Array.from(pos.getArray() ?? []);
    const want = Math.floor((indices.length * target) / total / 3) * 3;
    let out: Uint32Array<ArrayBufferLike> = indices;
    for (const error of [0.002, 0.005, 0.01, 0.02, 0.04]) {
      [out] = MeshoptSimplifier.simplify(indices, positions, 3, want, error, ['Prune']);
      if (out.length <= want * 1.15) break;
    }
    idx.setArray(Uint32Array.from(out));
  }
}

/** Keep only base-colour maps (the cel pass ignores the rest). */
function baseColourOnly(doc: Awaited<ReturnType<typeof io.read>>): void {
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setMetallicRoughnessTexture(null).setNormalTexture(null).setOcclusionTexture(null);
    mat.setEmissiveTexture(null).setMetallicFactor(0).setRoughnessFactor(1);
  }
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (/specular|ior|clearcoat|sheen|transmission/i.test(ext.extensionName)) ext.dispose();
}

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
    if (job.clean) cleanPrimitives(doc);
    if (job.lift) liftLayer(doc, job.lift);
    if (job.baseOnly) baseColourOnly(doc);
    if (job.flatten) await flattenTextures(doc);
    if (job.recolor)
      for (const mat of doc.getRoot().listMaterials()) {
        const hex = job.recolor[mat.getName()];
        if (!hex) continue;
        const n = parseInt(hex.slice(1), 16);
        const a = mat.getBaseColorFactor()[3];
        mat.setBaseColorFactor([linear(n >> 16), linear((n >> 8) & 255), linear(n & 255), a]);
      }
    await doc.transform(dedup(), prune(), weld());
    if (job.palette) await doc.transform(palette({ min: 2 }), weld());
    if (job.smooth)
      for (const mesh of doc.getRoot().listMeshes())
        for (const prim of mesh.listPrimitives()) prim.setAttribute('NORMAL', null);
    if (job.smooth) await doc.transform(weld());
    // bake the node hierarchy first: join only merges siblings
    if (!job.skinned && !job.keepNodes) await doc.transform(flatten(), joinMeshes());
    const start = tris(doc);
    if (job.tris && job.pruneSmall && start > job.tris) pruneSimplify(doc, job.tris);
    else if (job.tris && start > job.tris) {
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
    // --review: an uncompressed copy for scripts/preview-model.ts (it has no KTX2/Meshopt)
    if (process.argv.includes('--review'))
      await io.write(join(ROOT, 'raw-assets', '_work', job.out), doc);
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
