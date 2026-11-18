import { defineConfig } from 'vitest/config';

// Run tests through `npm test` (scripts/vitest.ts), which normalises the Windows drive-letter
// casing before Vitest starts. See that file for the reason.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
