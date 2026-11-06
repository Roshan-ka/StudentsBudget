import { defineConfig, devices } from '@playwright/test';
import { E2E_SUPABASE_ENV } from './e2e/helpers/supabase';

// Parallel checkouts each run on a port of their own: `E2E_PORT=3201 npm run test:e2e`. Not 3000 by default: the specs run
// against a production build (webServer below), and `next start` never runs on the dev server's port (CLAUDE.md).
const port = Number(process.env.E2E_PORT ?? 3200);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  // Needs a production build, which has the service worker; playwright.offline.config.ts runs it.
  testIgnore: '**/offline.spec.ts',
  // Asks for every route once, after the web server is up and before the first test (e2e/global-setup.ts).
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  // On CI an HTML report sits next to the dot output. ci.yml's e2e job doesn't use these: it passes
  // `--reporter=dot,blob` and merges the shards' blob reports, traces included, into playwright-report-e2e.
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  // Kept only for failed tests: `npx playwright show-trace test-results/<test>/trace.zip`.
  // English, whatever the machine's own locale: the app follows the browser's language (src/i18n), and the specs read
  // English. A spec about another language sets its own (test.use({ locale })).
  // Service workers are blocked: a production build registers one, and a cached page must not answer in place of the
  // server. offline.spec.ts tests the worker, under playwright.offline.config.ts.
  use: { baseURL, trace: 'retain-on-failure', locale: 'en-GB', serviceWorkers: 'block' },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
  ],
  // A production build, as the phone gets it. The dev build was the bottleneck (2026-11-06, 10x runs of check-in, badges
  // and accounts at 2 workers): a WebKit page load took 3-6 s and a client navigation waited up to 3.4 s for each chunk,
  // so tests ran past their 30 s and navigations past an expect's 5 s.
  webServer: {
    command: `npm run build && npm run start -- -p ${port}`,
    url: baseURL,
    // A server already on the port is used as it is: `E2E_PORT=3000` runs the specs against a running `npm run dev`.
    reuseExistingServer: true,
    // The build runs before the server starts.
    timeout: 300_000,
    // A Supabase project that is configured but never reached: the account UI shows, and the specs answer its calls
    // by path. The settings are built into the app. A server that is already running keeps its own (.env.local, or
    // none).
    env: E2E_SUPABASE_ENV,
  },
});
