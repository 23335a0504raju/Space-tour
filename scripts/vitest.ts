/**
 * Launches Vitest with a normalised working directory.
 *
 * Why: on Windows, Git Bash (and VS Code terminals opened on "c:\…") give Node a cwd with a
 * lowercase drive letter, while module paths resolve to "C:/…". Vitest then loads its runner
 * twice and every suite fails with "Cannot read properties of undefined (reading 'config')".
 * Verified 2026-11-16: the same tests pass from "C:\…" and fail from "c:\…".
 *
 * Usage: `npm test` / `npm run test:watch` (extra arguments are forwarded).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const require = createRequire(join(cwd, 'package.json'));
const pkgPath = require.resolve('vitest/package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { bin: string | Record<string, string> };
const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin['vitest'];
if (!binRel) throw new Error('vitest bin not found');
const vitestBin = join(dirname(pkgPath), binRel);

const result = spawnSync(process.execPath, [vitestBin, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
