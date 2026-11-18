/**
 * Downloads approved CC0 assets from Poly Haven (approved by Raju, 2026-11-16) into
 * raw-assets/polyhaven/<id>/ (gitignored, never shipped as-is). Writes manifest.json with
 * source URL, authors and licence for each asset, for assets/ASSET_REGISTER.md.
 *   npm run assets:fetch
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'raw-assets', 'polyhaven');
const API = 'https://api.polyhaven.com';
const HEADERS = { 'User-Agent': 'portfolio-asset-pipeline' };

const MODELS = [
  'metal_office_desk',
  'modern_arm_chair_01',
  'desk_lamp_arm_01',
  'potted_plant_04',
  'office_notepads',
  'Shelf_01',
  'modern_ceiling_lamp_01',
];
const TEXTURES = ['metal_plate', 'concrete_floor_painted'];
const TEXTURE_MAPS = ['Diffuse', 'nor_gl', 'arm'] as const;
const HDRIS = ['empty_warehouse_01'];
const RES = '1k';

interface FileEntry {
  url: string;
  size: number;
  include?: Record<string, { url: string; size: number }>;
}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

async function download(url: string, target: string): Promise<number> {
  if (existsSync(target)) return 0;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return bytes.byteLength;
}

const manifest: Array<Record<string, unknown>> = [];
let total = 0;

for (const id of MODELS) {
  const info = await json<{ name: string; authors: Record<string, string> }>(`${API}/info/${id}`);
  const files = await json<{ gltf: Record<string, { gltf: FileEntry }> }>(`${API}/files/${id}`);
  const entry = files.gltf[RES]?.gltf;
  if (!entry) throw new Error(`${id}: no ${RES} glTF`);
  const dir = join(ROOT, id);
  total += await download(entry.url, join(dir, `${id}.gltf`));
  for (const [rel, f] of Object.entries(entry.include ?? {}))
    total += await download(f.url, join(dir, rel));
  manifest.push({
    id,
    type: 'model',
    name: info.name,
    authors: Object.keys(info.authors),
    licence: 'CC0',
    source: `https://polyhaven.com/a/${id}`,
    file: `${id}/${id}.gltf`,
  });
  console.log(`✓ model ${id}`);
}

for (const id of TEXTURES) {
  const info = await json<{ name: string; authors: Record<string, string> }>(`${API}/info/${id}`);
  const files = await json<Record<string, Record<string, Record<string, FileEntry>>>>(
    `${API}/files/${id}`,
  );
  const maps: Record<string, string> = {};
  for (const map of TEXTURE_MAPS) {
    const f = files[map]?.[RES]?.['jpg'];
    if (!f) throw new Error(`${id}: no ${map} ${RES} jpg`);
    const rel = `${id}/${id}_${map}_${RES}.jpg`;
    total += await download(f.url, join(ROOT, rel));
    maps[map] = rel;
  }
  manifest.push({
    id,
    type: 'texture',
    name: info.name,
    authors: Object.keys(info.authors),
    licence: 'CC0',
    source: `https://polyhaven.com/a/${id}`,
    maps,
  });
  console.log(`✓ texture ${id}`);
}

for (const id of HDRIS) {
  const info = await json<{ name: string; authors: Record<string, string> }>(`${API}/info/${id}`);
  const files = await json<{ hdri: Record<string, Record<string, FileEntry>> }>(
    `${API}/files/${id}`,
  );
  const f = files.hdri[RES]?.['hdr'];
  if (!f) throw new Error(`${id}: no ${RES} hdr`);
  const rel = `${id}/${id}_${RES}.hdr`;
  total += await download(f.url, join(ROOT, rel));
  manifest.push({
    id,
    type: 'hdri',
    name: info.name,
    authors: Object.keys(info.authors),
    licence: 'CC0',
    source: `https://polyhaven.com/a/${id}`,
    file: rel,
  });
  console.log(`✓ hdri ${id}`);
}

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Downloaded ${(total / 1024 / 1024).toFixed(1)} MB (already-present files skipped).`);
