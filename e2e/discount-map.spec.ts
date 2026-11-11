import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers/app';

// The discount map (docs/superpowers/plans/2026-11-11-discount-map.md; chunk 1, the bare map): Tips → Discounts shows a
// List/Map switch in a build with NEXT_PUBLIC_DISCOUNT_MAP (the e2e build has it), and the map draws the shipped
// Regensburg set without asking anyone outside the app. MapLibre needs WebGL 2: where the browser has none, the page
// says the list has every discount. Offline, see offline.spec.ts.

test.use({ viewport: { width: 375, height: 812 } });

async function openDiscounts(page: Page) {
  await openApp(page, '/tips');
  const tab = page.getByRole('tablist', { name: 'Tips, discounts, hacks or checklist', exact: true }).getByRole('tab', { name: 'Discounts', exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

function switchTo(page: Page, name: 'List' | 'Map') {
  return page.getByRole('group', { name: 'Show discounts as', exact: true }).getByRole('button', { name, exact: true }).click();
}

test('the map draws Regensburg from the app’s own files, and the switch is remembered', async ({ page }, testInfo) => {
  const webgl2 = await page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null);
  testInfo.annotations.push({ type: 'webgl2', description: String(webgl2) });
  test.skip(!webgl2, 'MapLibre needs WebGL 2');

  // Everything the page asks for while the map loads: none of it may leave the app's origin.
  const outside: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (url.origin !== new URL(page.url() || testInfo.project.use.baseURL || 'http://localhost').origin) outside.push(request.url());
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
