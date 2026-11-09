import { expect, test, type Page } from '@playwright/test';
import type { Account, Entry } from '../src/db/types';
import type { QuickAddAnswer, QuickAddRequest } from '../src/features/ai/contract';
import { formatDate } from '../src/lib/dates';
import { aiSwitchedOff, mockAiFunction } from './helpers/ai';
import { waitForHome } from './helpers/app';
import { acceptPrivacyNotes } from './helpers/privacy';
import { seedSetup } from './helpers/seed-setup';
import { readStore } from './helpers/setup';
import { fakeSpeech, willHear } from './helpers/speech';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow } from './helpers/supabase';

// Quick add read by the AI (the AI phase, chunks 6 and 7, docs/superpowers/plans/2026-11-09-ai-phase-1.md). The e2e
// build has the AI (`NEXT_PUBLIC_AI`), and `mockAiFunction` answers the `ai` function as its contract says. The seeded
// plan's day is 16.10.2026, and its accounts are Local bank (the default), Home bank (INR) and Cash.

test.use({ viewport: { width: 375, height: 812 } });

// Signing in links the phone to the account, which reads the account's tables: an empty account.
test.beforeEach(async ({ page }) => {
  await mockSupabaseData(page);
});

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
const EXAMPLE = '12 for pizza with Tom yesterday, paid cash';
const YESTERDAY = '2026-10-15';

/** What the model makes of a line: the example as the plan reads it, and "döner 6" for any other. */
function readLine(request: QuickAddRequest): QuickAddAnswer {
  if (!request.line.includes('pizza')) {
    return { amount: 6, otherAmount: null, note: 'döner', categoryId: 'eating-out', accountRef: null, date: null };
  }
  const cash = request.accounts.find((account) => account.name === 'Cash');
  return {
    amount: 12,
    otherAmount: null,
    note: 'pizza with Tom',
    categoryId: 'eating-out',
    accountRef: cash?.ref ?? null,
    date: YESTERDAY,
  };
}

const SAVED_EXAMPLE = `Saved €12.00 · pizza with Tom · Eating out · Cash · ${formatDate(YESTERDAY)}`;

function field(page: Page) {
  return page.getByRole('textbox', { name: 'Quick add', exact: true });
}

async function add(page: Page, line: string) {
  await field(page).fill(line);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

/** Seeds the plan, signs in on Your account (the phone links to the empty account), and opens Home. */
async function signedInHome(page: Page) {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await seedSetup(page);
  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await page.goto('/');
  await waitForHome(page);
}

test('signed in, the example line asks first, then saves €12 · Eating out · Cash · yesterday', async ({ page }) => {
  const ai = await mockAiFunction(page, { answers: { 'quick-add': readLine } });
  await signedInHome(page);

  await add(page, EXAMPLE);
  // The first time on this phone, the note on where the line goes, and nothing sent before Continue.
  const note = page.getByRole('group', { name: 'About your data', exact: true });
  await expect(note).toContainText('Anthropic (Claude), in the USA');
  expect(ai).toEqual([]);
  await note.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.getByRole('status')).toHaveText(SAVED_EXAMPLE);
  await expect(field(page)).toHaveValue('');
  // The line, today and the language went, the accounts as references: no account id leaves the phone.
  expect(ai).toHaveLength(1);
  expect(ai[0]).toMatchObject({ feature: 'quick-add', signedIn: true, body: { line: EXAMPLE, lang: 'en', today: '2026-10-16' } });
  const accounts = await readStore<Account>(page, 'accounts');
  for (const account of accounts) expect(JSON.stringify(ai[0].body)).not.toContain(account.id);
  const cash = accounts.find((account) => account.name === 'Cash');
  expect(await readStore<Entry>(page, 'entries')).toEqual([
    expect.objectContaining({ type: 'expense', amountMinor: 1200, note: 'pizza with Tom', categoryId: 'eating-out', date: YESTERDAY, accountId: cash?.id }),
  ]);

  // Accepted once: the next line goes straight away, and one on the default account today names neither.
  await add(page, 'döner 6');
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');
  await expect(note).toHaveCount(0);
  expect(ai).toHaveLength(2);
});

test('a line edited while the AI reads it saves nothing; the next line saves', async ({ page }) => {
  await acceptPrivacyNotes(page, ['ai']);
  let release = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ai = await mockAiFunction(page, { answers: { 'quick-add': readLine }, hold });
  await signedInHome(page);

  await add(page, EXAMPLE);
  await expect(page.getByRole('status')).toHaveText('Reading…');
  // Typing stops the read: its answer, when it comes, is for a line that is gone.
  await field(page).fill('döner 6');
  await expect(page.getByRole('status')).toHaveText('');
  release();

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');
  expect(ai).toHaveLength(2);
  expect(await readStore<Entry>(page, 'entries')).toEqual([expect.objectContaining({ amountMinor: 600, note: 'döner' })]);
});

test('with today’s AI reads used up, the line is read on the phone and says so', async ({ page }) => {
  await acceptPrivacyNotes(page, ['ai']);
  const ai = await mockAiFunction(page, { dailyLimit: true });
  await signedInHome(page);

  await add(page, 'döner 6');
  await expect(
    page.getByText('Today’s AI reads are used up, so quick add reads your lines on this phone for now.', { exact: true }),
  ).toBeVisible();
  // The local reader: nothing tells the category yet, so it asks.
  await page.getByRole('group', { name: 'Category', exact: true }).getByRole('button', { name: 'Eating out', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');
  expect(ai).toHaveLength(1);
});

test('a guest sends nothing to the AI, and sees no note about it', async ({ page }) => {
  const ai = await mockAiFunction(page, { answers: { 'quick-add': readLine } });
  await seedSetup(page);

  await add(page, 'döner 6');
  await page.getByRole('group', { name: 'Category', exact: true }).getByRole('button', { name: 'Eating out', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');
  await expect(page.getByRole('group', { name: 'About your data', exact: true })).toHaveCount(0);
  expect(ai).toEqual([]);
});

test('signed in with the switch off, nothing goes to the AI', async ({ page }) => {
  await aiSwitchedOff(page);
  const ai = await mockAiFunction(page, { answers: { 'quick-add': readLine } });
  await signedInHome(page);

  await add(page, 'döner 6');
  await page.getByRole('group', { name: 'Category', exact: true }).getByRole('button', { name: 'Eating out', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');
  await expect(page.getByRole('group', { name: 'About your data', exact: true })).toHaveCount(0);
  expect(ai).toEqual([]);
});

test('a dictated line goes the same way', async ({ page }) => {
  await fakeSpeech(page);
  await acceptPrivacyNotes(page, ['ai', 'mic']);
  const ai = await mockAiFunction(page, { answers: { 'quick-add': readLine } });
  await signedInHome(page);

  await willHear(page, EXAMPLE);
  await page.getByRole('button', { name: 'Speak an entry', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(SAVED_EXAMPLE);
  expect(ai).toHaveLength(1);
  expect(ai[0].body).toMatchObject({ line: EXAMPLE });
});
