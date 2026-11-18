import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production preview build, using the locally installed Google Chrome
// (channel: 'chrome'), so no Playwright browser download is needed.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'list',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
    { name: 'phone-portrait', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
});
