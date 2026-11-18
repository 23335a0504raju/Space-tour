/**
 * Lists every content fact that is not yet confirmed.
 *   npm run content:report   → report only (exit 0)
 *   npm run content:check    → exit 1 if anything is unconfirmed (release gate, phase P5)
 *
 * Runs on Node's built-in TypeScript type stripping (Node ≥ 22.18 / 24).
 */
import { collectFacts, countByStatus } from '../src/content/audit.ts';
import { content } from '../src/content/index.ts';

const strict = process.argv.includes('--strict');
const entries = collectFacts(content);
const counts = countByStatus(entries);

console.log('\nContent status');
console.table(counts);

const order = ['missing', 'conflict', 'unverified', 'source'] as const;
for (const status of order) {
  const list = entries.filter((e) => e.fact.status === status);
  if (list.length === 0) continue;
  console.log(`\n── ${status.toUpperCase()} (${list.length}) ──`);
  for (const { path, fact } of list) {
    console.log(`  ${path}${fact.note ? `\n      → ${fact.note}` : ''}`);
  }
}

const unconfirmed = entries.length - counts.confirmed;
console.log(`\n${counts.confirmed}/${entries.length} facts confirmed.`);

if (strict && unconfirmed > 0) {
  console.error(`content:check failed: ${unconfirmed} fact(s) are not confirmed.`);
  process.exit(1);
}
