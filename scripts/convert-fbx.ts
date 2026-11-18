/**
 * Converts one FBX under raw-assets/ to a raw GLB next to it (still raw: never shipped), using
 * three.js's FBXLoader + GLTFExporter in the local Chrome. Optimisation is a separate step.
 *   node scripts/convert-fbx.ts raw-assets/<dir>/source/<file>.fbx raw-assets/<dir>/<name>.raw.glb
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import type { FbxConversion } from '../src/tools/fbxToGlb.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: node scripts/convert-fbx.ts <in.fbx> <out.glb>');

const server = await createServer({
  root: `${import.meta.dirname}/..`,
  server: { port: 5183, strictPort: true },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto('http://localhost:5183/tools/fbx-to-glb.html');
  await page.waitForFunction(() => typeof window.fbxToGlb === 'function', null, {
    timeout: 60_000,
  });
  const url = `/${input.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}`;
  const r = (await page.evaluate((u) => window.fbxToGlb?.(u), url)) as FbxConversion;
  writeFileSync(output, Buffer.from(r.glbBase64, 'base64'));
  console.log(`${input} → ${output}`);
  console.log(`triangles ${r.triangles} · meshes ${r.meshes} · materials ${r.materials.length}`);
  console.log(`materials: ${r.materials.join(' | ')}`);
} finally {
  await browser.close();
  await server.close();
}
