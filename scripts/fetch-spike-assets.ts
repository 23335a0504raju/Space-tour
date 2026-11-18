/**
 * Downloads and optimises stand-in assets used ONLY by the P1 spikes (never shipped, never committed).
 *   npm run spikes:assets
 *
 * Soldier.glb: three.js examples (github.com/mrdoob/three.js, MIT licence; character and
 * animations originate from Mixamo). Rigged humanoid with in-place Idle/Walk/Run clips.
 * Used to test scroll-scrubbed skinned animation (S2) and the optimisation pipeline (S3)
 * before an astronaut is sourced.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'src', 'spikes', 'assets');
const SOURCE = {
  name: 'Soldier.glb',
  url: 'https://raw.githubusercontent.com/mrdoob/three.js/r177/examples/models/gltf/Soldier.glb',
};
const GLTF_TRANSFORM = '@gltf-transform/cli@4.5.1';

mkdirSync(dir, { recursive: true });
const raw = join(dir, SOURCE.name);
if (existsSync(raw)) {
  console.log(`✓ ${SOURCE.name} already present`);
} else {
  const res = await fetch(SOURCE.url);
  if (!res.ok) throw new Error(`Failed to download ${SOURCE.url}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  writeFileSync(raw, bytes);
  console.log(`↓ ${SOURCE.name} (${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

// S3 pipeline variants. KTX2 variants need KTX-Software (ktx) on PATH.
const variants = [
  { out: 'Soldier.nosimplify.glb', extra: ['--simplify', 'false'] },
  { out: 'Soldier.opt.glb', extra: [] },
];
for (const v of variants) {
  if (existsSync(join(dir, v.out))) {
    console.log(`✓ ${v.out} already present`);
    continue;
  }
  const args = [
    '-y',
    GLTF_TRANSFORM,
    'optimize',
    SOURCE.name,
    v.out,
    '--compress',
    'meshopt',
    '--texture-compress',
    'webp',
    '--texture-size',
    '1024',
    ...v.extra,
  ];
  const r = spawnSync('npx', args, {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) throw new Error(`gltf-transform failed for ${v.out}`);
}
