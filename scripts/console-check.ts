/**
 * Lists console warnings and errors while scrolling the journey (dev server shows StrictMode issues).
 *   node scripts/console-check.ts [url] [progress,progress,...]
 */
import { chromium } from 'playwright-core';

// Lists console warnings/errors on the dev server while jumping SC02 → SC05 → SC02.
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const seen = new Map<string, number>();
page.on('console', (m) => {
  if (m.type() !== 'warning' && m.type() !== 'error') return;
  const key = `${m.type()}: ${m.text().slice(0, 140)}`;
  seen.set(key, (seen.get(key) ?? 0) + 1);
});
page.on('pageerror', (e) => seen.set(`pageerror: ${e.message}`, 1));
await page.goto(process.argv[2] ?? 'http://localhost:5173/');
await page.waitForSelector('canvas');
await page.waitForTimeout(3000);
for (const p of (process.argv[3] ?? '0.12,0.25,0.05,0.25,0.05').split(',').map(Number)) {
  await page.evaluate((x) => {
    window.scrollTo({
      top: (document.documentElement.scrollHeight - innerHeight) * x,
      behavior: 'instant',
    });
  }, p);
  await page.waitForTimeout(2000);
}
await browser.close();
for (const [k, n] of seen) console.log(`${n}× ${k}`);
console.log(`total distinct: ${seen.size}`);
