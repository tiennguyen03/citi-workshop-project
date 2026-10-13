import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests against the running local stack (`./bin/start-dev.sh`: app on :3000, API via :3001).
 * Every spec creates its own people and projects through the API, so the suite can be rerun without
 * resetting the database. Run with `npm run test:e2e` from `frontend/`.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.js/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  outputDir: './node_modules/.cache/e2e-results',
  use: {
    baseURL: 'http://localhost:3000',
    ...devices['Desktop Chrome'],
    viewport: { width: 1360, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
