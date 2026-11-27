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
import { Matrix4, Quaternion, Vector3 } from 'three';

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
  /**
   * UASTC instead of ETC1S: for tiny swatch textures, where ETC1S's shared colour codebook blends
   * neighbouring swatches (a green ground came out straw)
   */
  readonly uastc?: boolean;
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
  /** swatch textures: exact sRGB hex → replacement hex (a pastel palette repainted) */
  readonly swatches?: Readonly<Record<string, string>>;
  /** richer, brighter base-colour textures (photo-flat exports read grey under tone mapping) */
  readonly boost?: { readonly saturation: number; readonly brightness: number };
  /** rigged in an A-pose: swing the upper arms down by this many degrees to a standing pose */
  readonly relaxArms?: number;
  /** static T-pose mesh: bend the arms down by `degrees` about the shoulders (source metres) */
  readonly bendArms?: {
    readonly degrees: number;
    readonly shoulderX: number;
    readonly shoulderY: number;
  };
}

/**
 * The farm's pastel swatches, repainted as an anime farm: green grass, red barn, warm timber.
 */
const FARM_SWATCHES: Readonly<Record<string, string>> = {
  '#f9e79f': '#dcbc82',
  // the ground plate
  '#ffd54f': '#7fb25a',
  '#e59866': '#c98a4e',
  '#9e9d24': '#3f8038',
  '#afb42b': '#4f9440',
  '#c0ca33': '#62a844',
  '#d4e157': '#86c250',
  '#827717': '#33682e',
  '#ef9a9a': '#c9463c',
  '#ffcdd2': '#d9695a',
  '#ec7063': '#c23f34',
  '#cd6155': '#a5342c',
  '#795548': '#664539',
  '#8d6e63': '#7a5750',
  '#5d4037': '#46302a',
  '#6d4c41': '#573b32',
};

const JOBS: readonly Job[] = [
  // Naruto world (SC11a): the whole Hidden Leaf village the ship flies over (one atlas, one draw)
  {
    zip: 'Naruto/naruto_hiddenly_village.zip',
    out: 'anime_village.glb',
    tex: 2048,
    boost: { saturation: 1.35, brightness: 1.12 },
  },
  // its people: Free Fire character rigs, posed from their A-pose
  ...(['itachi', 'jiraiya_free_fire_skin', 'obito', 'pain'] as const).map((name): Job => ({
    zip: `Naruto/${name}${name === 'jiraiya_free_fire_skin' ? '' : '_free_fire'}_original_rig.zip`,
    out: `anime_${name.replace('_free_fire_skin', '')}.glb`,
    tex: 512,
    skinned: true,
    relaxArms: 28,
  })),
  {
    zip: 'Naruto/naruto_sage.zip',
    out: 'anime_sage.glb',
    tex: 512,
    bendArms: { degrees: 68, shoulderX: 0.17, shoulderY: 1.36 },
  },
  // Death Note world (SC11b)
  // a 3 m prop on the sand: a few hundred triangles are plenty
  { zip: 'deathnote/death_note.zip', out: 'anime_deathnote.glb', tex: 256, tris: 1200 },
  {
    zip: 'deathnote/ryuk_from_death_note.zip',
    out: 'anime_ryuk.glb',
    tris: 18000,
    tex: 512,
    skinned: true,
  },
  // Kinnaird House closes the town's vista; the lower tier gets a lighter copy
  ...([22000, 6000] as const).map((tris): Job => ({
    zip: 'deathnote/free_london_kinnaird_house.zip',
    out: tris < 10000 ? 'anime_kinnaird_lo.glb' : 'anime_kinnaird.glb',
    tris,
    tex: tris < 10000 ? 512 : 1024,
    smooth: true,
    // hundreds of loose parts: edge collapse alone cannot get it down
    pruneSmall: tris < 10000,
  })),
  // Demon Slayer world (SC11c)
  {
    zip: 'demonslayer/inosuke_free_fire_original_rig.zip',
    out: 'anime_inosuke.glb',
    tex: 512,
    skinned: true,
    relaxArms: 28,
  },
  {
    zip: 'demonslayer/tanjiro_kamado_from_demon_slayer_-_fully_rigged.zip',
    out: 'anime_tanjiro.glb',
    tris: 16000,
    tex: 512,
    skinned: true,
    relaxArms: 66,
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
  // the farm tiles: every triangle on Balanced (simplifying them ate the pine crowns, the barn
  // roof's ridges and the windmill's blades); a simplified copy for the lower tier
  ...([undefined, 20000] as const).map((tris): Job => ({
    zip: 'demonslayer/low_poly_farm_v2.zip',
    out: tris ? 'anime_farm_lo.glb' : 'anime_farm.glb',
    swatches: FARM_SWATCHES,
    uastc: true,
    ...(tris ? { tris } : {}),
    tex: 1024,
    palette: true,
    smooth: true,
  })),
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

/** Replace exact swatch colours in every base-colour texture. */
async function repaintSwatches(
  doc: Awaited<ReturnType<typeof io.read>>,
  swatches: NonNullable<Job['swatches']>,
): Promise<void> {
  const rgb = (hex: string) => parseInt(hex.slice(1), 16);
  const to = new Map(Object.entries(swatches).map(([a, b]) => [rgb(a), rgb(b)]));
  const used = new Set<number>();
  for (const tex of doc.getRoot().listTextures()) {
    const image = tex.getImage();
    if (!image) continue;
    const { data, info } = await sharp(Buffer.from(image))
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) {
      const from = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
      const next = to.get(from);
      if (next === undefined) continue;
      used.add(from);
      data[i] = next >> 16;
      data[i + 1] = (next >> 8) & 255;
      data[i + 2] = next & 255;
    }
    const out = await sharp(data, { raw: info }).png().toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType('image/png');
  }
  if (used.size !== to.size)
    throw new Error(`swatches: found ${used.size} of ${to.size} colours in the textures`);
}

/** Saturate and brighten every base-colour texture. */
async function boostTextures(
  doc: Awaited<ReturnType<typeof io.read>>,
  boost: NonNullable<Job['boost']>,
): Promise<void> {
  for (const tex of doc.getRoot().listTextures()) {
    const image = tex.getImage();
    if (!image) continue;
    const out = await sharp(Buffer.from(image)).modulate(boost).png().toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType('image/png');
  }
}

/**
 * Swing both upper arms down: a turn about the world's front axis at each shoulder joint. Only the
 * joint's rest rotation changes (the bind matrices stay), so the skin follows.
 */
function relaxArms(doc: Awaited<ReturnType<typeof io.read>>, degrees: number): void {
  let turned = 0;
  for (const node of doc.getRoot().listNodes()) {
    // the two rig families here: Free Fire's bone_LeftArm_05, Tanjiro's L_UpperArm_1_327
    const found = /^(?:bone_(Left|Right)Arm_|([LR])_UpperArm_1_)/.exec(node.getName());
    const side = found?.[1] ?? found?.[2];
    const parent = node.getParentNode();
    if (!side || !parent) continue;
    const half = (((side.startsWith('L') ? -1 : 1) * degrees * Math.PI) / 180) * 0.5;
    const turn = new Quaternion(0, 0, Math.sin(half), Math.cos(half));
    // local' = parent⁻¹ · turn · parent · local (the parent chain is uniformly scaled)
    const p = new Quaternion().setFromRotationMatrix(
      new Matrix4().extractRotation(new Matrix4().fromArray(parent.getWorldMatrix())),
    );
    const local = new Quaternion().fromArray(node.getRotation());
    const next = p.clone().invert().multiply(turn).multiply(p).multiply(local).normalize();
    node.setRotation([next.x, next.y, next.z, next.w]);
    turned += 1;
  }
  if (turned !== 2) throw new Error(`relaxArms: turned ${turned} arm joints, expected 2`);
}

/** Bend a static T-pose mesh's arms down about the shoulders, easing in across the shoulder. */
function bendArms(
  doc: Awaited<ReturnType<typeof io.read>>,
  bend: NonNullable<Job['bendArms']>,
): void {
  const seen = new Set<unknown>();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = new Matrix4().fromArray(node.getWorldMatrix());
    const back = world.clone().invert();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos || seen.has(pos)) continue;
      seen.add(pos);
      const p = new Vector3();
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i += 1) {
        pos.getElement(i, v);
        p.fromArray(v).applyMatrix4(world);
        const side = Math.sign(p.x);
        const out = Math.abs(p.x) - bend.shoulderX;
        // arms only: beyond the shoulder, at shoulder height
        if (out < -0.03 || Math.abs(p.y - bend.shoulderY) > 0.2) continue;
        const k = Math.min(1, Math.max(0, (out + 0.03) / 0.12));
        const a = (-side * bend.degrees * Math.PI * k * k * (3 - 2 * k)) / 180;
        const x = p.x - side * bend.shoulderX;
        const y = p.y - bend.shoulderY;
        p.x = side * bend.shoulderX + x * Math.cos(a) - y * Math.sin(a);
        p.y = bend.shoulderY + x * Math.sin(a) + y * Math.cos(a);
        p.applyMatrix4(back);
        pos.setElement(i, p.toArray());
      }
    }
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
    if (job.relaxArms) relaxArms(doc, job.relaxArms);
    if (job.bendArms) bendArms(doc, job.bendArms);
    if (job.swatches) await repaintSwatches(doc, job.swatches);
    if (job.boost) await boostTextures(doc, job.boost);
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
    run(GLTF, job.uastc ? ['uastc', t2, t1] : ['etc1s', t2, t1, '--quality', '150']);
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
