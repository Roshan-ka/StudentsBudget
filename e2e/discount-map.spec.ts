import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DISCOUNTS } from '../src/data/discounts';
import { distanceMeters, formatDistance } from '../src/features/discounts/map/distance';
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
    // The card takes the focus (its own tests below follow it); Enter on the pin again lets it go.
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

// The card at the bottom (chunk 5): a tap on a pin opens it on its heading; Close, Escape or a second tap close it,
// with the focus back on the pin; "Show in the list" lands on the discount in the list.
test.describe('the card', () => {
  test.use({ reducedMotion: 'reduce' });

  const WESTBAD_OFFER = '€4.60 instead of €7.20 for 3 hours; €6.50 instead of €10 for the day';

  test('a pin opens its card on its heading, and Escape, Close or the pin again close it', async ({ page }, testInfo) => {
    await skipWithoutWebgl(page, testInfo);
    const map = await openMap(page);
    const westbad = map.getByRole('button', { name: /^Westbad: / });
    const card = map.getByRole('region', { name: 'Westbad', exact: true });

    await westbad.click();
    await expect(card.getByRole('heading', { name: 'Westbad', level: 3, exact: true })).toBeFocused();
    await expect(card.getByText(WESTBAD_OFFER, { exact: true })).toBeVisible();
    await expect(card.getByText('Messerschmittstraße 4, 93049 Regensburg', { exact: true })).toBeVisible();
    await expect(card.getByText(/^Last confirmed \d{2}\.\d{2}\.\d{4}$/)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Show in the list', exact: true })).toBeVisible();
    await expect(westbad).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    await expect(westbad).toBeFocused();
    await expect(westbad).toHaveAttribute('aria-pressed', 'false');

    await westbad.press('Enter');
    await expect(card.getByRole('heading', { name: 'Westbad', level: 3, exact: true })).toBeFocused();
    await card.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(card).toHaveCount(0);
    await expect(westbad).toBeFocused();

    // A second tap on the chosen pin closes the card too, and the focus stays on the pin.
    await westbad.click();
    await expect(card).toBeVisible();
    await westbad.click();
    await expect(card).toHaveCount(0);
    await expect(westbad).toBeFocused();
  });

  test('"Show in the list" lands on the discount in the list', async ({ page }, testInfo) => {
    await skipWithoutWebgl(page, testInfo);
    const map = await openMap(page);
    await map.getByRole('button', { name: /^Westbad: / }).click();
    await map
      .getByRole('region', { name: 'Westbad', exact: true })
      .getByRole('button', { name: 'Show in the list', exact: true })
      .click();
    const list = page.getByRole('list', { name: 'Discounts', exact: true });
    await expect(list).toBeVisible();
    await expect(list.getByRole('heading', { name: 'Westbad', level: 3, exact: true })).toBeFocused();
    await expect(map).toHaveCount(0);
  });

  test('the discounts at one spot share a card, each with its own way to the list', async ({ page }, testInfo) => {
    await skipWithoutWebgl(page, testInfo);
    const map = await openMap(page);
    // Haidplatz 8 holds the Stadtbücherei and the VHS. In the old town it hides in a count pin at first: the biggest
    // count pin is pressed until its pin shows on its own. Its name lists the two in the list's order, freshest first,
    // which a re-check or a vote can change, so only its start is fixed here.
    const haidplatz = map.getByRole('button', { name: /^2 discounts here: / });
    const counts = map.getByRole('button', { name: /^\d+ discounts close together: zoom in$/ });
    // Three presses at 375 px (12-11-2026: a count of 10, then 5, then 3); six leave room.
    for (let step = 0; step < 6 && (await haidplatz.count()) === 0; step++) {
      const names = await pinNames(counts);
      if (names.length === 0) break;
      const biggest = names.reduce((best, name) => (parseInt(name, 10) > parseInt(best, 10) ? name : best));
      await map.getByRole('button', { name: biggest, exact: true }).first().press('Enter');
      await expect.poll(async () => (await pinNames(counts)).join('|')).not.toBe(names.join('|'));
    }
    await haidplatz.press('Enter');

    const card = map.getByRole('region', { name: /^2 discounts here: / });
    // The card opens on its first heading, and holds both.
    await expect(card.getByRole('heading', { level: 3 }).first()).toBeFocused();
    await expect(card.getByRole('heading', { name: 'Stadtbücherei Regensburg', level: 3, exact: true })).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Volkshochschule Regensburg', level: 3, exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Show in the list', exact: true })).toHaveCount(2);
    await expect(card.getByRole('button', { name: 'Close', exact: true })).toHaveCount(1);
  });
});

// Show me (chunk 6): the phone's position only on a tap, a dot and the map centred on it, and how far each discount is,
// on the card and in the list. Playwright plays the browser's position (`geolocation`); a refusal and a failure stand
// in for the browser's own answers.
test.describe('Show me', () => {
  test.use({ reducedMotion: 'reduce' });

  /** Near Haidplatz, in the old town. */
  const HERE = { latitude: 49.0195, longitude: 12.095 };

  /** "130 m away" for a discount, as the app works it out, whatever space the browser puts before the unit. */
  function away(id: string): RegExp {
    const location = DISCOUNTS.find((d) => d.id === id)?.location;
    if (location === undefined) throw new Error(`${id} has no position`);
    const text = `${formatDistance(distanceMeters({ lat: HERE.latitude, lng: HERE.longitude }, location), 'en-IE')} away`;
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s\u00a0\u202f]/g, '[\\s\\u00a0\\u202f]');
    return new RegExp(`^${escaped}$`);
  }

  test.describe('with the position allowed', () => {
    test.use({ permissions: ['geolocation'], geolocation: HERE });

    test('Show me centres the map on the phone, and the card and the list say how far', async ({ page }, testInfo) => {
      await skipWithoutWebgl(page, testInfo);
      const map = await openMap(page);
      await map.getByRole('button', { name: 'Show me', exact: true }).click();
      await expect(map.getByRole('button', { name: "You're here", exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(map.locator('[data-location-dot]')).toBeVisible();
      // Centred on the old town, a few streets around: Westbad, 3 km west, is off the screen.
      await expect(map.getByRole('button', { name: /^Westbad: / })).toHaveCount(0);

      // The Turmtheater, about 130 m away.
      await map.getByRole('button', { name: /^Regensburger Turmtheater: / }).click();
      const card = map.getByRole('region', { name: 'Regensburger Turmtheater', exact: true });
      await expect(card.getByText(away('regensburger-turmtheater'))).toBeVisible();

      // The list says it too, for every discount.
      await card.getByRole('button', { name: 'Show in the list', exact: true }).click();
      // Each in its own item: two discounts may lie the same distance away (Westbad and another at 3.0 km).
      const list = page.getByRole('list', { name: 'Discounts', exact: true });
      const item = (place: string) =>
        list.getByRole('listitem').filter({ has: page.getByRole('heading', { name: place, level: 3, exact: true }) });
      await expect(item('Westbad').getByText(away('westbad'))).toBeVisible();
      await expect(item('Regensburger Turmtheater').getByText(away('regensburger-turmtheater'))).toBeVisible();
    });
  });

  test.describe('outside Regensburg', () => {
    test.use({ permissions: ['geolocation'], geolocation: { latitude: 48.137, longitude: 11.575 } });

    test('the map stays on the city and says why', async ({ page }, testInfo) => {
      await skipWithoutWebgl(page, testInfo);
      const map = await openMap(page);
      await map.getByRole('button', { name: 'Show me', exact: true }).click();
      await expect(page.getByText("You're outside Regensburg, so the map stays on the city.", { exact: true })).toBeVisible();
      await expect(map.getByRole('button', { name: 'Show me', exact: true })).toHaveAttribute('aria-pressed', 'false');
      await expect(map.locator('[data-location-dot]')).toHaveCount(0);
      await expect.poll(() => held(map)).toBe(DISCOUNTS.length);
    });
  });

  test('a refusal and a position that can’t be found say so, and nothing is shown', async ({ page }, testInfo) => {
    await skipWithoutWebgl(page, testInfo);
    // The browser's answers to two taps: refused, then not found.
    await page.addInitScript(() => {
      const codes = [1, 2];
      navigator.geolocation.getCurrentPosition = (_found, failed) => {
        const code = codes.shift() ?? 2;
        failed?.({ code, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      };
    });
    const map = await openMap(page);
    const showMe = map.getByRole('button', { name: 'Show me', exact: true });
    await showMe.click();
    await expect(
      page.getByText("Location is turned off for this app. You can allow it in your browser's settings.", { exact: true }),
    ).toBeVisible();
    await showMe.click();
    await expect(page.getByText("Your location couldn't be found just now. Try again in a moment.", { exact: true })).toBeVisible();
    await expect(showMe).toHaveAttribute('aria-pressed', 'false');
    await expect(map.locator('[data-location-dot]')).toHaveCount(0);
  });

  test('without geolocation in the browser, Show me isn’t there', async ({ page }, testInfo) => {
    await skipWithoutWebgl(page, testInfo);
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'geolocation', { configurable: true, get: () => undefined });
    });
    const map = await openMap(page);
    await expect(map.getByRole('button', { name: 'Show all discounts', exact: true })).toBeVisible();
    await expect(map.getByRole('button', { name: 'Show me', exact: true })).toHaveCount(0);
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

// axe.spec sees each page as it opens, with the list: the map, its pins, its controls and its card get their own run
// here, in light and in dark, against the same WCAG A and AA rules, failing on a serious or critical finding.
for (const theme of ['light', 'dark'] as const) {
  test(`axe finds nothing serious on the map, ${theme}`, async ({ page }, testInfo) => {
    await skipWithoutWebgl(page, testInfo);
    await useTheme(page, theme);
    const map = await openMap(page);
    await expect.poll(() => held(map)).toBe(DISCOUNTS.length);
    // With a card open, so axe sees the chosen pin and the card too.
    await map.getByRole('button', { name: /^Westbad: / }).click();
    await expect(map.getByRole('region', { name: 'Westbad', exact: true })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations
      .filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
      .map((violation) => `${violation.id}: ${violation.help} at ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(', ')}`);
    expect(serious).toEqual([]);
  });
}
