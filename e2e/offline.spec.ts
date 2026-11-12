import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { MESSAGES } from '../src/i18n/messages';
import { chooseLanguage } from './helpers/languages';
import { completeSetup } from './helpers/setup';

// Run by playwright.offline.config.ts against a production build: the service worker only exists there.

const PRECACHED_PAGES = [
  '/',
  '/entries',
  '/entries/new',
  '/charts',
  '/tips',
  '/badges',
  '/check-in',
  '/reveal',
  '/settings',
  '/settings/accounts',
  '/settings/plan',
  '/settings/profile',
  '/settings/appearance',
  '/settings/account',
  '/settings/backup',
  '/settings/moderation',
  '/setup',
  '/privacy',
  '/impressum',
];

/** A same-origin URL that no cache holds and no page serves: offline, a fetch of it must fail at the network. */
const PROBE_URL = '/sw-offline-probe';

function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main' });
}

/**
 * Collects the scripts, styles and fonts that fail to load, which is how a page that opened without its files
 * shows up. Aborted requests are left out: the browser aborts a page's loads when it navigates away.
 */
function trackFailedAssets(page: Page): string[] {
  const failed: string[] = [];
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    if (new URL(request.url()).pathname.startsWith('/_next/static/')) failed.push(request.url());
  });
  return failed;
}

/** Sets up a plan online, then waits until the service worker has installed (it caches the pages) and controls the page. */
async function setUpOnlineThenGoOffline(page: Page, context: BrowserContext) {
  await completeSetup(page);
  // The page was loaded before the worker took over, so wait for it to claim the page. A worker only
  // activates once its install is done, and the install is what caches the pages.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
}

test('opens and navigates with no network after one online visit', async ({ page, context }) => {
  test.setTimeout(60_000);
  const failedAssets = trackFailedAssets(page);

  await setUpOnlineThenGoOffline(page, context);

  // Offline has to be real, or everything below would pass by quietly using the network. Check both places
  // a request can come from: the page (which also passes through the worker) and the worker's own fetches,
  // which the network-first fallback depends on.
  const fromPage = await page.evaluate((url) => fetch(url).then(() => 'resolved', () => 'rejected'), PROBE_URL);
  expect(fromPage).toBe('rejected');
  await expect.poll(() => context.serviceWorkers().length).toBeGreaterThan(0);
  const fromWorker = await context
    .serviceWorkers()[0]
    .evaluate((url) => fetch(url).then(() => 'resolved', () => 'rejected'), PROBE_URL);
  expect(fromWorker).toBe('rejected');

  // A reload is a navigation: the worker answers it from the cache. The region only renders once the page
  // has hydrated and read its plan from IndexedDB, so it proves the scripts came from the cache too.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'StudentsBudget', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Left to spend this month' })).toBeVisible();

  // Entries was never opened online. Next's own request for it fails offline, the browser then opens the
  // page as a plain navigation, and the worker answers that from the cache.
  await mainNav(page).getByRole('link', { name: 'Entries', exact: true }).click();
  await expect(page).toHaveURL('/entries');
  await expect(page.getByRole('heading', { level: 2, name: 'Entries', exact: true })).toBeVisible();
  // The month nav is drawn by the page's own scripts, from IndexedDB.
  await expect(page.getByRole('navigation', { name: 'Month' })).toBeVisible();

  expect(failedAssets).toEqual([]);
});

test('opens a cached page whatever its query string says', async ({ page, context }) => {
  test.setTimeout(60_000);

  await setUpOnlineThenGoOffline(page, context);

  await page.goto('/entries?month=2026-10');
  await expect(page.getByText('Oct 2026', { exact: true })).toBeVisible();

  await page.goto('/entries?category=eating-out&month=2026-10');
  await expect(page.getByText('Eating out · Oct 2026', { exact: true })).toBeVisible();
});

test('every page the worker caches opens offline with its scripts', async ({ page, context }) => {
  test.setTimeout(60_000);
  const failedAssets = trackFailedAssets(page);

  await setUpOnlineThenGoOffline(page, context);

  for (const path of PRECACHED_PAGES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'StudentsBudget', exact: true }), path).toBeVisible();
    // Rendered only after hydration and the plan read: the scripts loaded.
    await expect(mainNav(page), path).toBeVisible();
  }

  expect(failedAssets).toEqual([]);
});

test('opens in German with no network once German is chosen', async ({ page, context }) => {
  test.setTimeout(60_000);
  const failedAssets = trackFailedAssets(page);

  await setUpOnlineThenGoOffline(page, context);
  // The dictionaries are part of the pages' scripts, never loaded later, so the cached pages hold German too.
  const t = MESSAGES.de;
  await chooseLanguage(page, 'de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('region', { name: t.home.leftThisMonth.heading, exact: true })).toBeVisible();

  const nav = page.getByRole('navigation', { name: t.shell.navLabel, exact: true });
  await nav.getByRole('link', { name: t.shell.nav.settings, exact: true }).click();
  await expect(page).toHaveURL('/settings');
  await expect(page.getByRole('heading', { level: 2, name: t.shell.headings.settings, exact: true })).toBeVisible();

  expect(failedAssets).toEqual([]);
});

test('the worker is named for the build, replaces older caches, and its script is never cached', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(60_000);
  // Planted before the page's own scripts run, so long before the worker activates: a cache an older build
  // left behind, and one that belongs to something else on this origin.
  await context.addInitScript(async () => {
    for (const name of ['studentsbudget-older-build', 'someone-elses-cache']) {
      await (await caches.open(name)).put('/planted', new Response('planted'));
    }
  });

  await completeSetup(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const scriptUrl = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL);
  expect(scriptUrl).toMatch(/\/sw\.js\?v=.+/);
  const version = new URL(String(scriptUrl)).searchParams.get('v');

  // Exactly one cache of ours, named for that version: the older one was deleted, the stranger's was left.
  const names = await page.evaluate(() => caches.keys());
  expect(names.filter((name) => name.startsWith('studentsbudget-'))).toEqual([`studentsbudget-${version}`]);
  expect(names).toContain('someone-elses-cache');

  // The versioned URL the page registered, and the bare one, are both sent with no-cache.
  for (const url of [String(scriptUrl), '/sw.js']) {
    const response = await request.get(url);
    expect(response.ok(), url).toBe(true);
    expect(response.headers()['cache-control'], url).toBe('no-cache');
  }
});

test('the discount map opens offline after one online visit, from a cache of its own', async ({ page, context }) => {
  // The map loads MapLibre and a few hundred KB of tiles on first open, on a production build.
  test.setTimeout(60_000);
  test.skip(
    !(await page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null)),
    'MapLibre needs WebGL 2',
  );
  // Tips opens on Discounts, shown as the map (the e2e build has NEXT_PUBLIC_DISCOUNT_MAP).
  await context.addInitScript(() => {
    localStorage.setItem('studentsbudget-tips-tab', 'discounts');
    localStorage.setItem('studentsbudget-discounts-view', 'map');
  });
  await page.goto('/tips');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // Loaded again under the worker, so the map's files go through it.
  await page.reload();
  const map = page.getByRole('region', { name: 'Map of the discounts in Regensburg', exact: true });
  await expect(map).toHaveAttribute('data-map-ready', '', { timeout: 20_000 });

  // The worker saw the tiles, which MapLibre fetches from its own worker, and keeps them apart from the build's cache.
  const kept = await page.evaluate(async () => {
    const name = (await caches.keys()).find((key) => key.startsWith('studentsbudget-map-'));
    if (name === undefined) return null;
    const paths = (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname);
    return { name, tiles: paths.filter((path) => path.includes('/tiles/')).length, vendor: paths.some((path) => path.startsWith('/maps/vendor/')) };
  });
  expect(kept?.name).toMatch(/^studentsbudget-map-\d+$/);
  expect(kept?.vendor).toBe(true);
  expect(kept?.tiles).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await expect(map).toHaveAttribute('data-map-ready', '', { timeout: 20_000 });
});
