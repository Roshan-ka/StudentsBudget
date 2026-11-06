import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { MESSAGES } from '../src/i18n/messages';
import { THEME_STORAGE_KEY, type Theme } from '../src/theme/themes';
import { heading, PAGES } from './helpers/pages';
import { completeSetup } from './helpers/setup';

// Accessibility, chunk 9 (docs/superpowers/plans/2026-11-05-accessibility.md): axe-core checks every page, setup
// included, in light and in dark, against the WCAG 2.0–2.2 A and AA rules it can judge on its own (contrast, names,
// labels, ARIA, lists, ids). A serious or critical finding fails the run. What it can't judge (where the focus goes,
// whether a name makes sense, what is read out) stays with the other specs and the try on the phone.
const t = MESSAGES.en;
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const BLOCKING = new Set(['serious', 'critical']);

/** The page's serious and critical findings, one line each: the rule, what it asks, and up to three elements. */
async function findings(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(RULES).analyze();
  return results.violations
    .filter((violation) => BLOCKING.has(violation.impact ?? ''))
    .map((violation) => {
      const where = violation.nodes.slice(0, 3).map((node) => node.target.join(' '));
      return `${violation.id} (${violation.impact}): ${violation.help} at ${where.join(', ')}`;
    });
}

for (const theme of ['light', 'dark'] as const satisfies readonly Theme[]) {
  test(`every page passes axe's WCAG AA checks in ${theme}`, async ({ page }) => {
    test.setTimeout(180_000);
    // The theme as Settings → Appearance stores it, before the first paint of every page.
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

    // Soft, so one run names every page with a finding, and what it is.
    await page.goto('/setup');
    await expect(heading(page, t.setup.headingNew)).toBeVisible();
    expect.soft(await findings(page), '/setup').toEqual([]);

    await completeSetup(page);
    for (const { path, shown } of PAGES) {
      await page.goto(path);
      await expect(shown(page, t), path).toBeVisible();
      // What is shown above appears once the page has hydrated; what it reads from IndexedDB follows within moments.
      await page.waitForLoadState('networkidle');
      expect.soft(await findings(page), path).toEqual([]);
    }
  });
}
