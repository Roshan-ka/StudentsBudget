import { defineConfig, devices } from '@playwright/test';

// The service worker is only registered in a production build, so this config runs the one spec that needs it
// against `next start`. Port 3100 keeps it apart from the dev server on 3000 that `playwright.config.ts` uses.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'offline.spec.ts',
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://localhost:3100' },
  projects: [{ name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run start -- -p 3100',
    url: 'http://localhost:3100',
    // Always a fresh build: a server left on 3100 by an earlier run would be testing old code.
    reuseExistingServer: false,
    // The build runs before the server starts.
    timeout: 300_000,
  },
});
