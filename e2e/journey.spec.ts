import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { chapters } from '../src/chapters/registry.ts';
import { buildTrack, classifyAspect, progressFor } from '../src/engine/scroll/resolver.ts';

const SETTLE_MS = 1300; // scrub catch-up (0.6 s) + fades

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function scrollToProgress(page: Page, p: number) {
  await page.evaluate((progress) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: max * progress, behavior: 'instant' });
  }, p);
}

/** Visible overlay panel for a chapter rest point. */
const panel = (page: Page, label: string) =>
  page.locator(`section[aria-label="${label}"]:not([aria-hidden="true"])`);

test('journey: a long jump never leaves a passed panel on screen (P4 regression)', async ({
  page,
}) => {
  // A jump from the start to SC05 sweeps through SC04's rest points while chapters change. The
  // overlay re-render reset the Director's state and SC04's Education panel stayed visible.
  await page.goto('/?gate=off');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  const track = buildTrack(chapters, classifyAspect(vp.width, vp.height));
  for (const [from, to] of [
    [0, progressFor(track, 'sc05-ascent', 0.2)],
    [progressFor(track, 'sc02-room', 0.1), progressFor(track, 'sc05-ascent', 0.6)],
  ] as const) {
    await scrollToProgress(page, from);
    await page.waitForTimeout(SETTLE_MS);
    await scrollToProgress(page, to);
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator('section[aria-label]:not([aria-hidden="true"])')).toHaveCount(0);
    for (const label of ['Experience', 'Education'])
      await expect(page.locator(`section[aria-label="${label}"]`)).toHaveCSS(
        'visibility',
        'hidden',
      );
  }
});

test('journey: every rest point shows its content (screenshots for review)', async ({
  page,
}, info) => {
  const errors = collectErrors(page);
  await page.goto('/?gate=off');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });

  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  const track = buildTrack(chapters, classifyAspect(vp.width, vp.height));
  const project = info.project.name;

  for (const c of chapters) {
    const rests = c.restPoints.length ? c.restPoints : [0.5];
    for (const [i, r] of rests.entries()) {
      await scrollToProgress(page, progressFor(track, c.id, r));
      await page.waitForTimeout(SETTLE_MS);
      await page.screenshot({ path: `spike-results/journey/${project}/${c.scene}-${i}.png` });
    }
  }

  // Content checks at specific rest points (scrolling backwards from the end on purpose).
  const checks: Array<[string, number, string, RegExp]> = [
    // the final card, after the lift to the Moon (homecoming.ts CARD_REST)
    ['sc13-transmission', 0.9, 'Contact', /Open channel/],
    ['sc08-jupiter', 0.25, 'SmartWay Traffic', /Creator & Lead Developer/],
    ['sc04-crew-record', 0.35, 'Experience', /Spotmies[\s\S]*Pit Solutions/i],
    ['sc04-crew-record', 0.7, 'Education', /MVGR College of Engineering/],
  ];
  for (const [id, r, label, text] of checks) {
    await scrollToProgress(page, progressFor(track, id, r));
    await page.waitForTimeout(SETTLE_MS);
    await expect(panel(page, label)).toBeVisible();
    await expect(panel(page, label)).toContainText(text);
  }

  expect(errors).toEqual([]);
});

test('journey: flight plan jumps straight to a chapter', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?gate=off');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await page.getByText('Flight plan').click();
  await page.getByRole('button', { name: /Stack/ }).click();
  await page.waitForTimeout(SETTLE_MS);
  await expect(panel(page, 'Technology stack')).toBeVisible();
  // visitor-facing section label (internal SC codes are no longer shown)
  await expect(
    page.locator('p[aria-live="polite"]').filter({ hasText: /05\s*\/\s*Tech Stack/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('journey: header Projects jumps to the project installations', async ({ page }) => {
  await page.goto('/?gate=off');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('button', { name: 'Projects' })
    .click();
  await page.waitForTimeout(SETTLE_MS);
  await expect(panel(page, 'SmartWay Traffic')).toBeVisible();
});

test('mission brief works without JavaScript (prerendered)', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/brief/');
  await expect(page.locator('#experience')).toContainText('Spotmies');
  await expect(page.locator('#projects')).toContainText('SmartWay Traffic');
  await expect(page.locator('#contact')).toContainText('smilyraju8464@gmail.com');
  await context.close();
});

test('project bay: opens from an installation, traps scroll, Esc restores the exact frame', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?gate=off');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  const track = buildTrack(chapters, classifyAspect(vp.width, vp.height));
  await scrollToProgress(page, progressFor(track, 'sc08-jupiter', 0.25));
  await page.waitForTimeout(SETTLE_MS);

  const opener = panel(page, 'SmartWay Traffic').getByRole('button', { name: 'Open full details' });
  await expect(opener).toBeVisible();
  const before = await page.evaluate(() => Math.round(window.scrollY));
  await opener.click();

  const bay = page.locator('dialog[open]');
  await expect(bay).toBeVisible();
  await expect(bay.getByRole('heading', { level: 2, name: 'SmartWay Traffic' })).toBeVisible();
  await expect(bay.getByRole('heading', { name: 'What it does' })).toBeVisible();
  await expect(bay.getByRole('heading', { name: "How it's built" })).toBeVisible();

  // the page behind stays put while the Bay is open
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(500);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThanOrEqual(2);

  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThanOrEqual(2);
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
});
