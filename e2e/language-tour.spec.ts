import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_LANGUAGE, LANGUAGES, OFFERED } from '../src/i18n/languages';
import { MESSAGES, type Messages } from '../src/i18n/messages';
import { chooseLanguage, tourLanguages } from './helpers/languages';
import { horizontalOverflow } from './helpers/layout';
import { completeSetup } from './helpers/setup';

// Every page at 375 px in each offered language besides English, when the run asks for every language
// (E2E_LANGUAGES=all, e2e/helpers/languages.ts): the page is in that language, and nothing is wider than the phone.
// A language with long words fails here first.
test.use({ viewport: { width: 375, height: 812 } });

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 2, name, exact: true });

/** Each page after setup, and what shows it is drawn in the language: its heading, or Home's first region. */
const PAGES: { path: string; shown: (page: Page, t: Messages) => Locator }[] = [
  { path: '/', shown: (page, t) => page.getByRole('region', { name: t.home.leftThisMonth.heading, exact: true }) },
  { path: '/entries', shown: (page, t) => heading(page, t.shell.headings.entries) },
  { path: '/entries/new', shown: (page, t) => heading(page, t.shell.headings.newEntry) },
  { path: '/charts', shown: (page, t) => heading(page, t.shell.headings.charts) },
  { path: '/tips', shown: (page, t) => heading(page, t.shell.headings.tips) },
  { path: '/badges', shown: (page, t) => heading(page, t.shell.headings.badges) },
  { path: '/check-in', shown: (page, t) => heading(page, t.shell.headings.checkIn) },
  { path: '/reveal', shown: (page, t) => heading(page, t.shell.headings.reveal) },
  { path: '/settings', shown: (page, t) => heading(page, t.shell.headings.settings) },
  { path: '/settings/account', shown: (page, t) => heading(page, t.shell.headings.account) },
];

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
