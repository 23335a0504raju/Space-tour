/**
 * Injects the server-rendered Mission Brief into dist/brief/index.html, then checks that every
 * class name in that HTML exists in the shipped CSS (client and SSR builds must agree on
 * CSS-module names, or the page would render unstyled without JavaScript).
 * Run by `npm run build` after the client and SSR builds.
 */
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const ssrDir = join(root, 'dist-ssr');
const pagePath = join(root, 'dist', 'brief', 'index.html');
const PLACEHOLDER = '<div id="root"></div>';

const mod = (await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href)) as {
  render: () => string;
};
const html = mod.render();

const page = readFileSync(pagePath, 'utf8');
if (!page.includes(PLACEHOLDER)) throw new Error('prerender: #root placeholder not found');
writeFileSync(pagePath, page.replace(PLACEHOLDER, `<div id="root">${html}</div>`));

const assetsDir = join(root, 'dist', 'assets');
const css = readdirSync(assetsDir)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(assetsDir, f), 'utf8'))
  .join('\n');
const GLOBAL_CLASSES = new Set(['skip-link', 'visually-hidden']);
const classes = new Set(
  [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => (m[1] ?? '').split(/\s+/)).filter(Boolean),
);
const missing = [...classes].filter((c) => !GLOBAL_CLASSES.has(c) && !css.includes(`.${c}`));
if (missing.length > 0) {
  console.error(`prerender: ${missing.length} class(es) missing from CSS: ${missing.join(', ')}`);
  process.exit(1);
}

rmSync(ssrDir, { recursive: true, force: true });
console.log(
  `Prerendered Mission Brief: ${(html.length / 1024).toFixed(1)} KB of HTML, ${classes.size} classes verified against CSS.`,
);
