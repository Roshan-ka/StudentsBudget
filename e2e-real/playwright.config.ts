import { defineConfig, devices } from '@playwright/test';
import { REAL_BASE_URL, REAL_PORT } from './env';

// The real-server e2e: the app against the local Supabase stack (`npm run supabase:start`) instead of the mocks, so
// sign-in, the authenticator code, passkeys and sync meet the real Auth server and database. `npm run test:e2e:real`
// runs it. A few journeys, not the whole suite twice: the mocked suite (playwright.config.ts) stays as it is.
//
// The stack's URL and browser key come from `node scripts/supabase-test-env.mjs` (SUPABASE_TEST_URL, SUPABASE_TEST_KEY),
// as for `npm run test:contract`. Nothing secret lives here: the local stack makes its own keys.
const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_KEY;
if (!url || !key) {
  throw new Error('SUPABASE_TEST_URL and SUPABASE_TEST_KEY are not set: start the local stack, then set them from `node scripts/supabase-test-env.mjs`');
}
// Environment guard: only a stack on this machine. A hosted project (real accounts) is refused before anything builds.
const host = new URL(url).hostname;
if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
  throw new Error(`SUPABASE_TEST_URL must be the local stack on this machine, not ${host}`);
}

export default defineConfig({
  testDir: '.',
  forbidOnly: !!process.env.CI,
  // A test that fails once is a finding: the repeat check, not a retry, tells a flaky test apart.
  retries: 0,
  // The random clicker (monkey.spec.ts, @monkey) walks for minutes: only when asked for, by `npm run test:monkey` or
  // the nightly's monkey job (E2E_MONKEY=1). A `--grep-invert` on the command line takes this one's place.
  grepInvert: process.env.E2E_MONKEY ? undefined : /@monkey/,
  // Throwaway users and authenticator codes from one IP: two at a time, as the 2FA proof ran them.
  workers: 2,
  // The tree check (testkit/tree-check.mjs): the run fails when a test wrote a file into the repo.
  globalSetup: '../testkit/tree-check.mjs',
  reporter: [
    ...(process.env.CI ? ([['dot'], ['html', { open: 'never', outputFolder: '../playwright-report-real' }]] as const) : ([['list']] as const)),
    // Each test's result kind (testkit/README.md): verified, failed, not run, skipped by design…, for the job summary.
    // A run with anything failed, inconclusive or not run ends as failed. Paths are from the repo root, where it runs.
    ['../testkit/result-kinds-reporter.mjs', { title: 'Real-server journeys', allowList: 'e2e/skip-allow-list.json', outputFile: 'result-kinds-real.md' }],
  ],
  // English and no service workers, as in playwright.config.ts. Traces stay for failed tests: synthetic users on a
  // throwaway stack, nothing real to leak.
  use: { baseURL: REAL_BASE_URL, trace: 'retain-on-failure', locale: 'en-GB', serviceWorkers: 'block' },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    // A production build with the stack's settings built in, from the repo root.
    command: `npm run build && npm run start -- -p ${REAL_PORT}`,
    cwd: '..',
    url: REAL_BASE_URL,
    // Never reuse: a server already on the port may be built against the mocks or a hosted project.
    reuseExistingServer: false,
    // The build here is often cold (a fresh checkout, CI) and shares the machine with the Docker stack: 300 s wasn't
    // enough on 2026-11-11 (cold build, 140 MB free RAM, CPU 92%; the 2FA proof).
    timeout: 600_000,
    env: { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key },
  },
});
