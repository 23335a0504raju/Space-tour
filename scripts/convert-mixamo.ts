/**
 * Converts raw-assets/mixamo/*.fbx → raw-assets/mixamo/astronaut.raw.glb (character + all clips)
 * by running three.js's FBXLoader + GLTFExporter inside the locally installed Chrome, served by a
 * temporary Vite dev server. Prints a per-clip report.
 *   npm run assets:mixamo
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import type { ConversionResult } from '../src/tools/mixamoConvert.ts';

const root = join(import.meta.dirname, '..');
const server = await createServer({
  root,
  server: { port: 5181, strictPort: true },
  logLevel: 'error',
});
await server.listen();

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto('http://localhost:5181/tools/mixamo.html');
  await page.waitForFunction(() => typeof window.convertMixamo === 'function', null, {
    timeout: 60_000,
  });
  const result = (await page.evaluate(() => window.convertMixamo?.())) as ConversionResult;

  const out = join(root, 'raw-assets', 'mixamo', 'astronaut.raw.glb');
  writeFileSync(out, Buffer.from(result.glbBase64, 'base64'));

  console.log(`Character height: ${result.heightCm.toFixed(1)} cm · bones: ${result.bones}`);
  console.log('Meshes:');
  for (const m of result.meshes)
    console.log(
      `  ${m.name.padEnd(24)} ${String(m.triangles).padStart(7)} tris  skinned=${m.skinned}  material=${m.material}`,
    );
  console.log('First bones:', result.boneNames.slice(0, 6).join(', '));
  console.log('Clips (hips Y in cm; horizontal travel in cm):');
  for (const [name, c] of Object.entries(result.clips)) {
    console.log(
      `  ${name.padEnd(9)} ${c.duration.toFixed(2)} s  tracks ${c.tracks}  hipsY ${c.hipsYStart?.toFixed(1)} → ${c.hipsYEnd?.toFixed(1)}  travel ${c.hipsHorizontalTravel?.toFixed(1)}  skin-in-file=${c.hasSkin}`,
    );
  }
  console.log(`✓ ${out}`);
} finally {
  await browser.close();
  await server.close();
}
