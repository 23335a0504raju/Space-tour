/**
 * Re-encodes the flagship project screenshots for the Project Bay (PROJECT_PRESENTATION_PLAN.md §5).
 * Reads the originals from the live site's folder (read-only; never modified) and writes resized
 * WebP files to public/assets/projects/. Prints sizes and SHA-256 of the originals for the register.
 *   node scripts/prepare-project-images.ts
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '..');
const SRC = 'C:/projects/MainPortfolio/port/public/image';
const OUT = join(ROOT, 'public', 'assets', 'projects');
const WIDTH = 1280;

const FILES = [
  ['traffic.png', 'smartway-traffic.webp'],
  ['docintel.png', 'documentdb.webp'],
  ['stash.png', 'stash.webp'],
] as const;

mkdirSync(OUT, { recursive: true });
for (const [from, to] of FILES) {
  const input = join(SRC, from);
  const sha = createHash('sha256').update(readFileSync(input)).digest('hex');
  const out = join(OUT, to);
  const info = await sharp(input)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(out);
  console.log(
    `${from} → ${to}  ${info.width}×${info.height}  ${(statSync(out).size / 1024).toFixed(0)} KB  sha256 ${sha.slice(0, 7)}…${sha.slice(-4)}`,
  );
}
