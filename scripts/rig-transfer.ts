/**
 * Puts the player astronaut suit (A039, raw-assets/astronaut/player.raw.glb, made from player.fbx
 * with scripts/convert-fbx.ts) on the Mixamo Y Bot skeleton and clips (raw-assets/mixamo/
 * astronaut.raw.glb), then optimises it into public/assets/models/astronaut-eva.glb (SC13).
 *   npm run assets:astronaut
 * Steps: in-browser weight transfer (src/tools/rigTransfer.ts) → weld → simplify → Meshopt.
 */
import { spawnSync } from 'node:child_process';
import { rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import type { RigTransferResult } from '../src/tools/rigTransfer.ts';

const ROOT = join(import.meta.dirname, '..');
const RATIO = process.env['RATIO'] ?? '0.45';
const GLTF = join(ROOT, 'node_modules', '.bin', 'gltf-transform');
const raw = join(ROOT, 'raw-assets', 'astronaut', 'astronaut-rigged.raw.glb');
const out = join(ROOT, 'public', 'assets', 'models', 'astronaut-eva.glb');

function run(args: string[]): void {
  const r = spawnSync(GLTF, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: true });
  if (r.status !== 0) throw new Error(`${args.join(' ')}\n${r.stderr?.toString() ?? ''}`);
}

const server = await createServer({
  root: ROOT,
  server: { port: 5184, strictPort: true },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error(m.text()));
  await page.goto('http://localhost:5184/tools/rig-transfer.html');
  await page.waitForFunction(() => typeof window.rigTransfer === 'function', null, {
    timeout: 60_000,
  });
  const r = (await page.evaluate(() =>
    window.rigTransfer?.(
      '/raw-assets/mixamo/astronaut.raw.glb',
      '/raw-assets/astronaut/player.clean.glb',
    ),
  )) as RigTransferResult;
  const parts: Buffer[] = [];
  for (let at = 0; at < r.byteLength; at += 4 << 20) {
    const b64 = await page.evaluate(({ x, y }) => window.rigChunk?.(x, y) ?? '', {
      x: at,
      y: at + (4 << 20),
    });
    parts.push(Buffer.from(b64, 'base64'));
  }
  writeFileSync(raw, Buffer.concat(parts));
  console.log(
    `suit ${r.triangles} tris · scale ${r.scale.toFixed(4)} · arms lowered ${r.armAngleDeg.toFixed(1)}° · weight match mean ${r.meanMatchCm.toFixed(1)} cm, max ${r.maxMatchCm.toFixed(1)} cm`,
  );
} finally {
  await browser.close();
  await server.close();
}
const a = `${out}.a.glb`;
const b = `${out}.b.glb`;
run(['weld', raw, a]);
run(['simplify', a, b, '--ratio', RATIO, '--error', '0.001']);
run(['meshopt', b, out]);
rmSync(a);
rmSync(b);
console.log(`astronaut-eva.glb: ${(statSync(out).size / 1024).toFixed(0)} KB (ratio ${RATIO})`);
