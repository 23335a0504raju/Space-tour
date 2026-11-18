/**
 * Repeatable optimisation pipeline (asset-pipeline skill). Reads raw-assets/polyhaven/manifest.json
 * and writes web-ready files to public/assets/:
 *   models   → dedup/prune/weld (no simplify) → ETC1S KTX2 textures → Meshopt  (.glb)
 *   textures → KTX2 (ETC1S; colour maps sRGB, data maps linear), mipmapped     (.ktx2)
 *   HDRIs    → copied as-is (1K .hdr, used only for reflections)
 * Prints before/after sizes for the asset register.
 *   npm run assets:optimize
 * Requires KTX-Software (ktx/toktx) on PATH or in %LOCALAPPDATA%\Programs\KTX-Software\bin.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const RAW = join(ROOT, 'raw-assets', 'polyhaven');
const OUT = join(ROOT, 'public', 'assets');
const GLTF = join(
  ROOT,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'gltf-transform.cmd' : 'gltf-transform',
);

const ktxBin = join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'KTX-Software', 'bin');
const env = { ...process.env, PATH: `${process.env['PATH'] ?? ''}${delimiter}${ktxBin}` };

function run(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, {
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr?.toString() ?? ''}`);
}

const kb = (p: string) => `${(statSync(p).size / 1024).toFixed(0)} KB`;

interface ManifestEntry {
  id: string;
  type: 'model' | 'texture' | 'hdri';
  file?: string;
  maps?: Record<string, string>;
}
const manifest = JSON.parse(readFileSync(join(RAW, 'manifest.json'), 'utf8')) as ManifestEntry[];

for (const entry of manifest) {
  if (entry.type === 'model' && entry.file) {
    const src = join(RAW, entry.file);
    const out = join(OUT, 'models', `${entry.id}.glb`);
    mkdirSync(dirname(out), { recursive: true });
    const tmp1 = join(OUT, 'models', `_${entry.id}.1.glb`);
    const tmp2 = join(OUT, 'models', `_${entry.id}.2.glb`);
    run(GLTF, [
      'optimize',
      src,
      tmp1,
      '--compress',
      'false',
      '--texture-compress',
      'false',
      '--simplify',
      'false',
      '--texture-size',
      '1024',
    ]);
    run(GLTF, ['etc1s', tmp1, tmp2, '--quality', '128']);
    run(GLTF, ['meshopt', tmp2, out]);
    rmSync(tmp1);
    rmSync(tmp2);
    const before = dirSizeOf(join(RAW, entry.id));
    console.log(
      `model   ${entry.id.padEnd(24)} ${(before / 1024).toFixed(0).padStart(6)} KB → ${kb(out)}`,
    );
  }
  if (entry.type === 'texture' && entry.maps) {
    for (const [map, rel] of Object.entries(entry.maps)) {
      const src = join(RAW, rel);
      const out = join(OUT, 'textures', `${entry.id}_${map.toLowerCase()}.ktx2`);
      mkdirSync(dirname(out), { recursive: true });
      const colour = map === 'Diffuse';
      run('toktx', [
        '--t2',
        '--encode',
        'etc1s',
        '--clevel',
        '2',
        '--qlevel',
        '160',
        '--genmipmap',
        ...(colour
          ? ['--assign_oetf', 'srgb']
          : ['--assign_oetf', 'linear', '--assign_primaries', 'none']),
        out,
        src,
      ]);
      console.log(`texture ${`${entry.id}/${map}`.padEnd(24)} ${kb(src).padStart(9)} → ${kb(out)}`);
    }
  }
  if (entry.type === 'hdri' && entry.file) {
    const src = join(RAW, entry.file);
    const out = join(OUT, 'env', `${entry.id}_1k.hdr`);
    mkdirSync(dirname(out), { recursive: true });
    copyFileSync(src, out);
    console.log(`hdri    ${entry.id.padEnd(24)} ${kb(out).padStart(9)} (copied)`);
  }
}

/** Total bytes of all files under a directory (the raw download, for before/after comparison). */
function dirSizeOf(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((f) => join(dir, f))
    .filter((p) => statSync(p).isFile())
    .reduce((sum, p) => sum + statSync(p).size, 0);
}
