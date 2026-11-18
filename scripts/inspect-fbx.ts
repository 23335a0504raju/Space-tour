/**
 * Inspects FBX files under raw-assets/ with three.js's FBXLoader in the local Chrome (served by a
 * temporary Vite dev server). Nothing is converted or written.
 *   node scripts/inspect-fbx.ts raw-assets/astronaut/source/player.fbx [more.fbx …]
 */
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import type { FbxReport } from '../src/tools/inspectFbx.ts';

const files = process.argv.slice(2);
if (!files.length) throw new Error('usage: node scripts/inspect-fbx.ts <file.fbx> …');

const server = await createServer({
  root: `${import.meta.dirname}/..`,
  server: { port: 5182, strictPort: true },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto('http://localhost:5182/tools/inspect-fbx.html');
  await page.waitForFunction(() => typeof window.inspectFbx === 'function', null, {
    timeout: 60_000,
  });
  for (const file of files) {
    const url = `/${file.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}`;
    const r = (await page.evaluate((u) => window.inspectFbx?.(u), url)) as FbxReport;
    console.log(`\n== ${file}`);
    console.log(`size (file units): ${r.size.map((v) => v.toFixed(2)).join(' × ')}`);
    console.log(`triangles: ${r.triangles} in ${r.meshes.length} meshes · bones: ${r.bones}`);
    for (const m of r.meshes.slice(0, 25))
      console.log(
        `  ${m.name.slice(0, 32).padEnd(32)} ${String(m.triangles).padStart(8)} tris  skinned=${m.skinned}  mats=${m.materials.join(',')}`,
      );
    if (r.meshes.length > 25) console.log(`  … ${r.meshes.length - 25} more meshes`);
    console.log(
      `clips: ${r.clips.map((c) => `${c.name} (${c.duration.toFixed(2)} s, ${c.tracks} tracks)`).join('; ') || 'none'}`,
    );
    console.log(`bones: ${r.boneNames.slice(0, 30).join(', ')}`);
    console.log(`textures referenced: ${r.textures.join(', ') || 'none'}`);
  }
} finally {
  await browser.close();
  await server.close();
}
