/**
 * Chapter-entry freeze probe (NEXT_SESSION task 3): scrolls the whole journey with steady wheel input
 * in a production build and reports long frames per chapter, with where in the chapter they happen.
 *   npm run build && npx vite preview --port 4173 --strictPort   (in another terminal)
 *   node scripts/measure-freezes.ts [--low] [--step=120] [--every=40] [--runs=1]
 * A frame over 50 ms is a visible hitch; over 250 ms reads as a freeze.
 * --why[=MS]: for every frame over MS (default 150), the programs linked in it and why, plus the
 * long-animation-frame breakdown (script attribution, layout, render) that overlaps it.
 */
import { chromium } from 'playwright-core';
import { chapters } from '../src/chapters/registry.ts';
import { buildTrack, classifyAspect, resolve } from '../src/engine/scroll/resolver.ts';

const args = process.argv.slice(2);
const opt = (name: string, fallback: number) =>
  Number(args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const low = args.includes('--low');
const step = opt('step', 120);
const every = opt('every', 40);
const runs = opt('runs', 1);
/** --dump=NAME: print the source lines that differ for one shader name recompiled on entry */
const dump = args.find((a) => a.startsWith('--dump='))?.slice(7);
const why = args.some((a) => a === '--why' || a.startsWith('--why='));
const whyMs = opt('why', 150);
const viewport = { width: 1440, height: 900 };
const track = buildTrack(chapters, classifyAspect(viewport.width, viewport.height));

interface Gl {
  readonly compile: number;
  readonly link: number;
  readonly status: number;
  readonly texture: number;
  readonly buffer: number;
}
interface Sample {
  readonly at: number;
  readonly dt: number;
  readonly p: number;
  /** WebGL time accumulated before this frame's callback (the work of the frame just ended) */
  readonly gl: Gl;
}

const browser = await chromium.launch({ channel: 'chrome' });
for (let run = 0; run < runs; run += 1) {
  const context = await browser.newContext({ viewport });
  if (low) await context.addInitScript(() => localStorage.setItem('mission.quality', 'low'));
  // frame recorder: every rAF interval with the scroll progress at that frame, plus (always) the
  // milliseconds spent inside WebGL calls of each kind during that frame
  await context.addInitScript(() => {
    const gl = { compile: 0, link: 0, status: 0, texture: 0, buffer: 0 };
    const out: Array<{ at: number; dt: number; p: number; gl: typeof gl }> = [];
    (window as unknown as { __frames: typeof out }).__frames = out;
    const P = WebGL2RenderingContext.prototype as unknown as Record<string, unknown>;
    const time = (names: string[], key: keyof typeof gl) => {
      for (const name of names) {
        const orig = P[name] as (...a: unknown[]) => unknown;
        if (typeof orig !== 'function') continue;
        P[name] = function (this: unknown, ...a: unknown[]) {
          const s = performance.now();
          try {
            return orig.apply(this, a);
          } finally {
            gl[key] += performance.now() - s;
          }
        };
      }
    };
    time(['compileShader'], 'compile');
    time(['linkProgram'], 'link');
    // three reads program status right after linking: the driver finishes the link here
    time(
      ['getProgramParameter', 'getProgramInfoLog', 'getShaderParameter', 'getShaderInfoLog'],
      'status',
    );
    time(
      [
        'texImage2D',
        'texSubImage2D',
        'compressedTexImage2D',
        'compressedTexSubImage2D',
        'texStorage2D',
        'texImage3D',
        'generateMipmap',
      ],
      'texture',
    );
    time(['bufferData', 'bufferSubData'], 'buffer');
    // --why: every linked program's name, #define set and full-source hash, tagged with its frame
    // number, plus every program deletion (so a relink can be told apart from a new variant)
    const links: Array<{
      frame: number;
      name: string;
      defs: string[];
      hash: number;
      text?: string;
    }> = [];
    const keepText = location.search.includes('dump');
    (window as unknown as { __links: typeof links }).__links = links;
    const deletes: Array<{ frame: number; hash: number }> = [];
    (window as unknown as { __deletes: typeof deletes }).__deletes = deletes;
    const hashOf = new WeakMap<object, number>();
    const fnv = (s: string) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
      return h >>> 0;
    };
    const del = P['deleteProgram'] as (pr: object) => void;
    P['deleteProgram'] = function (this: unknown, pr: object) {
      deletes.push({ frame: out.length, hash: hashOf.get(pr) ?? 0 });
      return del.call(this, pr);
    };
    const src = new WeakMap<object, string>();
    const attached = new WeakMap<object, object[]>();
    const ss = P['shaderSource'] as (sh: object, s: string) => void;
    P['shaderSource'] = function (this: unknown, sh: object, s: string) {
      src.set(sh, s);
      return ss.call(this, sh, s);
    };
    const at = P['attachShader'] as (pr: object, sh: object) => void;
    P['attachShader'] = function (this: unknown, pr: object, sh: object) {
      const list = attached.get(pr) ?? [];
      list.push(sh);
      attached.set(pr, list);
      return at.call(this, pr, sh);
    };
    const lk = P['linkProgram'] as (pr: object) => void;
    P['linkProgram'] = function (this: unknown, pr: object) {
      const text = (attached.get(pr) ?? [])
        .map((sh) => src.get(sh) ?? '')
        .join(String.fromCharCode(10));
      const name =
        /#define SHADER_NAME (\S+)/.exec(text)?.[1] ??
        /#define SHADER_TYPE (\S+)/.exec(text)?.[1] ??
        '?';
      const defs = [...new Set(text.match(/^#define [A-Z_0-9]+(?: .*)?$/gm) ?? [])].filter(
        (d) => !d.startsWith('#define SHADER_NAME'),
      );
      const hash = fnv(text);
      hashOf.set(pr, hash);
      links.push({ frame: out.length, name, defs, hash, ...(keepText ? { text } : {}) });
      return lk.call(this, pr);
    };
    let last = performance.now();
    const tick = (now: number) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      out.push({ at: now, dt: now - last, p: max > 0 ? window.scrollY / max : 0, gl: { ...gl } });
      gl.compile = gl.link = gl.status = gl.texture = gl.buffer = 0;
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // long animation frames (Chrome): where a hitch's time went when it was not WebGL
    const loaf: unknown[] = [];
    (window as unknown as { __loaf: unknown[] }).__loaf = loaf;
    // the long-animation-frame entry and its script attributions (not in lib.dom yet)
    interface LoafScript {
      duration: number;
      invokerType: string;
      invoker: string;
      sourceFunctionName: string;
      sourceURL: string;
      sourceCharPosition: number;
    }
    interface Loaf {
      startTime: number;
      duration: number;
      blockingDuration: number;
      styleAndLayoutStart: number;
      renderStart: number;
      scripts: LoafScript[];
    }
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as Loaf[]) {
        if (e.duration < 50) continue;
        const end = e.startTime + e.duration;
        loaf.push({
          start: e.startTime,
          end,
          blocking: Math.round(e.blockingDuration),
          layout: Math.round(e.styleAndLayoutStart ? end - e.styleAndLayoutStart : 0),
          render: Math.round(e.renderStart ? end - e.renderStart : 0),
          scripts: e.scripts
            .filter((x) => x.duration >= 5)
            .map(
              (x) =>
                `${Math.round(x.duration)}ms ${x.invokerType} ${String(x.invoker).slice(0, 50)} ${x.sourceFunctionName || '?'}@${String(x.sourceURL).split('/').pop()}:${x.sourceCharPosition}`,
            ),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  });
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto(`http://localhost:4173/?gate=off${dump ? '&dump' : ''}`);
  await page.waitForSelector('canvas', { timeout: 30_000 });
  await page.waitForTimeout(4000); // first scene up and settled
  const loadMs = Date.now() - t0;
  await page.evaluate(() => {
    (window as unknown as { __frames: unknown[] }).__frames.length = 0;
  });
  await page.mouse.move(720, 450);
  // steady wheel until the page bottom, then let the smoothing settle
  for (let i = 0; i < 4000; i += 1) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(every);
    if (i % 25 === 0) {
      const done = await page.evaluate(
        () => window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 2,
      );
      if (done) break;
    }
  }
  await page.waitForTimeout(1500);
  const frames = await page.evaluate(() => (window as unknown as { __frames: Sample[] }).__frames);
  const linked = await page.evaluate(
    () =>
      (
        window as unknown as {
          __links: Array<{
            frame: number;
            name: string;
            defs: string[];
            hash: number;
            text?: string;
          }>;
        }
      ).__links,
  );
  const deleted = await page.evaluate(
    () => (window as unknown as { __deletes: Array<{ frame: number; hash: number }> }).__deletes,
  );
  const loafs = await page.evaluate(
    () =>
      (
        window as unknown as {
          __loaf: Array<{
            start: number;
            end: number;
            blocking: number;
            layout: number;
            render: number;
            scripts: string[];
          }>;
        }
      ).__loaf,
  );
  const marks = await page.evaluate(() =>
    performance.getEntriesByType('mark').map((m) => ({ name: m.name, at: m.startTime })),
  );
  await context.close();

  // per chapter: worst frame, hitches, freezes, and where the worst one sits in the chapter
  const zero = (): Gl => ({ compile: 0, link: 0, status: 0, texture: 0, buffer: 0 });
  const rows = new Map<
    string,
    { worst: number; at: number; hitches: number; freezes: number; gl: Gl; shaderMs: number }
  >();
  for (const c of chapters)
    rows.set(c.id, { worst: 0, at: 0, hitches: 0, freezes: 0, gl: zero(), shaderMs: 0 });
  let total = 0;
  for (const f of frames) {
    const r = resolve(track, f.p);
    const row = rows.get(r.id);
    if (!row) continue;
    if (f.dt > 50) row.hitches += 1;
    if (f.dt > 250) row.freezes += 1;
    if (f.dt > row.worst) {
      row.worst = f.dt;
      row.at = r.localT;
      row.gl = f.gl;
    }
    row.shaderMs += f.gl.compile + f.gl.link + f.gl.status;
    if (f.dt > 50) total += f.dt;
  }
  const s = [...frames.map((f) => f.dt)].sort((a, b) => a - b);
  const q = (x: number) => s[Math.min(s.length - 1, Math.floor(x * s.length))] ?? 0;
  console.log(
    `run ${run + 1}${low ? ' (low)' : ''}: ${frames.length} frames, load ${loadMs} ms, p50 ${q(0.5).toFixed(1)} p95 ${q(0.95).toFixed(1)} ms, ${(total / 1000).toFixed(1)} s spent in hitches`,
  );
  console.table(
    [...rows].map(([id, r]) => ({
      chapter: id,
      'worst ms': Math.round(r.worst),
      'at t': r.worst > 50 ? r.at.toFixed(2) : '',
      'hitches >50': r.hitches,
      'freezes >250': r.freezes,
      'worst: shader ms': Math.round(r.gl.compile + r.gl.link + r.gl.status),
      'worst: upload ms': Math.round(r.gl.texture + r.gl.buffer),
      'chapter shader ms': Math.round(r.shaderMs),
    })),
  );
  if (why) {
    // for each freeze, which programs linked in it and which defines differ from the last program
    // linked earlier under the same shader name (that difference is why it was recompiled)
    const freezes = frames
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.dt > whyMs)
      .sort((a, b) => b.f.dt - a.f.dt)
      .slice(0, 16);
    for (const { f, i } of freezes) {
      const r = resolve(track, f.p);
      // links are tagged with out.length at link time: they belong to the frame that ends at i
      const here = linked.filter((l) => l.frame === i);
      console.log(`
${Math.round(f.dt)} ms in ${r.id} t=${r.localT.toFixed(2)}: ${here.length} programs linked`);
      const reasons = new Map<string, number>();
      for (const l of here) {
        // byte-identical source linked before: either deleted since (released and rebuilt) or
        // still alive (a second program with the same code: the cache key differs elsewhere)
        const twin = [...linked].reverse().find((o) => o.frame < i && o.hash === l.hash);
        if (twin) {
          const gone = deleted.some(
            (d) => d.hash === l.hash && d.frame > twin.frame && d.frame <= i,
          );
          const key = gone
            ? `RELINK after delete (${l.name})`
            : `DUPLICATE, same source still alive (${l.name})`;
          reasons.set(key, (reasons.get(key) ?? 0) + 1);
          continue;
        }
        const before = [...linked].reverse().find((o) => o.frame < i && o.name === l.name);
        if (!before) {
          reasons.set(`new shader ${l.name}`, (reasons.get(`new shader ${l.name}`) ?? 0) + 1);
          continue;
        }
        const a = new Set(before.defs);
        const b = new Set(l.defs);
        const diff = [
          ...[...b].filter((d) => !a.has(d)).map((d) => `+${d.slice(8)}`),
          ...[...a].filter((d) => !b.has(d)).map((d) => `-${d.slice(8)}`),
        ].join('  ');
        const key = diff ? `${diff} (${l.name})` : `same defines as before (${l.name})`;
        reasons.set(key, (reasons.get(key) ?? 0) + 1);
      }
      for (const [k, n] of [...reasons].sort((x, y) => y[1] - x[1]).slice(0, 6))
        console.log(`  ${n}× ${k}`);
      for (const m of marks.filter((x) => x.at > f.at - f.dt - 1000 && x.at < f.at + 200))
        console.log(`  mark ${m.name} at ${Math.round(m.at - f.at)} ms`);
      for (const l of loafs.filter((x) => x.end > f.at - f.dt && x.start < f.at)) {
        console.log(
          `  LoAF ${Math.round(l.end - l.start)} ms: blocking ${l.blocking}, layout ${l.layout}, render ${l.render}`,
        );
        for (const sc of l.scripts.slice(0, 5)) console.log(`    ${sc}`);
      }
    }
  }
  if (dump) {
    const worst = frames
      .map((f, i) => ({ f, i }))
      .sort((a, b) => b.f.dt - a.f.dt)
      .slice(0, 8);
    for (const { i } of worst) {
      const l = linked.find((x) => x.frame === i && x.name === dump);
      if (!l?.text) continue;
      const before = [...linked].reverse().find((o) => o.frame < i && o.name === dump && o.text);
      if (!before?.text) continue;
      const a = new Set(before.text.split(String.fromCharCode(10)));
      const b = new Set(l.text.split(String.fromCharCode(10)));
      console.log(`
${dump}: entry program vs the one linked earlier`);
      for (const line of b) if (!a.has(line)) console.log(`  + ${line.slice(0, 160)}`);
      for (const line of a) if (!b.has(line)) console.log(`  - ${line.slice(0, 160)}`);
      break;
    }
  }
}
await browser.close();
