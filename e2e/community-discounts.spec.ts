import { expect, test, type Page, type Request } from '@playwright/test';
import { PRIVACY_NOTES, type PrivacyNoteId } from '../src/features/privacy/notes';
import { formatDate, todayIso } from '../src/lib/dates';
import { acceptPrivacyNotes } from './helpers/privacy';
import {
  e2eUserIdOf,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type ServerProfiles,
  type StudentDiscountRow,
} from './helpers/supabase';

// Discounts students added from the app (community, chunk 5; docs/superpowers/plans/2026-11-11-community.md): signed
// in, they join the Discounts list, marked as added by a student, with who added them and when, and Delete on one's
// own or Report on another's; "Add a discount" adds one (chunk 6). Supabase is mocked: `studentDiscounts` holds them,
// `profiles` the posting names. How a row becomes a discount, and how the form checks one, is unit-tested
// (`student-discounts.test.ts`, `add-discount.test.ts`).

test.use({ viewport: { width: 375, height: 812 } });

// The data-protection notes (the discount votes, reports, translating) have their own spec (privacy-notes.spec.ts).
// The `post` note is left for the first discount added, which waits for it; the other adding tests accept it.
test.beforeEach(async ({ page }) => {
  await acceptPrivacyNotes(page, (Object.keys(PRIVACY_NOTES) as PrivacyNoteId[]).filter((id) => id !== 'post'));
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

const named = (): ServerProfiles => new Map([[e2eUserIdOf(EMAIL), { username: 'roshan', label: 'student', batch: 2027 }]]);

/** Every `post_discount` call's arguments, as they are sent. */
function addCalls(page: Page): unknown[] {
  const calls: unknown[] = [];
  page.on('request', (request: Request) => {
    if (request.url().includes('/rest/v1/rpc/post_discount')) calls.push(request.postDataJSON());
  });
  return calls;
}

function form(page: Page) {
  return page.getByRole('region', { name: 'Add a discount', exact: true });
}

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

test('signed out, only the app’s own discounts show, with no Add a discount', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { studentDiscounts: [TAILOR, MINE] });
  await showDiscounts(page);
  await expect(page.getByText('Sign in to see what other students confirmed.', { exact: true })).toBeVisible();
  await expect(list(page).getByText('Added by a student', { exact: true })).toHaveCount(0);
  await expect(item(page, TAILOR.place)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a discount', exact: true })).toHaveCount(0);
});

test('a new discount is checked, waits for its note, and shows as one’s own', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { profiles: named(), studentDiscounts: [] });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const calls = addCalls(page);
  await signIn(page);
  await showDiscounts(page);

  await page.getByRole('button', { name: 'Add a discount', exact: true }).click();
  const place = form(page).getByRole('textbox', { name: 'Place', exact: true });
  const link = form(page).getByRole('textbox', { name: 'Source link', exact: true });
  await expect(place).toBeFocused();
  await expect(form(page)).toContainText('No alcohol deals.');

  // Checked on the phone first, each message tied to its field: nothing is sent.
  await place.fill('x');
  await form(page).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(form(page).getByRole('alert')).toHaveText('Name the place, with at least 2 characters.');
  await expect(place).toHaveAttribute('aria-invalid', 'true');
  await place.fill('Schneiderei Nadel');
  await form(page).getByRole('textbox', { name: 'Offer', exact: true }).fill('15 % off hems with a student card');
  await form(page).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(form(page).getByRole('alert')).toHaveText('Give the link to the page that states the offer, starting with https://');
  await expect(link).toHaveAttribute('aria-invalid', 'true');
  await expect(place).not.toHaveAttribute('aria-invalid', 'true');
  await link.fill('https://www.example.de/nadel');
  await form(page).getByRole('textbox', { name: 'Conditions (optional)', exact: true }).fill('Weekdays only');
  await form(page).getByRole('combobox', { name: 'Category', exact: true }).selectOption({ label: 'Shopping' });

  // The first post on this phone says who will see it; Cancel sends nothing.
  await form(page).getByRole('button', { name: 'Add', exact: true }).click();
  const note = form(page).getByRole('group', { name: 'About your data', exact: true });
  await expect(note).toBeVisible();
  await note.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(calls).toHaveLength(0);

  await form(page).getByRole('button', { name: 'Add', exact: true }).click();
  await note.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Discount added.', { exact: true })).toBeAttached();
  expect(calls).toEqual([
    {
      p_place: 'Schneiderei Nadel',
      p_address: null,
      p_offer: '15 % off hems with a student card',
      p_conditions: 'Weekdays only',
      p_category: 'shopping',
      p_link: 'https://www.example.de/nadel',
      p_lang: 'en',
    },
  ]);
  expect(await page.evaluate((key) => localStorage.getItem(key), PRIVACY_NOTES.post)).toBe('seen');
  await expect(form(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a discount', exact: true })).toBeFocused();

  const added = item(page, 'Schneiderei Nadel');
  await expect(added.getByText('Added by a student', { exact: true })).toBeVisible();
  await expect(added.getByRole('button', { name: 'Delete: the discount at Schneiderei Nadel', exact: true })).toBeVisible();
});

test('an account without a name picks one before its first discount', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await acceptPrivacyNotes(page, ['post']);
  const profiles: ServerProfiles = new Map();
  await mockSupabaseData(page, { profiles, studentDiscounts: [] });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await showDiscounts(page);

  await page.getByRole('button', { name: 'Add a discount', exact: true }).click();
  await form(page).getByRole('textbox', { name: 'Place', exact: true }).fill('Copyshop Uni');
  await form(page).getByRole('textbox', { name: 'Offer', exact: true }).fill('Ten free copies at the start of term');
  await form(page).getByRole('textbox', { name: 'Source link', exact: true }).fill('https://www.example.de/copyshop');
  await form(page).getByRole('button', { name: 'Add', exact: true }).click();

  await expect(form(page).getByRole('alert')).toHaveText('First pick the name your posts go by.');
  const username = form(page).getByRole('textbox', { name: 'Username', exact: true });
  await expect(username).toHaveAttribute('aria-invalid', 'true');
  await username.fill('roshan');
  await form(page).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Discount added.', { exact: true })).toBeAttached();
  expect(profiles.get(e2eUserIdOf(EMAIL))).toEqual({ username: 'roshan', label: 'student', batch: null });
  await expect(item(page, 'Copyshop Uni').getByText('Added by a student', { exact: true })).toBeVisible();
});

test('a fourth discount in a day is refused, and Cancel closes the form', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await acceptPrivacyNotes(page, ['post']);
  await mockSupabaseData(page, { profiles: named(), studentDiscounts: [], discountLimit: true });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);
  await showDiscounts(page);

  await page.getByRole('button', { name: 'Add a discount', exact: true }).click();
  await form(page).getByRole('textbox', { name: 'Place', exact: true }).fill('Copyshop Uni');
  await form(page).getByRole('textbox', { name: 'Offer', exact: true }).fill('Ten free copies at the start of term');
  await form(page).getByRole('textbox', { name: 'Source link', exact: true }).fill('https://www.example.de/copyshop');
  await form(page).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(form(page).getByRole('alert')).toHaveText("You've added 3 discounts in a day. Add more tomorrow.");

  await form(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(form(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a discount', exact: true })).toBeFocused();
});

test.describe('on a phone set to German', () => {
  test.use({ locale: 'de-DE' });

  test('a student’s discount and the form read in German, and fit the phone', async ({ page }) => {
    await skipUnlessAccountsShow(page);
    await mockSupabaseData(page, { profiles: named(), studentDiscounts: [TAILOR, MINE] });
    await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
    await page.goto('/settings/account');
    await page.getByRole('textbox', { name: 'E-Mail', exact: true }).fill(EMAIL);
    await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.getByText(`Angemeldet als ${EMAIL}.`, { exact: true })).toBeVisible();
    await page.goto('/tips');
    const tab = page.getByRole('tablist', { name: 'Tipps, Rabatte, Hacks oder Checkliste', exact: true }).getByRole('tab', { name: 'Rabatte', exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');

    const list = page.getByRole('list', { name: 'Rabatte', exact: true });
    const tailor = list.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: TAILOR.place, exact: true }) });
    await expect(tailor.getByText('Von Studierenden eingetragen', { exact: true })).toBeVisible();
    // An English discount on a German phone can be translated, and says which discount; it can be reported.
    await expect(tailor.getByRole('link', { name: `Übersetzen: der Rabatt bei ${TAILOR.place}`, exact: true })).toBeVisible();
    await expect(tailor.getByRole('button', { name: `Melden: der Rabatt bei ${TAILOR.place}`, exact: true })).toBeVisible();
    const mine = list.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: MINE.place, exact: true }) });
    await expect(mine.getByRole('button', { name: `Löschen: der Rabatt bei ${MINE.place}`, exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Rabatt eintragen', exact: true }).click();
    const form = page.getByRole('region', { name: 'Rabatt eintragen', exact: true });
    await expect(form.getByRole('textbox', { name: 'Ort', exact: true })).toBeFocused();
    await expect(form.getByRole('textbox', { name: 'Angebot', exact: true })).toBeVisible();
    await expect(form.getByRole('textbox', { name: 'Link zur Quelle', exact: true })).toBeVisible();
    await expect(form).toContainText('Keine Alkohol-Angebote.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
