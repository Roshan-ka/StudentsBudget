import type { Page } from '@playwright/test';

/** How many pixels the page is wider than the window: 0 when nothing scrolls sideways (the app's 375 px rule). */
export function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
