import { expect, test, type Page } from '@playwright/test';
import { formatDate, todayIso } from '../src/lib/dates';
import { acceptPrivacyNotes } from './helpers/privacy';
import {
  e2eUserIdOf,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type CommentRow,
  type FeedRow,
  type ServerProfiles,
} from './helpers/supabase';

// Comments on hacks (community, chunks 2 and 3; docs/superpowers/plans/2026-11-11-community.md): "Comments (n)" under
// each post opens them, oldest first, with a short form. Supabase is mocked: `feed` holds the posts, `comments` the
// comments, `profiles` the posting names. The Hacks tab keeps a status line of its own, so a comment's is found in its
// post's card.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

const BREAD: FeedRow = {
  id: 'p1',
  body: 'Bread is half price after 6 pm at the bakery by the Dom.',
  city: 'regensburg',
  category: 'food',
  link: null,
  lang: 'en',
  created_at: '2026-11-05T12:00:00Z',
  username: 'bea',
  label: 'graduate',
  batch: 2025,
  mine: false,
  ups: 0,
  worked: 0,
  outdated: 0,
  my_up: false,
  my_verdict: null,
};

const comment = (id: string, body: string, username: string, createdAt: string, mine = false): CommentRow => ({
  id,
  hack_id: 'p1',
  body,
  lang: 'en',
  created_at: createdAt,
  username,
  label: 'student',
  batch: null,
  mine,
});

const named = (): ServerProfiles => new Map([[e2eUserIdOf(EMAIL), { username: 'roshan', label: 'student', batch: 2027 }]]);

/** How a comment's day reads, as the app writes it. */
const dayOf = (createdAt: string) => formatDate(todayIso(new Date(createdAt)));

async function signIn(page: Page) {
  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
}

async function openHacks(page: Page, tablist = 'Tips, discounts, hacks or checklist', name = 'Hacks') {
  await page.goto('/tips');
  const tab = page.getByRole('tablist', { name: tablist, exact: true }).getByRole('tab', { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

/** The bread post's card. */
function bread(page: Page) {
  return page.getByRole('list', { name: 'Posts', exact: true }).getByRole('listitem').filter({ hasText: 'Bread is half price' }).first();
}

function commentItems(page: Page, name = 'Comments') {
  return bread(page).getByRole('list', { name, exact: true }).getByRole('listitem');
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('a post shows how many comments it has, opens them oldest first, and a new one joins them', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const comments = [
    comment('c1', 'Works on Saturdays too.', 'cem', '2026-11-06T09:00:00Z'),
    comment('c2', 'Only until it is sold out.', 'dana', '2026-11-07T09:00:00Z'),
  ];
  await mockSupabaseData(page, { feed: [BREAD], comments, profiles: named() });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await openHacks(page);

  const toggle = bread(page).getByRole('button', { name: 'Comments (2)', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(commentItems(page)).toHaveCount(2);
  await expect(commentItems(page).nth(0)).toContainText(`@cem · Student · ${dayOf(comments[0].created_at)}`);
  await expect(commentItems(page).nth(0)).toContainText('Works on Saturdays too.');
  await expect(commentItems(page).nth(1)).toContainText('Only until it is sold out.');

  // The first comment on the phone waits for the data-protection note.
  await bread(page).getByRole('textbox', { name: 'Your comment', exact: true }).fill('Thanks, it worked for me.');
  await bread(page).getByRole('button', { name: 'Post comment', exact: true }).click();
  const note = bread(page).getByRole('group', { name: 'About your data', exact: true });
  await expect(note).toContainText('Every student with an account can read what you post here');
  await note.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(bread(page).getByRole('status')).toHaveText('Comment posted.');
  await expect(commentItems(page)).toHaveCount(3);
  await expect(commentItems(page).nth(2)).toContainText('Thanks, it worked for me.');
  await expect(commentItems(page).nth(2)).toContainText('Your comment');
  await expect(bread(page).getByRole('button', { name: 'Comments (3)', exact: true })).toBeVisible();
  await expect(bread(page).getByRole('textbox', { name: 'Your comment', exact: true })).toHaveValue('');
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('one’s own comment can be deleted, and someone else’s reported, each after a question', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const comments = [
    comment('c1', 'Works on Saturdays too.', 'cem', '2026-11-06T09:00:00Z'),
    comment('c2', 'I went yesterday, it worked.', 'roshan', '2026-11-07T09:00:00Z', true),
  ];
  await mockSupabaseData(page, { feed: [BREAD], comments, profiles: named() });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await openHacks(page);
  await bread(page).getByRole('button', { name: 'Comments (2)', exact: true }).click();

  // Delete names the comment; Keep it changes nothing.
  const deleteMine = bread(page).getByRole('button', { name: `Delete: your comment, ${dayOf(comments[1].created_at)}`, exact: true });
  await deleteMine.click();
  await expect(bread(page).getByText('Delete this comment? Nobody will see it anymore.', { exact: true })).toBeVisible();
  await bread(page).getByRole('button', { name: 'Keep it', exact: true }).click();
  await expect(deleteMine).toBeFocused();
  await deleteMine.click();
  await bread(page).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(bread(page).getByRole('status')).toHaveText('Comment deleted.');
  await expect(commentItems(page)).toHaveCount(1);

  // A report waits for its question, then the votes' data-protection note the first time.
  await bread(page).getByRole('button', { name: `Report: the comment by @cem, ${dayOf(comments[0].created_at)}`, exact: true }).click();
  await expect(bread(page).getByText(/^Report this comment\?/)).toBeVisible();
  await bread(page).getByRole('button', { name: 'Report', exact: true }).click();
  await bread(page).getByRole('group', { name: 'About your data', exact: true }).getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(bread(page).getByRole('status')).toHaveText('Reported. You won’t see this comment anymore.');
  await expect(bread(page).getByText('No comments yet.', { exact: true })).toBeVisible();
  await expect(bread(page).getByRole('button', { name: 'Comments', exact: true })).toBeVisible();
});

test('a comment needs a posting name first, and twenty a day is the limit', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await acceptPrivacyNotes(page, ['post']);
  await mockSupabaseData(page, { feed: [BREAD], profiles: new Map() });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await openHacks(page);
  await bread(page).getByRole('button', { name: 'Comments', exact: true }).click();
  await expect(bread(page).getByText('No comments yet.', { exact: true })).toBeVisible();

  const box = bread(page).getByRole('textbox', { name: 'Your comment', exact: true });
  // Too short: nothing is sent, and the field says why.
  await box.fill('ok');
  await bread(page).getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(bread(page).getByRole('alert')).toHaveText('Write at least 3 characters.');
  await expect(box).toHaveAttribute('aria-invalid', 'true');

  await box.fill('Thanks, it worked for me.');
  await bread(page).getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(bread(page).getByRole('alert')).toHaveText(
    'First pick the name your posts go by: Settings → Your account → Your name on posts.',
  );
});

test('the daily limit is said calmly', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await acceptPrivacyNotes(page, ['post']);
  await mockSupabaseData(page, { feed: [BREAD], profiles: named(), commentLimit: true });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await openHacks(page);
  await bread(page).getByRole('button', { name: 'Comments', exact: true }).click();
  await bread(page).getByRole('textbox', { name: 'Your comment', exact: true }).fill('Thanks, it worked for me.');
  await bread(page).getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(bread(page).getByRole('alert')).toHaveText("You've written 20 comments in a day. Comment again tomorrow.");
});

test.describe('on a phone set to German', () => {
  test.use({ locale: 'de-DE' });

  test('the comments read in German', async ({ page }) => {
    await skipUnlessAccountsShow(page);
    const comments = [comment('c1', 'Works on Saturdays too.', 'cem', '2026-11-06T09:00:00Z')];
    await mockSupabaseData(page, { feed: [BREAD], comments, profiles: named() });
    await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
    await page.goto('/settings/account');
    await page.getByRole('textbox', { name: 'E-Mail', exact: true }).fill(EMAIL);
    await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.getByText(`Angemeldet als ${EMAIL}.`, { exact: true })).toBeVisible();
    await openHacks(page, 'Tipps, Rabatte, Hacks oder Checkliste', 'Hacks');

    const card = page.getByRole('list', { name: 'Beiträge', exact: true }).getByRole('listitem').filter({ hasText: 'Bread is half price' }).first();
    await card.getByRole('button', { name: 'Kommentare (1)', exact: true }).click();
    await expect(card.getByRole('list', { name: 'Kommentare', exact: true }).getByRole('listitem')).toHaveCount(1);
    await expect(card.getByRole('textbox', { name: 'Dein Kommentar', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Kommentieren', exact: true })).toBeVisible();
    // An English comment on a German phone can be translated, and says which comment.
    await expect(card.getByRole('link', { name: `Übersetzen: Kommentar von @cem, ${dayOf(comments[0].created_at)}`, exact: true })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
