import { expect, test } from '@playwright/test';
import { DEFAULT_LANGUAGE, LANGUAGES, OFFERED } from '../src/i18n/languages';
import { MESSAGES } from '../src/i18n/messages';
import { chooseLanguage, tourLanguages } from './helpers/languages';
import { horizontalOverflow } from './helpers/layout';
import { heading, PAGES } from './helpers/pages';
import { completeSetup } from './helpers/setup';

// Every page at 375 px in each offered language besides English, when the run asks for every language
// (E2E_LANGUAGES=all, e2e/helpers/languages.ts): the page is in that language, and nothing is wider than the phone.
// A language with long words fails here first.
test.use({ viewport: { width: 375, height: 812 } });

for (const code of OFFERED.filter((offered) => offered !== DEFAULT_LANGUAGE)) {
  test(`every page fits 375 px in ${LANGUAGES[code].name}`, async ({ page }) => {
    test.skip(!tourLanguages().includes(code), 'Runs when E2E_LANGUAGES=all');
    test.setTimeout(120_000);
    const t = MESSAGES[code];

    // Setup first, before a plan exists. The specs' wizard helper speaks English, so the plan is made in English.
    await page.goto('/setup');
    await chooseLanguage(page, code);
    await expect(page.locator('html')).toHaveAttribute('lang', code);
    await expect(heading(page, t.setup.headingNew)).toBeVisible();
    expect(await horizontalOverflow(page), '/setup').toBe(0);

    await chooseLanguage(page, 'en');
    await completeSetup(page);
    await chooseLanguage(page, code);

    for (const { path, shown } of PAGES) {
      await page.goto(path);
      await expect(page.locator('html'), path).toHaveAttribute('lang', code);
      await expect(shown(page, t), path).toBeVisible();
      await expect(page.getByRole('navigation', { name: t.shell.navLabel, exact: true }), path).toBeVisible();
      // What is shown above appears once the page has hydrated; what it reads from IndexedDB follows within moments.
      await page.waitForLoadState('networkidle');
      expect(await horizontalOverflow(page), path).toBe(0);
    }
  });
}
