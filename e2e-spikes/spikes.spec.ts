import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const SETTLE_MS = 1400; // > scrub (0.6 s) catch-up time

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  return errors;
}

const hud = (page: Page) => page.locator('pre').first();
const hudLine = async (page: Page, label: string) => {
  const text = (await hud(page).textContent()) ?? '';
  return text.split('\n').find((l) => l.startsWith(label)) ?? '';
};
const scrollToFraction = async (page: Page, f: number) => {
  await page.evaluate((fraction) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: max * fraction, behavior: 'instant' });
  }, f);
};
/** Scroll in small wheel-like steps so the scene actually plays through intermediate frames. */
const sweep = async (page: Page, from: number, to: number, steps = 40) => {
  for (let i = 0; i <= steps; i += 1) {
    await scrollToFraction(page, from + ((to - from) * i) / steps);
    await page.waitForTimeout(40);
  }
};

test('S1: reversible, single-clock, chapter jumps skip intermediate chapters', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/spikes/?s=s1');
  await expect(hud(page)).toContainText('progress', { timeout: 30_000 });

  // Arrive at 37% from below…
  await sweep(page, 0, 0.37);
  await page.waitForTimeout(SETTLE_MS);
  const forward = await hudLine(page, 'state hash');
  const chapterForward = await hudLine(page, 'chapter');

  // …go past it, then come back from above.
  await sweep(page, 0.37, 0.8);
  await sweep(page, 0.8, 0.37);
  await page.waitForTimeout(SETTLE_MS);
  const backward = await hudLine(page, 'state hash');
  console.log(`S1 forward  ${forward}\nS1 backward ${backward}\nS1 ${chapterForward}`);
  expect(backward).toBe(forward);

  const sync = await hudLine(page, 'same-frame');
  console.log(`S1 ${sync}`);
  const pct = Number(/([\d.]+)%/.exec(sync)?.[1] ?? 0);
  expect(pct).toBeGreaterThan(95);

  await page.screenshot({ path: 'spike-results/s1-mid.png' });

  // Chapter jump from 37% (Projects) to Contact: only the target chapter may render.
  await page.getByRole('button', { name: 'Contact' }).click();
  await page.waitForTimeout(900);
  const jump = await hudLine(page, 'last jump');
  console.log(`S1 ${jump}`);
  expect(jump).toContain('✓');
  await page.screenshot({ path: 'spike-results/s1-after-jump.png' });

  expect(errors).toEqual([]);
});

test('S2: scroll-scrubbed walk keeps feet planted and reverses exactly', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/spikes/?s=s2');
  await expect(hud(page)).toContainText('walk speed', { timeout: 30_000 });
  console.log(`S2 ${await hudLine(page, 'model')}`);
  console.log(`S2 ${await hudLine(page, 'walk speed')}`);

  await sweep(page, 0, 0.55, 80);
  await page.waitForTimeout(SETTLE_MS);
  const forward = await hudLine(page, 'state hash');
  await page.screenshot({ path: 'spike-results/s2-walking.png' });

  await sweep(page, 0.55, 0.9, 60);
  await sweep(page, 0.9, 0.55, 60);
  await page.waitForTimeout(SETTLE_MS);
  const backward = await hudLine(page, 'state hash');
  console.log(`S2 forward  ${forward}\nS2 backward ${backward}`);
  expect(backward).toBe(forward);

  const slide = await hudLine(page, 'foot slide');
  console.log(`S2 ${slide}`);
  const maxCm = Number(/max ([\d.]+) cm/.exec(slide)?.[1] ?? 99);
  expect(maxCm).toBeLessThan(2);

  expect(errors).toEqual([]);
});

for (const v of ['ktx2', 'etc1s'] as const) {
  test(`S3/S2: KTX2 variant "${v}" loads, keeps its skin and walks without sliding`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(`/spikes/?s=s2&v=${v}`);
    await expect(hud(page)).toContainText('walk speed', { timeout: 30_000 });
    const speed = await hudLine(page, 'walk speed');
    console.log(`S3 ${v} ${speed}`);
    expect(Number(/([\d.]+) m\/s/.exec(speed)?.[1] ?? 0)).toBeGreaterThan(1);
    await sweep(page, 0, 0.55, 80);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `spike-results/s3-${v}-walking.png` });
    const slide = await hudLine(page, 'foot slide');
    console.log(`S3 ${v} ${slide}`);
    expect(Number(/max ([\d.]+) cm/.exec(slide)?.[1] ?? 99)).toBeLessThan(2);
    expect(errors).toEqual([]);
  });
}

test('S4 full run (opt-in: S4_FULL=1): records a baseline JSON', async ({ page }) => {
  test.skip(!process.env['S4_FULL'], 'Set S4_FULL=1 to run the ~80 s benchmark');
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  const width = Number(process.env['S4_W'] ?? 1280);
  const height = Number(process.env['S4_H'] ?? 800);
  await page.setViewportSize({ width, height });
  await page.goto('/spikes/?s=s4');
  await expect(hud(page)).toContainText('GPU', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Run all' }).click();
  await expect(hud(page)).toContainText('Done:', { timeout: 200_000 });
  const report = (await page.locator('pre').nth(1).textContent()) ?? '';
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('spike-results', { recursive: true });
  writeFileSync(`spike-results/s4-baseline-headless-${width}x${height}.json`, report);
  console.log((await hud(page).textContent()) ?? '');
  expect(errors).toEqual([]);
});

test('S4: benchmark page loads and reports the GPU (no timing assertions)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/spikes/?s=s4');
  await expect(hud(page)).toContainText('GPU', { timeout: 30_000 });
  console.log(`S4 ${await hudLine(page, 'GPU')}`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'spike-results/s4-planet.png' });
  expect(errors).toEqual([]);
});
