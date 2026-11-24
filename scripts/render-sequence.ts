/**
 * Renders one chapter as an image sequence for the scroll-scrub spike (S5): the live scene with
 * every DOM layer hidden, stepped through local t, each frame encoded as WebP.
 *   npm run build && npm run preview   (in another terminal)
 *   node scripts/render-sequence.ts sc11b-proof 150 [--portrait] [--quality=72]
 * Output: spike-results/seq/<chapter>-<desktop|portrait>/0000.webp … and manifest.json.
 */
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { chapters } from '../src/chapters/registry.ts';
import { buildTrack, classifyAspect, progressFor } from '../src/engine/scroll/resolver.ts';

const args = process.argv.slice(2);
const [id, countArg = '150'] = args.filter((a) => !a.startsWith('--'));
if (!id || !chapters.some((c) => c.id === id)) throw new Error(`Unknown chapter: ${id}`);
const count = Number(countArg);
const portrait = args.includes('--portrait');
const quality = Number(args.find((a) => a.startsWith('--quality='))?.slice(10) ?? 72);
const base = 'http://localhost:4173';
const viewport = portrait ? { width: 412, height: 915 } : { width: 1440, height: 900 };
// encoded size: 1280 wide on desktop, 720 wide on phones (the device-pixel width is 1082)
const outWidth = portrait ? 720 : 1280;
const outDir = join(
  import.meta.dirname,
  '..',
  'spike-results',
  'seq',
  `${id}-${portrait ? 'portrait' : 'desktop'}`,
);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const track = buildTrack(chapters, classifyAspect(viewport.width, viewport.height));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await (
  await browser.newContext({ viewport, deviceScaleFactor: portrait ? 2.625 : 1 })
).newPage();
await page.goto(base + '/?gate=off');
await page.waitForSelector('canvas', { timeout: 30_000 });
// only the WebGL canvas: every DOM layer (bars, panels, flashes) hidden
await page.addStyleTag({
  content: '* { visibility: hidden !important } canvas { visibility: visible !important }',
});
const scrollTo = (t: number) =>
  page.evaluate(
    (progress) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max * progress, behavior: 'instant' });
    },
    progressFor(track, id, t),
  );

await scrollTo(0.5);
await page.waitForTimeout(6000); // mount, load and compile the chapter once
let bytes = 0;
for (let i = 0; i < count; i += 1) {
  // frame i samples the middle of its slice, so t = 0 and 1 (boundary dips) are never shot
  const t = (i + 0.5) / count;
  await scrollTo(t);
  await page.waitForTimeout(600);
  const png = await page.screenshot({ type: 'png' });
  const file = join(outDir, `${String(i).padStart(4, '0')}.webp`);
  await sharp(png).resize({ width: outWidth }).webp({ quality }).toFile(file);
  bytes += statSync(file).size;
  if (i % 25 === 0) console.log(`frame ${i}/${count}`);
}
const first = await sharp(join(outDir, '0000.webp')).metadata();
writeFileSync(
  join(outDir, 'manifest.json'),
  JSON.stringify({ chapter: id, count, width: first.width, height: first.height, bytes }, null, 1),
);
await browser.close();
console.log(
  `${count} frames ${first.width}×${first.height}, ${(bytes / 1024 / 1024).toFixed(2)} MB total, ${(bytes / count / 1024).toFixed(0)} KB/frame → ${outDir}`,
);
