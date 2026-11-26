import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Phones keep the section links in a menu overlay (navbar, 2026-11-21): open it when present. */
async function openNav(page: Page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
}

test.describe('P0 smoke', () => {
  test('journey shell shows identity and persistent actions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await openNav(page);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link', { name: 'Mission Brief' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Contact' })).toBeVisible();
  });

  test('Contact in the header flies to the final card (no separate sheet)', async ({ page }) => {
    await page.goto('/?gate=off');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await openNav(page);
    await page.getByRole('button', { name: 'Contact' }).click();
    const card = page.locator('section[aria-label="Contact"]:not([aria-hidden="true"])');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByRole('button', { name: 'Copy email' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Contact' })).toBeHidden();
  });

  test('Mission Brief lists both internships and hides project templates in production', async ({
    page,
  }) => {
    await page.goto('/brief/');
    const experience = page.locator('#experience');
    await expect(experience).toContainText('Spotmies');
    await expect(experience).toContainText(/Pit Solutions/i);
    await expect(experience).not.toContainText('Template');
  });

  for (const path of ['/', '/?gate=off', '/brief/']) {
    test(`no axe violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
