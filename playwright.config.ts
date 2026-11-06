import { defineConfig, devices } from '@playwright/test';
import { E2E_SUPABASE_ENV } from './e2e/helpers/supabase';

// Parallel checkouts each run on a port of their own: `E2E_PORT=3001 npm run test:e2e`.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  // Needs a production build, which has the service worker; playwright.offline.config.ts runs it.
  testIgnore: '**/offline.spec.ts',
  // Compiles every route once, after the web server is up and before the first test (e2e/global-setup.ts).
  globalSetup: './e2e/global-setup.ts',
  // The dev build on a busy laptop (2026-11-05/06, 10x runs at 2 workers): a WebKit page load took 3-6 s, and a client
  // navigation in Chrome waited up to 3.4 s for each of its chunks. Tests that open several pages ran past 30 s, and a
  // navigation past the 5 s of an expect. A test that hangs still fails, only later.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  // On CI an HTML report sits next to the dot output. ci.yml's e2e job doesn't use these: it passes
  // `--reporter=dot,blob` and merges the shards' blob reports, traces included, into playwright-report-e2e.
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  // Kept only for failed tests: `npx playwright show-trace test-results/<test>/trace.zip`.
  // English, whatever the machine's own locale: the app follows the browser's language (src/i18n), and the specs read
  // English. A spec about another language sets its own (test.use({ locale })).
  use: { baseURL, trace: 'retain-on-failure', locale: 'en-GB' },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    // A Supabase project that is configured but never reached: the account UI shows, and the specs answer its calls
    // by path. A dev server that is already running keeps its own settings (.env.local, or none).
    env: E2E_SUPABASE_ENV,
  },
});
