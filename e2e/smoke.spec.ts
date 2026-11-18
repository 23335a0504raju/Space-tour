import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('P0 smoke', () => {
  test('journey shell shows identity and persistent actions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link', { name: 'Mission Brief' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Contact' })).toBeVisible();
  });

  test('contact sheet opens, closes with Escape, and returns focus', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Contact' });
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Contact' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Contact' })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Mission Brief lists both internships and hides project templates in production', async ({
    page,
  }) => {
    await page.goto('/brief/');
    const experience = page.locator('#experience');
    await expect(experience).toContainText('Spotmies');
    await expect(experience).toContainText('Pit Solutions');
    await expect(experience).not.toContainText('Template');
  });

  for (const path of ['/', '/brief/']) {
    test(`no axe violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
