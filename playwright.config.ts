import { defineConfig, devices } from '@playwright/test';

// Parallel checkouts each run on a port of their own: `E2E_PORT=3001 npm run test:e2e`.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  // Needs a production build, which has the service worker; playwright.offline.config.ts runs it.
  testIgnore: '**/offline.spec.ts',
  forbidOnly: !!process.env.CI,
  use: { baseURL },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
