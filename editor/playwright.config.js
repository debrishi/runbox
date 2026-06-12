// Playwright config — runs Vite dev server automatically and points
// the test browser at it. Single browser (chromium) keeps the run fast.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // The whole suite is small; one worker keeps logs readable.
  workers: 1,
  // Tests touch a real (cold-startable) Lambda. Generous per-test budget.
  timeout: 60_000,
  expect: {
    // Lambda cold start can take ~6s; UI assertions need patience.
    timeout: 30_000,
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Auto-start the dev server before tests, reuse if already running.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
