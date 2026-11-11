import { expect, test, type Page } from '@playwright/test';
import { formatDate, todayIso } from '../src/lib/dates';
import { acceptPrivacyNotes } from './helpers/privacy';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow, type StudentDiscountRow } from './helpers/supabase';

// Discounts students added from the app (community, chunk 5; docs/superpowers/plans/2026-11-11-community.md): signed
// in, they join the Discounts list, marked as added by a student, with who added them and when, and Delete on one's
// own or Report on another's. Supabase is mocked: `studentDiscounts` holds them. How a row becomes a discount is
// unit-tested (`student-discounts.test.ts`).

test.use({ viewport: { width: 375, height: 812 } });

// The data-protection notes (the discount votes, reports, translating) have their own spec (privacy-notes.spec.ts).
test.beforeEach(async ({ page }) => {
  await acceptPrivacyNotes(page);
});

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

const TAILOR: StudentDiscountRow = {
  id: '6f1c2b1e-8a43-4d4f-9a4e-2b8f0c3d5e71',
  place: 'Schneiderei Nadel',
  address: null,
  offer: '15 % off hems with a student card',
  conditions: null,
  category: 'shopping',
  link: 'https://www.example.de/nadel',
  lang: 'en',
  created_at: '2026-11-09T10:00:00Z',
  username: 'bea',
  label: 'graduate',
  batch: 2025,
  mine: false,
};

const MINE: StudentDiscountRow = {
  id: '0b6d7e9a-3c21-4f0e-8d5b-7a9c1e2f3a44',
  place: 'Copyshop Uni',
  address: 'Universitätsstraße 31',
  offer: 'Zehn Kopien gratis zum Semesterstart',
  conditions: 'Nur mit Studierendenausweis',
  category: 'study',
  link: 'https://www.example.de/copyshop',
  lang: 'de',
  created_at: '2026-11-10T08:00:00Z',
  username: 'roshan',
  label: 'student',
  batch: 2027,
  mine: true,
};

async function signIn(page: Page) {
  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
}

async function showDiscounts(page: Page) {
  await page.goto('/tips');
  const tab = page.getByRole('tablist', { name: 'Tips, discounts, hacks or checklist', exact: true }).getByRole('tab', { name: 'Discounts', exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

function list(page: Page) {
  return page.getByRole('list', { name: 'Discounts', exact: true });
}

function item(page: Page, place: string) {
  return list(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name: place, exact: true }) });
}

test('signed in, a student’s discount shows marked, with who added it and when', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { studentDiscounts: [TAILOR, MINE] });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await showDiscounts(page);

  const tailor = item(page, TAILOR.place);
  await expect(tailor.getByText('Added by a student', { exact: true })).toBeVisible();
  await expect(tailor.getByText(TAILOR.offer, { exact: true })).toBeVisible();
  const source = tailor.locator('summary');
  await expect(source).toHaveAccessibleName(`Source: ${TAILOR.place}`);
  await source.click();
  await expect(
    tailor.getByText(`Added by @bea · Graduate · Batch '25 on ${formatDate(todayIso(new Date(TAILOR.created_at)))}, not checked by the app`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(tailor.getByRole('link', { name: 'example.de', exact: true })).toHaveAttribute('href', TAILOR.link);
  // Nobody checked it, so no "checked" date shows.
  await expect(tailor.getByText(/^checked /)).toHaveCount(0);
  // Its category joins the chips; it shows on its own there.
  const chips = page.getByRole('group', { name: 'Show discounts for', exact: true });
  await chips.getByRole('button', { name: 'Shopping', exact: true }).click();
  await expect(list(page).getByRole('listitem')).toHaveCount(1);

  // The app's own discounts carry no such tag, and the student's is written as it was, in its language.
  await chips.getByRole('button', { name: 'All', exact: true }).click();
  await expect(list(page).getByText('Added by a student', { exact: true })).toHaveCount(2);
  await expect(item(page, MINE.place).locator('[lang="de"]').getByText(MINE.offer, { exact: true })).toBeVisible();
  await expect(item(page, MINE.place).getByRole('link', { name: `Translate: the discount at ${MINE.place}`, exact: true })).toHaveAttribute(
    'href',
    /^https:\/\/translate\.google\.com\/\?.*tl=en/,
  );
  await expect(tailor.getByRole('link', { name: /^Translate: / })).toHaveCount(0);

  // It takes votes like any discount.
  await tailor.getByRole('button', { name: 'Still works', exact: true }).click();
  await expect(tailor.getByRole('button', { name: 'Still works', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('one’s own discount can be deleted, after a question', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { studentDiscounts: [TAILOR, MINE] });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await showDiscounts(page);

  const mine = item(page, MINE.place);
  await expect(item(page, TAILOR.place).getByRole('button', { name: /^Delete: / })).toHaveCount(0);
  await mine.getByRole('button', { name: `Delete: the discount at ${MINE.place}`, exact: true }).click();
  await expect(mine.getByText('Delete this discount? Nobody will see it anymore.', { exact: true })).toBeVisible();
  await mine.getByRole('button', { name: 'Keep it', exact: true }).click();
  await expect(mine.getByRole('button', { name: `Delete: the discount at ${MINE.place}`, exact: true })).toBeFocused();

  await mine.getByRole('button', { name: `Delete: the discount at ${MINE.place}`, exact: true }).click();
  await mine.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(item(page, MINE.place)).toHaveCount(0);
  await expect(page.getByText('Discount deleted.', { exact: true })).toBeAttached();
  await expect(list(page)).toBeFocused();
});

test('someone else’s discount can be reported, and leaves the list', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { studentDiscounts: [TAILOR, MINE] });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await showDiscounts(page);

  const tailor = item(page, TAILOR.place);
  await expect(item(page, MINE.place).getByRole('button', { name: /^Report: / })).toHaveCount(0);
  await tailor.getByRole('button', { name: `Report: the discount at ${TAILOR.place}`, exact: true }).click();
  await expect(tailor.getByText(/^Report this discount\?/)).toBeVisible();
  await tailor.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(item(page, TAILOR.place)).toHaveCount(0);
  await expect(page.getByText('Reported. You won’t see this discount anymore.', { exact: true })).toBeAttached();

  // It stays gone on the next visit (a full load): the mock took it out, as the database does for the reporter.
  await showDiscounts(page);
  await expect(item(page, MINE.place)).toBeVisible();
  await expect(item(page, TAILOR.place)).toHaveCount(0);
});

test('signed out, only the app’s own discounts show', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { studentDiscounts: [TAILOR, MINE] });
  await showDiscounts(page);
  await expect(page.getByText('Sign in to see what other students confirmed.', { exact: true })).toBeVisible();
  await expect(list(page).getByText('Added by a student', { exact: true })).toHaveCount(0);
  await expect(item(page, TAILOR.place)).toHaveCount(0);
});
