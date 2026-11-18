/**
 * Screenshots chapters at chosen local times, for visual review and chapter acceptance reports.
 *   npm run build && npm run preview   (in another terminal; or any running server)
 *   node scripts/capture-shots.ts sc02-room:0,0.6 sc03-departure:0.5,0.95 [--portrait] [--low]
 * Output: spike-results/shots/<viewport>/<chapter>-<t>.png
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { chapters } from '../src/chapters/registry.ts';
import { buildTrack, classifyAspect, progressFor } from '../src/engine/scroll/resolver.ts';

const args = process.argv.slice(2);
const portrait = args.includes('--portrait');
const low = args.includes('--low');
const perf = args.includes('--perf');
const base = args.find((a) => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:4173';
const specs = args.filter((a) => !a.startsWith('--'));
const viewport = portrait ? { width: 412, height: 915 } : { width: 1440, height: 900 };
const outDir = join(
  import.meta.dirname,
  '..',
  'spike-results',
  'shots',
  portrait ? 'portrait' : 'desktop',
);
mkdirSync(outDir, { recursive: true });

const track = buildTrack(chapters, classifyAspect(viewport.width, viewport.height));
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport, deviceScaleFactor: portrait ? 2.625 : 1 });
if (low) await context.addInitScript(() => localStorage.setItem('mission.quality', 'low'));
if (perf)
  // Test-side GPU counters (no app changes): wrap WebGL2 draw/create/delete calls.
  await context.addInitScript(() => {
    const s = { calls: 0, tris: 0, textures: 0, buffers: 0 };
    (window as unknown as { __gpu: typeof s }).__gpu = s;
    const P = WebGL2RenderingContext.prototype;
    const TRI = 0x0004;
    const tri = (mode: number, count: number, inst = 1) => {
      s.calls += 1;
      if (mode === TRI) s.tris += (count / 3) * inst;
    };
    const wrap = <K extends keyof WebGL2RenderingContext>(
      name: K,
      fn: (...a: number[]) => void,
    ) => {
      const orig = P[name] as unknown as (...a: unknown[]) => unknown;
      (P as unknown as Record<string, unknown>)[name] = function (this: unknown, ...a: unknown[]) {
        fn(...(a as number[]));
        return orig.apply(this, a);
      };
    };
    wrap('drawArrays', (m, _f, c) => tri(m, c ?? 0));
    wrap('drawElements', (m, c) => tri(m, c ?? 0));
    wrap('drawArraysInstanced', (m, _f, c, i) => tri(m, c ?? 0, i));
    wrap('drawElementsInstanced', (m, c, _t, _o, i) => tri(m, c ?? 0, i));
    wrap('createTexture', () => void (s.textures += 1));
    wrap('deleteTexture', () => void (s.textures -= 1));
    wrap('createBuffer', () => void (s.buffers += 1));
    wrap('deleteBuffer', () => void (s.buffers -= 1));
  });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base + '/?gate=off');
await page.waitForSelector('canvas', { timeout: 30_000 });
await page.waitForTimeout(2500); // assets + shader compile

for (const spec of specs) {
  const [id, times = '0.5'] = spec.split(':');
  if (!id || !chapters.some((c) => c.id === id)) throw new Error(`Unknown chapter: ${id}`);
  for (const t of times.split(',').map(Number)) {
    const p = progressFor(track, id, t);
    await page.evaluate((progress) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max * progress, behavior: 'instant' });
    }, p);
    await page.waitForTimeout(1500);
    const file = join(outDir, `${id}-${t}${low ? '-low' : ''}.png`);
    await page.screenshot({ path: file });
    console.log(`✓ ${file}`);
    if (perf) {
      // 4 s of requestAnimationFrame intervals while parked on this frame (display-capped).
      const r = await page.evaluate(
        () =>
          new Promise<{ p50: number; p95: number; max: number; frames: number }>((resolve) => {
            const times: number[] = [];
            let last = performance.now();
            const end = last + 4000;
            const tick = (now: number) => {
              times.push(now - last);
              last = now;
              if (now < end) requestAnimationFrame(tick);
              else {
                const s = times.slice(5).sort((a, b) => a - b);
                const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
                resolve({ p50: q(0.5), p95: q(0.95), max: s[s.length - 1] ?? 0, frames: s.length });
              }
            };
            requestAnimationFrame(tick);
          }),
      );
      // per-frame draw calls / triangles over 30 frames, plus live GPU textures and buffers
      const g = await page.evaluate(
        () =>
          new Promise<{ calls: number; tris: number; textures: number; buffers: number }>(
            (resolve) => {
              const s = (window as unknown as { __gpu: Record<string, number> }).__gpu;
              const c0 = s.calls ?? 0;
              const t0 = s.tris ?? 0;
              let n = 0;
              const tick = () => {
                n += 1;
                if (n < 31) return void requestAnimationFrame(tick);
                resolve({
                  calls: ((s.calls ?? 0) - c0) / 30,
                  tris: ((s.tris ?? 0) - t0) / 30,
                  textures: s.textures ?? 0,
                  buffers: s.buffers ?? 0,
                });
              };
              requestAnimationFrame(tick);
            },
          ),
      );
      console.log(
        `  frame ms  p50 ${r.p50.toFixed(1)}  p95 ${r.p95.toFixed(1)}  max ${r.max.toFixed(1)}  (${r.frames} frames)`,
      );
      console.log(
        `  gpu  draw calls ${g.calls.toFixed(0)}  triangles ${(g.tris / 1000).toFixed(1)}k  live textures ${g.textures}  buffers ${g.buffers}`,
      );
    }
  }
}
await browser.close();
if (errors.length) {
  console.error(`Page errors:\n${errors.join('\n')}`);
  process.exit(1);
}
