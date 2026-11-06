import { expect, test, type Page, type Request } from '@playwright/test';
import { PRIVACY_NOTES } from '../src/features/privacy/notes';
import { acceptPrivacyNotes } from './helpers/privacy';
import { e2eUserIdOf, mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow, type FeedRow } from './helpers/supabase';

// Voting on and reporting hacks (chunk 6; docs/superpowers/plans/2026-11-05-hacks-feed.md). Supabase is mocked: `feed`
// is what `hacks_feed` answers, and votes and reports change it.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

function row(id: string, body: string, mine: boolean): FeedRow {
  return {
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
    ups: 3,
    worked: 2,
    outdated: 1,
    my_up: false,
    my_verdict: null,
  };
}

async function signInAndOpenHacks(page: Page) {
  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await page.goto('/tips');
  await page.getByRole('tablist', { name: 'Tips, discounts or hacks', exact: true }).getByRole('tab', { name: 'Hacks', exact: true }).click();
}

function panel(page: Page) {
  return page.getByRole('tabpanel', { name: 'Hacks', exact: true });
}

function post(page: Page, text: string) {
  return panel(page).getByRole('list', { name: 'Posts', exact: true }).getByRole('listitem').filter({ hasText: text });
}

/** Every call to `fn`, by its arguments. */
function callsTo(page: Page, fn: string): unknown[] {
  const calls: unknown[] = [];
  page.on('request', (request: Request) => {
    if (request.url().includes(`/rest/v1/rpc/${fn}`)) calls.push(request.postDataJSON());
  });
  return calls;
}

test('the first vote waits for its note; then each button toggles and the totals follow', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, {
    profiles: new Map([[e2eUserIdOf(EMAIL), { username: 'roshan', label: null, batch: null }]]),
    feed: [row('p1', 'Bread is half price after 6 pm.', false), row('p2', 'My own hack about the Mensa.', true)],
  });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const votes = callsTo(page, 'vote_hack');
  await signInAndOpenHacks(page);

  // One's own post has no vote or report buttons.
  await expect(post(page, 'My own hack').getByRole('group', { name: 'Your vote on this post', exact: true })).toHaveCount(0);

  const bread = post(page, 'Bread is half price');
  const buttons = bread.getByRole('group', { name: 'Your vote on this post', exact: true });
  await buttons.getByRole('button', { name: 'Upvote', exact: true }).click();
  const note = bread.getByRole('group', { name: 'About your data', exact: true });
  await expect(note).toContainText('nobody sees who voted');
  await note.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(votes).toHaveLength(0);

  await buttons.getByRole('button', { name: 'Upvote', exact: true }).click();
  await note.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(buttons.getByRole('button', { name: 'Upvote', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bread).toContainText('Upvotes: 4 · Worked: 2 · Outdated: 1');
  expect(await page.evaluate((key) => localStorage.getItem(key), PRIVACY_NOTES.hackVotes)).toBe('seen');

  // "Worked for me", then "Outdated" instead: one verdict at a time.
  await buttons.getByRole('button', { name: 'Worked for me', exact: true }).click();
  await expect(bread).toContainText('Upvotes: 4 · Worked: 3 · Outdated: 1');
  await buttons.getByRole('button', { name: 'Outdated', exact: true }).click();
  await expect(bread).toContainText('Upvotes: 4 · Worked: 2 · Outdated: 2');
  await expect(buttons.getByRole('button', { name: 'Worked for me', exact: true })).toHaveAttribute('aria-pressed', 'false');

  // Tapping the upvote again takes it back.
  await buttons.getByRole('button', { name: 'Upvote', exact: true }).click();
  await expect(bread).toContainText('Upvotes: 3 · Worked: 2 · Outdated: 2');
  expect(votes).toEqual([
    { p_id: 'p1', p_up: true, p_verdict: null },
    { p_id: 'p1', p_up: true, p_verdict: 'worked' },
    { p_id: 'p1', p_up: true, p_verdict: 'outdated' },
    { p_id: 'p1', p_up: false, p_verdict: 'outdated' },
  ]);
});

test('a report asks first, then the post leaves the list', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await acceptPrivacyNotes(page);
  await mockSupabaseData(page, { feed: [row('p1', 'An advert for a phone shop.', false), row('p2', 'Bread is half price.', false)] });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const reports = callsTo(page, 'report_hack');
  await signInAndOpenHacks(page);

  const advert = post(page, 'An advert');
  // Report says which post (accessibility, chunk 8).
  const report = advert.getByRole('button', { name: /^Report: (the post by @\w+|a post from) / });
  await report.click();
  await expect(advert).toContainText('Report this post? It disappears for you at once');
  await advert.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(reports).toHaveLength(0);

  await report.click();
  // The question's own Report button: the one among the vote buttons is named for its post.
  await advert.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Reported. You won’t see this post anymore.');
  await expect(post(page, 'An advert')).toHaveCount(0);
  await expect(post(page, 'Bread is half price')).toHaveCount(1);
  expect(reports).toEqual([{ p_id: 'p1' }]);
});
