import { defineConfig } from '@playwright/test';

// P1 spike verification. Spikes are dev-only, so this runs against the dev server, using the
// locally installed Google Chrome (no Playwright browser download needed).
// Performance numbers from automated runs are NOT reference measurements; S4 must be run
// interactively on the real devices.
export default defineConfig({
  testDir: './e2e-spikes',
  reporter: 'list',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5174',
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174/spikes/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
