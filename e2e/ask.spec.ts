import { expect, test, type Page } from '@playwright/test';
import { TIPS } from '../src/data/tips';
import type { AskReply } from '../src/features/ai/contract';
import { AI_PREF } from '../src/features/ai/switch';
import { PRIVACY_NOTES, type PrivacyNoteId } from '../src/features/privacy/notes';
import { MESSAGES } from '../src/i18n/messages';
import { formatDate } from '../src/lib/dates';
import { mockAiFunction } from './helpers/ai';
import { openApp } from './helpers/app';
import { acceptPrivacyNotes } from './helpers/privacy';
import { seedSetup } from './helpers/seed-setup';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow } from './helpers/supabase';

// Ask (the AI phase, chunk 10, docs/superpowers/plans/2026-11-09-ai-phase-1.md): questions about the student's own
// budget, answered by the `ai` function (mocked: `mockAiFunction`) from the plan, the recent entries and the city data.
// A guest is told to sign in and sends nothing; the first question waits for the `ai` note; an answer shows with its
// sources from the app's own data; a later question carries the answers before it; Start over ends the conversation.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
const EN = MESSAGES.en;
const TEXT = EN.ask;
const TIP = TIPS.find((tip) => tip.id === 'cafeteria-surprise-bags')!;

const FIRST: AskReply = {
  answer: 'You have €47.20 left this week.\n\nThe cafeterias sell leftovers cheaply in the last 30 minutes.',
  sourceIds: [`tip:${TIP.id}`, 'tip:not-in-the-app'],
  unbacked: [],
};
const SECOND: AskReply = { answer: 'A weekend away would cost about €999.', sourceIds: [], unbacked: ['€999'] };

// Signing in links the phone to the account, which reads the account's tables: an empty account here.
test.beforeEach(async ({ page }) => {
  await mockSupabaseData(page);
});

async function signIn(page: Page) {
  await openApp(page, '/settings/account');
  await page.getByRole('textbox', { name: EN.auth.signIn.email, exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel(EN.auth.signIn.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: EN.auth.signIn.signIn, exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
}

const questionField = (page: Page) => page.getByRole('textbox', { name: TEXT.question, exact: true });
const askButton = (page: Page) => page.getByRole('button', { name: TEXT.submit, exact: true });

async function ask(page: Page, question: string) {
  await questionField(page).fill(question);
  await askButton(page).click();
}

test('a guest is told to sign in, and nothing is sent', async ({ page }) => {
  await acceptPrivacyNotes(page);
  const calls = await mockAiFunction(page, { answers: { ask: FIRST } });
  await seedSetup(page);
  await openApp(page, '/ask');
  await expect(page.getByText(TEXT.signedOut, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: TEXT.toAccount, exact: true })).toBeVisible();
  await expect(questionField(page)).toHaveCount(0);
  expect(calls).toEqual([]);
});

test('Home links to Ask; the first question waits for the note, then the answer shows with its sources', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  // Every note but Ask's own, which this test answers.
  await acceptPrivacyNotes(page, (Object.keys(PRIVACY_NOTES) as PrivacyNoteId[]).filter((id) => id !== 'ai'));
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const calls = await mockAiFunction(page, { answers: { ask: FIRST }, left: 5 });
  await seedSetup(page);
  await signIn(page);

  await openApp(page, '/');
  await page.getByRole('link', { name: TEXT.link, exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: EN.shell.headings.ask, exact: true })).toBeVisible();

  await ask(page, 'How much can I spend this week?');
  // The note first: Cancel sends nothing, Continue asks from the same tap.
  await expect(page.getByText(EN.common.privacy.ai, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: EN.common.privacy.cancel, exact: true }).click();
  expect(calls).toEqual([]);
  await askButton(page).click();
  await page.getByRole('button', { name: EN.common.privacy.continue, exact: true }).click();

  await expect(page.getByText('You have €47.20 left this week.', { exact: true })).toBeVisible();
  await expect(page.getByText('The cafeterias sell leftovers cheaply in the last 30 minutes.', { exact: true })).toBeVisible();
  await expect(page.getByText(TEXT.left(5), { exact: true })).toBeVisible();
  await expect(page.getByText(TEXT.estimate)).toHaveCount(0);

  // The source comes from the app's own data, not the model; an id the app doesn't know shows nothing.
  const source = page.getByText(EN.common.source.of(TIP.title), { exact: true });
  await expect(source).toHaveCount(1);
  await source.click();
  await expect(page.getByText(EN.common.source.checked(formatDate(TIP.checked)), { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: new URL(TIP.url).hostname.replace(/^www\./, ''), exact: true })).toBeVisible();

  // What went: the snapshot of this phone's plan, and the question alone.
  expect(calls).toHaveLength(1);
  const sent = calls[0].body as { feature: string; lang: string; snapshot: { plan: object }; turns: unknown[] };
  expect(sent).toMatchObject({ feature: 'ask', lang: 'en' });
  expect(sent.snapshot.plan).toBeDefined();
  expect(sent.turns).toEqual([{ role: 'user', text: 'How much can I spend this week?' }]);
});

test('a later question carries the answers before it; an amount nothing backs says so; Start over ends it', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await acceptPrivacyNotes(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const calls = await mockAiFunction(page, {
    answers: { ask: (request) => (request.turns.length === 1 ? FIRST : SECOND) },
    left: 4,
  });
  await seedSetup(page);
  await signIn(page);
  await openApp(page, '/ask');

  await ask(page, 'How much can I spend this week?');
  await expect(page.getByText('You have €47.20 left this week.', { exact: true })).toBeVisible();
  await ask(page, 'And a weekend trip?');
  await expect(page.getByText(SECOND.answer, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXT.estimate, { exact: true })).toBeVisible();

  const second = calls[1].body as { turns: unknown[] };
  expect(second.turns).toEqual([
    { role: 'user', text: 'How much can I spend this week?' },
    { role: 'assistant', text: FIRST.answer },
    { role: 'user', text: 'And a weekend trip?' },
  ]);

  await page.getByRole('button', { name: TEXT.startOver, exact: true }).click();
  await expect(page.getByText(SECOND.answer, { exact: true })).toHaveCount(0);
  await expect(questionField(page)).toHaveValue('');
});

test('the daily limit says so; with the AI switched off on this phone nothing is sent', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await acceptPrivacyNotes(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const calls = await mockAiFunction(page, { dailyLimit: true });
  await seedSetup(page);
  await signIn(page);
  await openApp(page, '/ask');

  await ask(page, 'Where does my money go?');
  await expect(page.getByText(TEXT.problems.dailyLimit, { exact: true })).toBeVisible();
  expect(calls).toHaveLength(1);

  await page.evaluate((key) => localStorage.setItem(key, 'off'), AI_PREF);
  await openApp(page, '/ask');
  await expect(page.getByText(TEXT.switchedOff, { exact: true })).toBeVisible();
  await expect(questionField(page)).toHaveCount(0);
  expect(calls).toHaveLength(1);
});
