import { expect, test, type Page } from '@playwright/test';
import {
  E2E_TOTP_CODE,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type AuthFactors,
  type CommentQueueRow,
  type DiscountQueueRow,
  type QueueRow,
} from './helpers/supabase';

// Moderating the hacks feed (chunk 7; docs/superpowers/plans/2026-11-05-hacks-feed.md), by role: a reader sees no
// moderation, the moderator without the authenticator code is sent to two-step sign-in, and the moderator with it
// hides and keeps reported posts, comments (community, chunk 3) and discounts students added (chunk 7). Supabase is
// mocked: `moderator` makes the account the moderator, `queue` is the posts' list, `commentQueue` the comments' and
// `discountQueue` the discounts'.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

function reported(id: string, body: string, reports: number, hiddenByReports: boolean): QueueRow {
  return {
    id,
    body,
    city: 'regensburg',
    category: 'shopping',
    link: null,
    lang: 'en',
    created_at: '2026-11-05T12:00:00Z',
    username: 'spam_shop',
    reports,
    reports_since_kept: reports,
    hidden_by_hand: false,
    hidden_by_reports: hiddenByReports,
    kept_at: null,
    last_report: '2026-11-05T13:00:00Z',
  };
}

async function signIn(page: Page, code = false) {
  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  if (code) {
    await page.getByRole('textbox', { name: '6-digit code', exact: true }).fill(E2E_TOTP_CODE);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
}

/** Settings' row for the page: its name, then its summary. */
function moderationRow(page: Page) {
  return page.getByRole('link', { name: /^Moderation/ });
}

function items(page: Page) {
  return page.getByRole('list', { name: 'Reported posts', exact: true }).getByRole('listitem');
}

test('a reader sees no moderation, and the page says it is for the moderator', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { moderator: false });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);

  await page.goto('/settings');
  await expect(page.getByRole('link', { name: /^Your account/ })).toBeVisible();
  await expect(moderationRow(page)).toHaveCount(0);
  await page.goto('/settings/moderation');
  await expect(page.getByText("This page is for the app's moderator.", { exact: true })).toBeVisible();
});

test('the moderator without the authenticator code is sent to two-step sign-in', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { moderator: true, queue: [reported('p1', 'Cheap phones at our shop!', 2, false)] });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);

  await page.goto('/settings');
  await moderationRow(page).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Moderation', exact: true })).toBeVisible();
  await expect(page.getByText(/^Moderating needs a session that gave the authenticator code\./)).toBeVisible();
  await expect(items(page)).toHaveCount(0);
});

test('the moderator with the code hides and keeps reported posts', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const queue = [reported('p1', 'Cheap phones at our shop!', 5, true), reported('p2', 'Bread is half price after 6 pm.', 1, false)];
  await mockSupabaseData(page, { moderator: true, twoStep: true, queue });
  const factors: AuthFactors = new Map([
    [EMAIL, [{ id: 'factor-moderator', friendly_name: 'Moderator phone', factor_type: 'totp', status: 'verified' } as const]],
  ]);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD }, { factors });
  await signIn(page, true);

  await page.goto('/settings');
  await expect(moderationRow(page)).toContainText('Reported hacks and discounts');
  await moderationRow(page).click();

  const phones = items(page).filter({ hasText: 'Cheap phones' });
  await expect(phones).toContainText('@spam_shop');
  await expect(phones).toContainText('5 reports since last kept · Hidden by reports');
  await expect(items(page).filter({ hasText: 'Bread' })).toContainText('1 report since last kept · Visible');

  await phones.getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Hidden from every feed.');
  await expect(phones).toContainText('Hidden by you');
  await expect(phones.getByRole('button', { name: 'Hide', exact: true })).toHaveCount(0);

  const bread = items(page).filter({ hasText: 'Bread' });
  await bread.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Kept: it shows again.');
  await expect(bread).toContainText('0 reports since last kept · Visible');
  expect(queue.map((row) => [row.id, row.hidden_by_hand, row.reports_since_kept])).toEqual([
    ['p1', true, 5],
    ['p2', false, 0],
  ]);
});

function reportedComment(id: string, body: string, reports: number, hiddenByReports: boolean): CommentQueueRow {
  return {
    id,
    hack_id: 'p9',
    body,
    lang: 'en',
    created_at: '2026-11-11T12:00:00Z',
    username: 'spam_bot',
    reports,
    reports_since_kept: reports,
    hidden_by_hand: false,
    hidden_by_reports: hiddenByReports,
    kept_at: null,
    last_report: '2026-11-11T13:00:00Z',
  };
}

test('the moderator with the code hides and keeps reported comments, in their own section', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const commentQueue = [
    reportedComment('c1', 'Buy followers cheap at our site!', 5, true),
    reportedComment('c2', 'It worked for me on a Sunday too.', 1, false),
  ];
  await mockSupabaseData(page, { moderator: true, twoStep: true, queue: [], commentQueue });
  const factors: AuthFactors = new Map([
    [EMAIL, [{ id: 'factor-moderator', friendly_name: 'Moderator phone', factor_type: 'totp', status: 'verified' } as const]],
  ]);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD }, { factors });
  await signIn(page, true);
  await page.goto('/settings/moderation');

  const postsSection = page.getByRole('region', { name: 'Posts', exact: true });
  await expect(postsSection.getByText('No reported posts.', { exact: true })).toBeVisible();
  const comments = page.getByRole('region', { name: 'Comments', exact: true }).getByRole('list', { name: 'Reported comments', exact: true }).getByRole('listitem');
  const spam = comments.filter({ hasText: 'Buy followers' });
  await expect(spam).toContainText('@spam_bot');
  await expect(spam).toContainText('5 reports since last kept · Hidden by reports');

  await spam.getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Hidden from every feed.');
  await expect(spam).toContainText('Hidden by you');

  const sunday = comments.filter({ hasText: 'Sunday' });
  await sunday.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Kept: it shows again.');
  await expect(sunday).toContainText('0 reports since last kept · Visible');
  expect(commentQueue.map((row) => [row.id, row.hidden_by_hand, row.reports_since_kept])).toEqual([
    ['c1', true, 5],
    ['c2', false, 0],
  ]);
});

function reportedDiscount(id: string, place: string, reports: number, hiddenByReports: boolean): DiscountQueueRow {
  return {
    id,
    place,
    offer: '50 % off everything, today only',
    conditions: null,
    link: 'https://www.example.de/deals',
    lang: 'en',
    created_at: '2026-11-11T12:00:00Z',
    username: 'spam_shop',
    reports,
    reports_since_kept: reports,
    hidden_by_hand: false,
    hidden_by_reports: hiddenByReports,
    kept_at: null,
    last_report: '2026-11-11T13:00:00Z',
  };
}

test('the moderator with the code hides and keeps reported discounts, with their source', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const discountQueue = [
    reportedDiscount('d1', 'Phone Shop Deluxe', 5, true),
    reportedDiscount('d2', 'Copyshop Uni', 1, false),
  ];
  await mockSupabaseData(page, { moderator: true, twoStep: true, queue: [], commentQueue: [], discountQueue });
  const factors: AuthFactors = new Map([
    [EMAIL, [{ id: 'factor-moderator', friendly_name: 'Moderator phone', factor_type: 'totp', status: 'verified' } as const]],
  ]);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD }, { factors });
  await signIn(page, true);
  await page.goto('/settings/moderation');

  await expect(page.getByRole('region', { name: 'Comments', exact: true }).getByText('No reported comments.', { exact: true })).toBeVisible();
  const discounts = page
    .getByRole('region', { name: 'Discounts', exact: true })
    .getByRole('list', { name: 'Reported discounts', exact: true })
    .getByRole('listitem');
  const shop = discounts.filter({ hasText: 'Phone Shop Deluxe' });
  await expect(shop).toContainText('@spam_shop');
  await expect(shop).toContainText('5 reports since last kept · Hidden by reports');
  await expect(shop.getByRole('link', { name: 'example.de', exact: true })).toHaveAttribute('href', 'https://www.example.de/deals');

  await shop.getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Hidden from every feed.');
  await expect(shop).toContainText('Hidden by you');

  const copyshop = discounts.filter({ hasText: 'Copyshop Uni' });
  await copyshop.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Kept: it shows again.');
  await expect(copyshop).toContainText('0 reports since last kept · Visible');
  expect(discountQueue.map((row) => [row.id, row.hidden_by_hand, row.reports_since_kept])).toEqual([
    ['d1', true, 5],
    ['d2', false, 0],
  ]);
});
