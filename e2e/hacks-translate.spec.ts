import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { PRIVACY_NOTES } from '../src/features/privacy/notes';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow, type FeedRow } from './helpers/supabase';

// The Translate link on a hack (chunk 8; docs/superpowers/plans/2026-11-05-hacks-feed.md): a post in another language
// than the phone's opens Google Translate in a new tab, after a data-protection note the first time. Google is
// answered here, so nothing leaves the test.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
const GERMAN = 'Das Semesterticket gilt auch am Wochenende im ganzen RVV-Gebiet.';
const ENGLISH = 'Bread is half price after 6 pm at the bakery by the Dom.';

function row(id: string, body: string, lang: string): FeedRow {
  return {
    id,
    body,
    city: 'regensburg',
    category: 'food',
    link: null,
    lang,
    created_at: '2026-11-05T12:00:00Z',
    username: 'bea',
    label: null,
    batch: null,
    mine: false,
    ups: 0,
    worked: 0,
    outdated: 0,
    my_up: false,
    my_verdict: null,
  };
}

async function answerGoogle(context: BrowserContext) {
  await context.route('https://translate.google.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Translated</p>' }),
  );
}

async function signIn(page: Page, words = { email: 'Email', password: 'Password', signIn: 'Sign in' }) {
  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: words.email, exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel(words.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: words.signIn, exact: true }).click();
}

function post(page: Page, text: string, list = 'Posts') {
  return page.getByRole('list', { name: list, exact: true }).getByRole('listitem').filter({ hasText: text });
}

test('a post in another language opens Google Translate, after its note the first time', async ({ page, context }) => {
  await skipUnlessAccountsShow(page);
  await answerGoogle(context);
  await mockSupabaseData(page, { feed: [row('p1', GERMAN, 'de'), row('p2', ENGLISH, 'en')] });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await page.goto('/tips');
  await page.getByRole('tablist', { name: 'Tips, discounts, hacks or checklist', exact: true }).getByRole('tab', { name: 'Hacks', exact: true }).click();

  // A post in the phone's own language has none.
  await expect(post(page, ENGLISH).getByRole('link', { name: /^Translate/ })).toHaveCount(0);

  const german = post(page, 'Semesterticket');
  // Translate says which post (accessibility, chunk 8): "Translate: the post by @lena, 05.11.2026".
  const translate = german.getByRole('link', { name: /^Translate: (the post by @\w+, |a post from )\d{2}\.\d{2}\.\d{4}$/ });
  await translate.click();
  const note = german.getByRole('group', { name: 'About your data', exact: true });
  await expect(note).toContainText('Google gets the text and your phone’s internet address.');
  await note.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(context.pages()).toHaveLength(1);

  await translate.click();
  const opened = page.waitForEvent('popup');
  await note.getByRole('button', { name: 'Continue', exact: true }).click();
  const tab = new URL((await opened).url());
  expect(tab.origin).toBe('https://translate.google.com');
  expect(Object.fromEntries(tab.searchParams)).toEqual({ sl: 'auto', tl: 'en', text: GERMAN, op: 'translate' });
  expect(await page.evaluate((key) => localStorage.getItem(key), PRIVACY_NOTES.translate)).toBe('seen');

  // From then on the link opens straight away.
  const again = page.waitForEvent('popup');
  await translate.click();
  expect(new URL((await again).url()).searchParams.get('tl')).toBe('en');
  await expect(note).toHaveCount(0);
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('an English post offers a translation into German', async ({ page, context }) => {
    await skipUnlessAccountsShow(page);
    await answerGoogle(context);
    await page.addInitScript((key) => localStorage.setItem(key, 'seen'), PRIVACY_NOTES.translate);
    await mockSupabaseData(page, { feed: [row('p1', GERMAN, 'de'), row('p2', ENGLISH, 'en')] });
    await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
    await signIn(page, { email: 'E-Mail', password: 'Passwort', signIn: 'Anmelden' });
    await expect(page.getByText(`Angemeldet als ${EMAIL}.`, { exact: true })).toBeVisible();
    await page.goto('/tips');
    await page.getByRole('tablist', { name: 'Tipps, Rabatte, Hacks oder Checkliste', exact: true }).getByRole('tab', { name: 'Hacks', exact: true }).click();

    await expect(post(page, 'Semesterticket', 'Beiträge').getByRole('link', { name: /^Übersetzen/ })).toHaveCount(0);
    const opened = page.waitForEvent('popup');
    await post(page, 'Bread is half price', 'Beiträge').getByRole('link', { name: /^Übersetzen: / }).click();
    expect(new URL((await opened).url()).searchParams.get('tl')).toBe('de');
  });
});
