import { defineConfig, devices } from '@playwright/test';

// The live smoke (CLAUDE.md, "Live smoke"; .github/workflows/live-smoke.yml): one read-only sign-in on the live site
// with the authenticator code, once a day. It types a real password and key, so nothing is recorded or kept: traces,
// screenshots and video are off, the page snapshot Playwright adds to a failure is off, and the workflow uploads
// nothing. The leak check (`npm run test:leak-check`, E2E_LEAK_CHECK) runs this same config on the local stack with a
// throwaway account, failing on purpose, and fails when any secret shows up in what the run printed or kept.
//
// Never run against the live site from an agent session: only GitHub's live-smoke workflow, or Roshan by hand.

export const LIVE_URL = 'https://students-budget.vercel.app';
const LEAK_PORT = Number(process.env.E2E_LEAK_PORT ?? 3210);
const leakCheck = Boolean(process.env.E2E_LEAK_CHECK);
const url = leakCheck ? `http://localhost:${LEAK_PORT}` : LIVE_URL;

// The environment guard. The leak check: only the local stack, whose accounts are all throwaway ones.
if (leakCheck) {
  const stack = process.env.SUPABASE_TEST_URL;
  if (!stack || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(stack).hostname)) {
    throw new Error('The leak check runs on the local stack only: set SUPABASE_TEST_URL and SUPABASE_TEST_KEY from `node scripts/supabase-test-env.mjs`');
  }
} else {
  // The live site: only the account made for the smoke, never a person's. Its address has "+smoke@" in it.
  const email = process.env.E2E_LIVE_EMAIL ?? '';
  if (!process.env.E2E_LIVE_PASSWORD || !process.env.E2E_LIVE_TOTP_SECRET || !email) {
    throw new Error('E2E_LIVE_EMAIL, E2E_LIVE_PASSWORD and E2E_LIVE_TOTP_SECRET are needed (the live-smoke environment on GitHub)');
  }
  if (!email.includes('+smoke@')) throw new Error('E2E_LIVE_EMAIL must be the smoke account, an address with "+smoke@" in it');
}
// Playwright's page snapshot for a failed test (error-context.md) holds what the fields hold: off. An internal switch,
// so the leak check is what tells if a Playwright update stops honouring it.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

export default defineConfig({
  testDir: '.',
  testMatch: 'smoke.spec.ts',
  outputDir: '../test-results/live',
  forbidOnly: !!process.env.CI,
  // One retry on GitHub, to tell a flaky run from a broken site; the report names a retried pass as flaky.
  retries: process.env.CI ? 1 : 0,
  // One shared account: one sign-in at a time.
  workers: 1,
  globalSetup: leakCheck ? './leak-check.setup.ts' : undefined,
  reporter: [['list']],
  use: { baseURL: url, trace: 'off', screenshot: 'off', video: 'off', locale: 'en-GB', serviceWorkers: 'block' },
  projects: [{ name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } }],
  // The leak check builds the app against the local stack, as the real-server e2e does (e2e-real/playwright.config.ts).
  webServer: leakCheck
    ? {
        command: `npm run build && npm run start -- -p ${LEAK_PORT}`,
        cwd: '..',
        url,
        reuseExistingServer: false,
        timeout: 600_000,
        env: { NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_TEST_URL ?? '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_TEST_KEY ?? '' },
      }
    : undefined,
});
