import { expect, test, type Page, type Request } from '@playwright/test';
import { PRIVACY_NOTES } from '../src/features/privacy/notes';
import { acceptPrivacyNotes } from './helpers/privacy';
import {
  e2eUserIdOf,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type FeedRow,
  type ServerProfiles,
} from './helpers/supabase';

// Posting and deleting a hack (chunk 5; docs/superpowers/plans/2026-11-05-hacks-feed.md). Supabase is mocked: `feed`
// is the list `hacks_feed` answers, and posting and deleting change it.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
const BODY = 'The RVV semester ticket also covers the night buses at the weekend.';

const named = (): ServerProfiles => new Map([[e2eUserIdOf(EMAIL), { username: 'roshan', label: 'student', batch: 2027 }]]);

async function signInAndOpenHacks(page: Page) {
  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await page.goto('/tips');
  await page.getByRole('tablist', { name: 'Tips, discounts, hacks or checklist', exact: true }).getByRole('tab', { name: 'Hacks', exact: true }).click();
}

/** The Hacks panel: the other tabs stay mounted, so everything is looked for inside it. */
function panel(page: Page) {
  return page.getByRole('tabpanel', { name: 'Hacks', exact: true });
}

function form(page: Page) {
  return panel(page).getByRole('region', { name: 'Post a hack', exact: true });
}

function posts(page: Page) {
  return panel(page).getByRole('list', { name: 'Posts', exact: true }).getByRole('listitem');
}

/** Every `post_hack` call's arguments, as they are sent. */
function postCalls(page: Page): unknown[] {
  const calls: unknown[] = [];
  page.on('request', (request: Request) => {
    if (request.url().includes('/rest/v1/rpc/post_hack')) calls.push(request.postDataJSON());
  });
  return calls;
}

test('a first post is checked, waits for its note, and shows as one’s own', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { profiles: named() });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const calls = postCalls(page);
  await signInAndOpenHacks(page);
  await panel(page).getByRole('button', { name: 'Post a hack', exact: true }).click();

  // Checked on the phone first: nothing is sent.
  await form(page).getByRole('textbox', { name: 'Your hack', exact: true }).fill('Too short');
  await form(page).getByRole('button', { name: 'Post', exact: true }).click();
  await expect(form(page).getByRole('alert')).toHaveText('Write at least 10 characters.');
  await form(page).getByRole('textbox', { name: 'Your hack', exact: true }).fill(BODY);
  await form(page).getByRole('textbox', { name: 'Link (optional)', exact: true }).fill('http://www.rvv.de');
  await form(page).getByRole('button', { name: 'Post', exact: true }).click();
  await expect(form(page).getByRole('alert')).toHaveText('Give a link that starts with https://, or leave it empty.');
  await form(page).getByRole('textbox', { name: 'Link (optional)', exact: true }).fill('https://www.rvv.de/semesterticket');
  await form(page).getByRole('combobox', { name: 'Category', exact: true }).selectOption({ label: 'Transport' });
  await form(page).getByRole('combobox', { name: 'Where', exact: true }).selectOption({ label: 'Anywhere' });

  // The first post on this phone says who will see it; Cancel sends nothing.
  await form(page).getByRole('button', { name: 'Post', exact: true }).click();
  const note = form(page).getByRole('group', { name: 'About your data', exact: true });
  await expect(note).toContainText('Every student with an account can read your post');
  await note.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(calls).toHaveLength(0);

  await form(page).getByRole('button', { name: 'Post', exact: true }).click();
  await note.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Posted.');
  expect(calls).toEqual([
    { p_body: BODY, p_city: 'anywhere', p_category: 'transport', p_link: 'https://www.rvv.de/semesterticket', p_lang: 'en' },
  ]);
  expect(await page.evaluate((key) => localStorage.getItem(key), PRIVACY_NOTES.post)).toBe('seen');

  const mine = posts(page).filter({ hasText: BODY });
  await expect(mine).toContainText("@roshan · Student · Batch '27 · Your post");
  await expect(mine.getByRole('link', { name: 'www.rvv.de', exact: true })).toBeVisible();
  await expect(form(page)).toHaveCount(0);
});

test('an account without a name picks one before its first post', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await acceptPrivacyNotes(page);
  const profiles: ServerProfiles = new Map();
  await mockSupabaseData(page, { profiles });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signInAndOpenHacks(page);
  await panel(page).getByRole('button', { name: 'Post a hack', exact: true }).click();
  await form(page).getByRole('textbox', { name: 'Your hack', exact: true }).fill(BODY);
  await form(page).getByRole('button', { name: 'Post', exact: true }).click();

  await expect(form(page).getByRole('alert')).toHaveText('First pick the name your posts go by.');
  await form(page).getByRole('textbox', { name: 'Username', exact: true }).fill('roshan');
  await form(page).getByRole('button', { name: 'Post', exact: true }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Posted.');
  expect(profiles.get(e2eUserIdOf(EMAIL))).toEqual({ username: 'roshan', label: 'student', batch: null });
  await expect(posts(page).filter({ hasText: BODY })).toContainText('@roshan · Student · Your post');
});

test('a sixth post in a day is refused, and says when to post again', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await acceptPrivacyNotes(page);
  await mockSupabaseData(page, { profiles: named(), dailyLimit: true });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signInAndOpenHacks(page);
  await panel(page).getByRole('button', { name: 'Post a hack', exact: true }).click();
  await form(page).getByRole('textbox', { name: 'Your hack', exact: true }).fill(BODY);
  await form(page).getByRole('button', { name: 'Post', exact: true }).click();
  await expect(form(page).getByRole('alert')).toHaveText("You've posted 5 hacks in a day. Post again tomorrow.");
});

test('one’s own post can be deleted, after a question; others’ cannot', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const row = (id: string, body: string, mine: boolean): FeedRow => ({
    id,
    body,
    city: 'regensburg',
    category: 'food',
    link: null,
    lang: 'en',
    created_at: '2026-11-05T12:00:00Z',
    username: mine ? 'roshan' : 'bea',
    label: null,
    batch: null,
    mine,
    ups: 0,
    worked: 0,
    outdated: 0,
    my_up: false,
    my_verdict: null,
  });
  const feed = [row('p1', 'My own hack about the Mensa salad bar.', true), row('p2', 'Bea’s hack about bread after 6 pm.', false)];
  await mockSupabaseData(page, { profiles: named(), feed });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signInAndOpenHacks(page);

  await expect(posts(page).filter({ hasText: 'Bea’s hack' }).getByRole('button', { name: /^Delete/ })).toHaveCount(0);
  const mine = posts(page).filter({ hasText: 'My own hack' });
  // Delete says which post (accessibility, chunk 8).
  const deleteMine = mine.getByRole('button', { name: /^Delete: your post, \d{2}\.\d{2}\.\d{4}$/ });
  await deleteMine.click();
  await expect(mine).toContainText('Delete this post? Nobody will see it anymore.');
  await mine.getByRole('button', { name: 'Keep it', exact: true }).click();
  await expect(posts(page)).toHaveCount(2);

  await deleteMine.click();
  await mine.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Post deleted.');
  await expect(posts(page)).toHaveCount(1);
  expect(feed.map((post) => post.id)).toEqual(['p2']);
});
