import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for acceptance tests against the local dev server.
 *
 * Run:  npx playwright test
 *
 * The dev server is started automatically by webServer below.
 * Set TEST_BASE_URL to point at a deployed preview instead, e.g.
 *   TEST_BASE_URL=https://tourism-week.vercel.app npx playwright test
 */

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // The public site must render immediately from the snapshot (no spinner wait)
    navigationTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the Vite dev server automatically when TEST_BASE_URL is not set.
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: 'npm run predev && npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stderr: 'pipe',
      },
});
