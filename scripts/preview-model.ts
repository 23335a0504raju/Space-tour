/**
 * Renders a GLB from several angles for asset review (no app involved).
 *   node scripts/preview-model.ts <file.glb> <outPrefix> [az,el[,zoom] …]
 * Writes <outPrefix>-<az>-<el>.png under spike-results/models/.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import type { PreviewInfo } from '../src/tools/modelPreview.ts';

const [file, prefix, ...views] = process.argv.slice(2);
if (!file || !prefix) throw new Error('usage: preview-model.ts <file.glb> <prefix> [az,el …]');
const outDir = join(import.meta.dirname, '..', 'spike-results', 'models');
mkdirSync(outDir, { recursive: true });

const server = await createServer({
  root: `${import.meta.dirname}/..`,
  server: { port: 5184, strictPort: true },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto('http://localhost:5184/tools/model-preview.html');
  await page.waitForFunction(() => typeof window.previewLoad === 'function');
  const url = `/${file.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}`;
  const info: PreviewInfo | undefined = await page.evaluate((u) => window.previewLoad?.(u), url);
  console.log(JSON.stringify(info, null, 1));
  for (const v of views.length ? views : ['30,20', '120,15', '210,25', '0,85']) {
    const [az = 0, el = 0, zoom = 1] = v.split(',').map(Number);
    await page.evaluate(
      ([a, e, z]) => window.previewView?.(a ?? 0, e ?? 0, z ?? 1),
      [az, el, zoom],
    );
    const out = join(outDir, `${prefix}-${az}-${el}${zoom !== 1 ? `-x${zoom}` : ''}.png`);
    await page.screenshot({ path: out });
    console.log(`✓ ${out}`);
  }
} finally {
  await browser.close();
  await server.close();
}
