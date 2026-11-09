import { expect, test, type Page } from '@playwright/test';
import type { Plan } from '../src/db/types';
import type { SetupAnswer } from '../src/features/ai/contract';
import { categoryNameIn } from '../src/i18n/category-name';
import { MESSAGES } from '../src/i18n/messages';
import { aiSwitchedOff, mockAiFunction } from './helpers/ai';
import { openApp, waitForHome } from './helpers/app';
import { acceptPrivacyNotes } from './helpers/privacy';
import { ensureClock, readStore } from './helpers/setup';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow } from './helpers/supabase';

// The setup chat (the AI phase, chunk 12, docs/superpowers/plans/2026-11-09-ai-phase-1.md): on a new setup's first
// step, signed in, in a build with the AI (the e2e build has it). `mockAiFunction` answers the `ai` function as its
// contract says. The chat fills the wizard's draft; nothing is saved before the student goes through the steps and
// taps Save plan.

test.use({ viewport: { width: 375, height: 812 } });

// Signing in links the phone to the account, which reads the account's tables: an empty account, as a new one is.
test.beforeEach(async ({ page }) => {
  await mockSupabaseData(page);
});

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
const en = MESSAGES.en;
const MESSAGE = 'I get 500 a month from my parents, pay 400 rent, and want 310 for food.';

/** The chat's turn: rent, the parents' money and food filled in, with the rent range as its source. */
const FILLED: SetupAnswer = {
  reply: 'I filled in €500 from your parents, rent of €400 and €310 for food. Check the steps, then save.',
  sourceIds: ['range:rent'],
  patch: {
    rent: 400,
    incomes: [{ categoryId: 'income-parents', amount: 500 }],
    fixed: [],
    envelopes: [{ categoryId: 'food', amount: 310 }],
    spendingBudget: null,
    accounts: null,
  },
};

function chatButton(page: Page) {
  return page.getByRole('button', { name: 'Set up by chatting', exact: true });
}

async function next(page: Page, heading: string) {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: heading, exact: true })).toBeVisible();
}

/** Signs in on Your account on a phone without a plan (the account is empty too), and opens setup. */
async function signedInSetup(page: Page) {
  await skipUnlessAccountsShow(page);
  await ensureClock(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await openApp(page, '/setup');
  await expect(page.getByRole('heading', { level: 3, name: 'Accounts', exact: true })).toBeVisible();
}

test('the chat fills the steps, and nothing is saved before Save plan', async ({ page }) => {
  const ai = await mockAiFunction(page, { answers: { setup: FILLED } });
  await signedInSetup(page);

  await chatButton(page).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Set up by chatting', exact: true })).toBeVisible();
  // The chat opens on its field.
  const field = page.getByRole('textbox', { name: 'Your message', exact: true });
  await expect(field).toBeFocused();
  await field.fill(MESSAGE);
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  // The first time on this phone, the note on where it goes, and nothing sent before Continue.
  const note = page.getByRole('group', { name: 'About your data', exact: true });
  await expect(note).toContainText('Anthropic (Claude), in the USA');
  expect(ai).toEqual([]);
  await note.getByRole('button', { name: 'Continue', exact: true }).click();

  // The reply, what it filled in, and its source from the app's own data.
  await expect(page.getByText(FILLED.reply, { exact: true })).toBeVisible();
  for (const line of [
    `${categoryNameIn(en, 'rent')}: €400.00`,
    `${categoryNameIn(en, 'income-parents')}: €500.00`,
    `${categoryNameIn(en, 'food')}: €310.00`,
  ]) {
    await expect(page.getByText(line, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Sources', { exact: true })).toBeVisible();
  // What went: the message and the draft as it was, in the phone's language.
  expect(ai).toHaveLength(1);
  expect(ai[0]).toMatchObject({ feature: 'setup', signedIn: true, body: { lang: 'en', turns: [{ role: 'user', text: MESSAGE }] } });

  // The AI never saves.
  expect(await readStore<Plan>(page, 'plan')).toEqual([]);

  // Review the steps: back on the first step, with what the chat filled in on the steps after it.
  await page.getByRole('button', { name: 'Review the steps', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Accounts', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Your message', exact: true })).toHaveCount(0);
  await next(page, 'Income');
  await expect(page.getByLabel('Parents', { exact: true })).toHaveValue('500');
  await next(page, 'Fixed costs');
  await expect(page.getByRole('textbox', { name: 'Rent per month', exact: true })).toHaveValue('400');
  await next(page, 'Envelopes');
  await expect(page.getByLabel('Food & groceries', { exact: true })).toHaveValue('310');
  expect(await readStore<Plan>(page, 'plan')).toEqual([]);

  // Save plan saves what the steps hold.
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await waitForHome(page);
  const [plan] = await readStore<Plan>(page, 'plan');
  expect(plan.fixed).toContainEqual(expect.objectContaining({ categoryId: 'rent', monthlyMinor: 40000 }));
  expect(plan.incomes).toContainEqual(expect.objectContaining({ categoryId: 'income-parents', monthlyMinor: 50000 }));
  expect(plan.envelopes).toContainEqual({ categoryId: 'food', monthlyMinor: 31000 });
});

test('a message the chat can’t answer today says so, and fills in nothing', async ({ page }) => {
  await acceptPrivacyNotes(page, ['ai']);
  await mockAiFunction(page, { dailyLimit: true });
  await signedInSetup(page);

  await chatButton(page).click();
  await page.getByRole('textbox', { name: 'Your message', exact: true }).fill(MESSAGE);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(
    page.getByText('Today’s setup chat messages are used up. Fill in the steps yourself, or try again tomorrow.', {
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Review the steps', exact: true }).click();
  await next(page, 'Income');
  await expect(page.getByLabel('Parents', { exact: true })).not.toHaveValue('500');
});

test('a guest sees no setup chat, and nothing goes to the AI', async ({ page }) => {
  const ai = await mockAiFunction(page, { answers: { setup: FILLED } });
  await ensureClock(page);
  await openApp(page, '/setup');
  await expect(page.getByRole('heading', { level: 3, name: 'Accounts', exact: true })).toBeVisible();
  await expect(chatButton(page)).toHaveCount(0);
  expect(ai).toEqual([]);
});

test('signed in with the AI switched off, setup says where to turn it on instead of offering the chat', async ({ page }) => {
  await aiSwitchedOff(page);
  const ai = await mockAiFunction(page, { answers: { setup: FILLED } });
  await signedInSetup(page);

  await expect(chatButton(page)).toHaveCount(0);
  await expect(
    page.getByText('The setup chat is off on this phone. AI features can be turned on in Settings → Your account.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(ai).toEqual([]);
});
