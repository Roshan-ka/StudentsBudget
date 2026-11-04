import { expect, test, type Page } from '@playwright/test';
import { MESSAGES } from '../src/i18n/messages';
import { horizontalOverflow } from './helpers/layout';
import { heading, PAGES } from './helpers/pages';
import { completeSetup } from './helpers/setup';

// WCAG 2.2 in English (redesign plan, chunk 3): Reflow (1.4.10), every page at 320 px, and Resize Text (1.4.4), every
// page at 375 px with text at 200 %. The app sizes in rem, so doubling the root font size doubles all of it. Nothing
// may be wider than the phone, and the bottom navigation stays whole on screen. The language tour does the same at
// 375 px in every other language.
const t = MESSAGES.en;
const LARGE_TEXT = 'html { font-size: 200% !important; }';

async function tour(page: Page, largeText: boolean) {
  const enlarge = async () => {
    if (largeText) await page.addStyleTag({ content: LARGE_TEXT });
  };

  // Setup first, before a plan exists.
  await page.goto('/setup');
  await enlarge();
  await expect(heading(page, t.setup.headingNew)).toBeVisible();
  expect(await horizontalOverflow(page), '/setup').toBe(0);

  await completeSetup(page);
  for (const { path, shown } of PAGES) {
    await page.goto(path);
    await enlarge();
    await expect(shown(page, t), path).toBeVisible();
    await expect(page.getByRole('navigation', { name: t.shell.navLabel, exact: true }), path).toBeInViewport({
      ratio: 1,
    });
    // What is shown above appears once the page has hydrated; what it reads from IndexedDB follows within moments.
    await page.waitForLoadState('networkidle');
    expect(await horizontalOverflow(page), path).toBe(0);
  }
}

test.describe('at 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('every page reflows, with nothing wider than the phone', async ({ page }) => {
    test.setTimeout(120_000);
    await tour(page, false);
  });
});

test.describe('at 375 px with text at 200 %', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('every page keeps its text inside the phone and the navigation on screen', async ({ page }) => {
    test.setTimeout(120_000);
    await tour(page, true);
  });
});
