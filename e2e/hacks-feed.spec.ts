import { expect, test, type Page } from '@playwright/test';
import { FEED_CACHE_KEY } from '../src/features/hacks/feed';
import { formatDate, todayIso } from '../src/lib/dates';
import { mockSupabaseAuth, mockSupabaseData, signOut, skipUnlessAccountsShow, type FeedRow } from './helpers/supabase';

// Reading the hacks feed (chunk 4; docs/superpowers/plans/2026-11-05-hacks-feed.md): Tips → Hacks lists students'
// posts for signed-in accounts, and falls back on the list this phone last loaded. Supabase is mocked: `feed` is what
// `hacks_feed` answers.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

const POSTS: FeedRow[] = [
  {
    id: 'p1',
    body: 'Bread is half price after 6 pm at the bakery by the Dom.',
    city: 'regensburg',
    category: 'food',
    link: 'https://www.example.de/bakery',
    lang: 'en',
    created_at: '2026-11-05T12:00:00Z',
    username: 'bea',
    label: 'graduate',
    batch: 2025,
    mine: false,
    ups: 3,
    worked: 2,
    outdated: 1,
    my_up: false,
    my_verdict: null,
  },
  {
    id: 'p2',
    body: 'Das Semesterticket gilt auch am Wochenende im ganzen RVV-Gebiet.',
    city: 'anywhere',
    category: 'transport',
    link: null,
    lang: 'de',
    created_at: '2026-11-04T12:00:00Z',
    username: 'roshan',
    label: 'student',
    batch: 2027,
    mine: true,
    ups: 0,
    worked: 0,
    outdated: 0,
    my_up: false,
    my_verdict: null,
  },
];

/** How a post's day reads, as the app writes it. */
const dayOf = (createdAt: string) => formatDate(todayIso(new Date(createdAt)));

async function signIn(page: Page) {
  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
}

function tab(page: Page, name = 'Hacks', tablist = 'Tips, discounts or hacks') {
  return page.getByRole('tablist', { name: tablist, exact: true }).getByRole('tab', { name, exact: true });
}

async function openHacks(page: Page) {
  await page.goto('/tips');
  await tab(page).click();
  await expect(tab(page)).toHaveAttribute('aria-selected', 'true');
}

function posts(page: Page, name = 'Posts') {
  return page.getByRole('list', { name, exact: true }).getByRole('listitem');
}

test('signed out, the Hacks tab asks for an account', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page);
  await openHacks(page);
  await expect(page.getByText('Sign in to read and post students’ hacks.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to Your account', exact: true })).toHaveAttribute('href', '/settings/account');
});

test('signed in, students’ posts show with who wrote them, and filter by category', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { feed: POSTS });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await openHacks(page);

  await expect(posts(page)).toHaveCount(2);
  const bread = posts(page).filter({ hasText: 'Bread is half price' });
  await expect(bread).toContainText(`Regensburg · ${dayOf(POSTS[0].created_at)}`);
  await expect(bread).toContainText("@bea · Graduate · Batch '25");
  await expect(bread).toContainText('Upvotes: 3 · Worked: 2 · Outdated: 1');
  await expect(bread.getByRole('link', { name: 'www.example.de', exact: true })).toHaveAttribute('target', '_blank');

  // The author's own post, in the language it was written in.
  const ticket = posts(page).filter({ hasText: 'Semesterticket' });
  await expect(ticket).toContainText(`Anywhere · ${dayOf(POSTS[1].created_at)}`);
  await expect(ticket).toContainText("@roshan · Student · Batch '27 · Your post");
  await expect(ticket.locator('p[lang="de"]')).toHaveText(POSTS[1].body);

  await page.getByRole('group', { name: 'Show posts for', exact: true }).getByRole('button', { name: 'Transport', exact: true }).click();
  await expect(posts(page)).toHaveCount(1);
  await expect(posts(page)).toContainText('Semesterticket');

  // The phone remembers the tab.
  await page.reload();
  await expect(tab(page)).toHaveAttribute('aria-selected', 'true');
});

test('when the posts can’t be loaded, the last list shows, and signing out forgets it', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { feed: POSTS });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await openHacks(page);
  await expect(posts(page)).toHaveCount(2);

  // The account server can't be reached: a route added later wins over the mock.
  await page.route('**/rest/v1/rpc/hacks_feed', (route) => route.abort('connectionfailed'));
  await page.reload();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    "The posts couldn't be loaded. Check your connection and try again.",
  );
  await expect(page.getByText(/^Shown as last loaded, /)).toBeVisible();
  await expect(posts(page)).toHaveCount(2);

  await page.goto('/settings/account');
  await signOut(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), FEED_CACHE_KEY)).toBeNull();
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('the tab and a post’s author speak German', async ({ page }) => {
    await skipUnlessAccountsShow(page);
    await mockSupabaseData(page, { feed: POSTS });
    await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
    await page.goto('/settings/account');
    await page.getByRole('textbox', { name: 'E-Mail', exact: true }).fill(EMAIL);
    await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.getByText(`Angemeldet als ${EMAIL}.`, { exact: true })).toBeVisible();

    await page.goto('/tips');
    await tab(page, 'Hacks', 'Tipps, Rabatte oder Hacks').click();
    const bread = posts(page, 'Beiträge').filter({ hasText: 'Bread is half price' });
    await expect(bread).toContainText('@bea · Mit Abschluss · Jahrgang 2025');
    await expect(bread).toContainText('Daumen hoch: 3 · Hat geklappt: 2 · Veraltet: 1');
  });
});
