import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JOURNEY_ASSETS } from './preload.ts';

const SRC = join(__dirname, '..', '..');
const PUBLIC = join(SRC, '..', 'public');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'spikes' || f === 'tools' ? [] : sources(p);
    return /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts') ? [p] : [];
  });
}

describe('journey preload manifest', () => {
  it('lists every asset the journey code references', () => {
    const used = new Set<string>();
    for (const file of sources(SRC)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/['"`](\/assets\/[^'"`]+)['"`]/g)) {
        if (m[1]) used.add(m[1]);
      }
    }
    expect(used.size).toBeGreaterThan(10);
    const missing = [...used].filter((u) => !JOURNEY_ASSETS.includes(u));
    expect(missing).toEqual([]);
  });

  it('only lists files that exist, once each', () => {
    expect(new Set(JOURNEY_ASSETS).size).toBe(JOURNEY_ASSETS.length);
    expect(JOURNEY_ASSETS.filter((u) => !existsSync(join(PUBLIC, u)))).toEqual([]);
  });
});
