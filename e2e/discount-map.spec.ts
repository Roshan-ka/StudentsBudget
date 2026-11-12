import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DISCOUNTS } from '../src/data/discounts';
import { THEME_STORAGE_KEY, type Theme } from '../src/theme/themes';
import { openApp } from './helpers/app';

// The discount map (docs/superpowers/plans/2026-11-11-discount-map.md; chunk 1, the bare map; chunk 4, the pins and
// controls): Tips → Discounts shows a List/Map switch in a build with NEXT_PUBLIC_DISCOUNT_MAP (the e2e build has it),
// and the map draws the shipped Regensburg set without asking anyone outside the app. Every discount has a pin; pins
// close together on the screen join into a count pin, which zooms in on them. MapLibre needs WebGL 2: where the browser
// has none, the page says the list has every discount. Pins are found by role and name, never by canvas pixels.
// Offline, see offline.spec.ts.

test.use({ viewport: { width: 375, height: 812 } });

/** Whether this browser can draw the map; the specs that need it skip without, and say so. */
async function skipWithoutWebgl(page: Page, testInfo: { annotations: { type: string; description?: string }[] }) {
  const webgl2 = await page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null);
  testInfo.annotations.push({ type: 'webgl2', description: String(webgl2) });
  test.skip(!webgl2, 'MapLibre needs WebGL 2');
}

const mapRegion = (page: Page) => page.getByRole('region', { name: 'Map of the discounts in Regensburg', exact: true });

/** Every pin on the map: a discount's is named "Place: offer", a spot's or a count pin's starts with its count. */
const pinsOn = (map: Locator) => map.getByRole('button', { name: /: / });
/** The pins of one discount each. */
const singlePins = (map: Locator) => map.getByRole('button', { name: /^(?!\d+ discounts ).+: / });

/** How many discounts the pins on the screen hold together. */
async function held(map: Locator): Promise<number> {
  const names = await pinsOn(map).evaluateAll((pins) => pins.map((pin) => pin.getAttribute('aria-label') ?? ''));
  return names.reduce((sum, name) => sum + Number(/^(\d+) discounts (?:here|close together): /.exec(name)?.[1] ?? 1), 0);
}

const pinNames = (pins: Locator) => pins.evaluateAll((all) => all.map((pin) => pin.getAttribute('aria-label') ?? ''));

async function openMap(page: Page): Promise<Locator> {
  await openDiscounts(page);
  await switchTo(page, 'Map');
  const map = mapRegion(page);
  await expect(map).toHaveAttribute('data-map-ready', '', { timeout: 15_000 });
  return map;
}

async function openDiscounts(page: Page) {
  await openApp(page, '/tips');
  const tab = page.getByRole('tablist', { name: 'Tips, discounts, hacks or checklist', exact: true }).getByRole('tab', { name: 'Discounts', exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

function switchTo(page: Page, name: 'List' | 'Map') {
  return page.getByRole('group', { name: 'Show discounts as', exact: true }).getByRole('button', { name, exact: true }).click();
}

test('the map draws Regensburg from the app’s own files, and the switch is remembered', async ({ page, baseURL }, testInfo) => {
  const webgl2 = await page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null);
  testInfo.annotations.push({ type: 'webgl2', description: String(webgl2) });
  test.skip(!webgl2, 'MapLibre needs WebGL 2');

  // Everything the page asks for while the map loads: none of it may leave the app's origin. Measured against the
  // configured origin, not the page's: the first request leaves about:blank.
  const origin = new URL(String(baseURL)).origin;
  const outside: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) outside.push(request.url());
  });

  await openDiscounts(page);
  await switchTo(page, 'Map');
  const map = page.getByRole('region', { name: 'Map of the discounts in Regensburg', exact: true });
  await expect(map).toHaveAttribute('data-map-ready', '', { timeout: 15_000 });
  await expect(page.getByRole('list', { name: 'Discounts', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '© OpenStreetMap contributors', exact: true })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  expect(outside).toEqual([]);

  // Remembered on this phone: a new visit opens on the map.
  await page.reload();
  await openDiscounts(page);
  await expect(map).toHaveAttribute('data-map-ready', '', { timeout: 15_000 });
  await switchTo(page, 'List');
  await expect(page.getByRole('list', { name: 'Discounts', exact: true })).toBeVisible();
  await expect(map).toHaveCount(0);
});

test('without WebGL 2 the map says the list has every discount', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (kind === 'webgl2') return null;
      return (original as (this: HTMLCanvasElement, ...args: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await openDiscounts(page);
  await switchTo(page, 'Map');
  await expect(page.getByText("The map can't show on this phone. The list has every discount.", { exact: true })).toBeVisible();
});

test.describe('pins', () => {
  // MapLibre skips its animations under reduced motion, so each zoom has settled by the next step.
  test.use({ reducedMotion: 'reduce' });

  test('every discount is on the opened map, and a count pin zooms in on its discounts', async ({ page }, testInfo) => {
    await skipWithoutWebgl(page, testInfo);
    const map = await openMap(page);
    await expect.poll(() => held(map)).toBe(DISCOUNTS.length);

    // In the old town the pins sit close together: they join into count pins.
    const count = map.getByRole('button', { name: /^\d+ discounts close together: zoom in$/ }).first();
    await expect(count).toBeVisible();
    const before = await pinNames(singlePins(map));
    await count.press('Enter');
    // Its discounts part into pins of their own, and the focus waits on the map, from where Tab reaches them.
    await expect.poll(async () => (await pinNames(singlePins(map))).some((name) => !before.includes(name))).toBe(true);
    await expect(map.getByRole('region', { name: 'Map', exact: true })).toBeFocused();

    await map.getByRole('button', { name: 'Show all discounts', exact: true }).click();
    await expect.poll(() => held(map)).toBe(DISCOUNTS.length);
  });

  test('a pin is chosen and let go, a category chip filters the pins, and the map keeps its place', async ({ page }, testInfo) => {
    await skipWithoutWebgl(page, testInfo);
    const map = await openMap(page);

    const westbad = map.getByRole('button', { name: /^Westbad: / });
    await westbad.press('Enter');
    await expect(westbad).toHaveAttribute('aria-pressed', 'true');
    await expect(westbad).toBeFocused();
    await westbad.press('Enter');
    await expect(westbad).toHaveAttribute('aria-pressed', 'false');

    // The chips sit on the map, and filter it as they filter the list.
    const chips = map.getByRole('group', { name: 'Show discounts for', exact: true });
    await chips.getByRole('button', { name: 'Food & groceries', exact: true }).click();
    await expect(map.getByRole('button', { name: /^Alnatura Super Natur Markt: / })).toBeVisible();
    await expect.poll(() => held(map)).toBe(1);
    await chips.getByRole('button', { name: 'All', exact: true }).click();
    await expect.poll(() => held(map)).toBe(DISCOUNTS.length);

    // Two steps in, not every discount fits any more; the list and back opens the map where it was.
    const zoomIn = map.getByRole('button', { name: 'Zoom in', exact: true });
    await zoomIn.click();
    await zoomIn.click();
    await expect.poll(() => held(map)).toBeLessThan(DISCOUNTS.length);
    const closer = await held(map);
    await switchTo(page, 'List');
    await switchTo(page, 'Map');
    await expect(map).toHaveAttribute('data-map-ready', '', { timeout: 15_000 });
    await expect.poll(() => held(map)).toBe(closer);

    // Two steps out, and every discount is back.
    const zoomOut = map.getByRole('button', { name: 'Zoom out', exact: true });
    await zoomOut.click();
    await zoomOut.click();
    await expect.poll(() => held(map)).toBe(DISCOUNTS.length);
  });
});

/** The theme as Settings → Appearance stores it, before the first paint. */
async function useTheme(page: Page, theme: Theme) {
  await page.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Storage the test can't write leaves the page light, and the light run covers that.
      }
    },
    [THEME_STORAGE_KEY, theme] as const,
  );
}

// axe.spec sees each page as it opens, with the list: the map, its pins and its controls get their own run here, in
// light and in dark, against the same WCAG A and AA rules, failing on a serious or critical finding.
for (const theme of ['light', 'dark'] as const) {
  test(`axe finds nothing serious on the map, ${theme}`, async ({ page }, testInfo) => {
    await skipWithoutWebgl(page, testInfo);
    await useTheme(page, theme);
    const map = await openMap(page);
    await expect.poll(() => held(map)).toBe(DISCOUNTS.length);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations
      .filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
      .map((violation) => `${violation.id}: ${violation.help} at ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(', ')}`);
    expect(serious).toEqual([]);
  });
}
