import { expect, test, type Page } from '@playwright/test';
import { PRIVACY_NOTES } from '../src/features/privacy/notes';
import { MESSAGES } from '../src/i18n/messages';
import { acceptPrivacyNotes } from './helpers/privacy';
import { E2E_PUSH_ENDPOINT, pushRecord, stubPush } from './helpers/push';
import {
  e2eUserIdOf,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type AuthFactors,
  type ServerReminders,
} from './helpers/supabase';

// Settings → Weekly reminder (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 4): turning it on asks once
// about the data, then the browser, and saves this phone's day, time, zone and language; changing and turning off
// follow; where it can't work the page says why. The browser's push is played (`stubPush`, since `next dev` starts no
// service worker), and Supabase is mocked (`reminders` holds what `save_push_subscription` got).

test.use({ viewport: { width: 375, height: 812 }, timezoneId: 'Europe/Berlin' });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
const EN = MESSAGES.en;
const TEXT = EN.reminder;

async function signIn(page: Page, words = EN.auth) {
  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: words.signIn.email, exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel(words.signIn.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: words.signIn.signIn, exact: true }).click();
}

/**
 * Skips the spec when the reused dev server was started without the VAPID key: the page then has nothing to offer.
 * `t` is the language the page opens in (the spec's locale): its heading shows once that language is on.
 */
async function skipUnlessReminders(page: Page, t = EN) {
  await skipUnlessAccountsShow(page);
  await page.goto('/settings/reminder');
  await expect(page.getByRole('heading', { level: 2, name: t.shell.headings.reminder, exact: true })).toBeVisible();
  const off = (await page.getByText(t.reminder.unavailable, { exact: true }).count()) > 0;
  test.skip(off, 'The reused dev server has no NEXT_PUBLIC_VAPID_PUBLIC_KEY: stop it, or run with E2E_PORT=3001.');
}

/** Settings' row for the page: its name, then its summary. */
const reminderRow = (page: Page, name = EN.shell.headings.reminder) =>
  page.getByRole('link', { name: new RegExp(`^${name}`) });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const status = (page: Page) => page.getByRole('status');

test('signed out, the page says to sign in, and Settings says it is off', async ({ page }) => {
  await stubPush(page);
  await mockSupabaseData(page);
  await skipUnlessReminders(page);

  await expect(page.getByText(TEXT.signedOut, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: TEXT.toAccount, exact: true })).toBeVisible();
  await expect(button(page, TEXT.turnOn)).toHaveCount(0);
  // The calendar is the other way, for every phone.
  await expect(page.getByRole('link', { name: TEXT.toCheckIn, exact: true })).toHaveAttribute('href', '/check-in');

  await page.goto('/settings');
  await expect(reminderRow(page)).toContainText(TEXT.summaryOff);
});

test('turning it on asks once about the data, then the browser, and saves the day, time, zone and language', async ({
  page,
}) => {
  await stubPush(page);
  const reminders: ServerReminders = new Map();
  await mockSupabaseData(page, { reminders });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await skipUnlessReminders(page);
  await signIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();

  await page.goto('/settings');
  await reminderRow(page).click();
  await expect(page.getByLabel(TEXT.day, { exact: true })).toHaveValue('7');
  await expect(page.getByLabel(TEXT.time, { exact: true })).toHaveValue('18:00');

  // Cancel: nothing asked, nothing saved.
  await button(page, TEXT.turnOn).click();
  const note = page.getByRole('group', { name: EN.common.privacy.label, exact: true });
  await expect(note).toContainText(EN.common.privacy.reminder);
  await note.getByRole('button', { name: EN.common.privacy.cancel, exact: true }).click();
  await expect(button(page, TEXT.turnOn)).toBeFocused();
  expect((await pushRecord(page)).asked).toBe(0);
  expect(reminders.size).toBe(0);

  // Continue: the browser asks, the phone subscribes with the app's key, and the row is saved.
  await button(page, TEXT.turnOn).click();
  await note.getByRole('button', { name: EN.common.privacy.continue, exact: true }).click();
  await expect(status(page)).toHaveText(TEXT.status.on('Sundays', '18:00'));
  await expect(button(page, TEXT.turnOff)).toBeFocused();
  expect(await pushRecord(page)).toMatchObject({ asked: 1, subscribed: 1, keyLength: 65 });
  expect([...reminders.values()]).toEqual([
    {
      user: e2eUserIdOf(EMAIL),
      p_endpoint: E2E_PUSH_ENDPOINT,
      p_p256dh: 'BE2EPhoneKey',
      p_auth: 'e2e-auth',
      p_weekday: 7,
      p_local_time: '18:00',
      p_time_zone: 'Europe/Berlin',
      p_lang: 'en',
    },
  ]);
  expect(await page.evaluate((key) => localStorage.getItem(key), PRIVACY_NOTES.reminder)).toBe('seen');

  await page.goto('/settings');
  await expect(reminderRow(page)).toContainText('Sundays at 18:00');
});

test('a new day and time are saved, and turning it off deletes the row and the subscription', async ({ page }) => {
  await stubPush(page);
  await acceptPrivacyNotes(page, ['reminder']);
  const reminders: ServerReminders = new Map();
  await mockSupabaseData(page, { reminders });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await skipUnlessReminders(page);
  await signIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await page.goto('/settings/reminder');

  await button(page, TEXT.turnOn).click();
  await expect(status(page)).toHaveText(TEXT.status.on('Sundays', '18:00'));
  // Nothing changed yet: nothing to save.
  await expect(button(page, TEXT.save)).toBeDisabled();

  await page.getByLabel(TEXT.day, { exact: true }).selectOption({ label: 'Wednesday' });
  await page.getByLabel(TEXT.time, { exact: true }).selectOption('07:45');
  await button(page, TEXT.save).click();
  await expect(status(page)).toHaveText(TEXT.status.on('Wednesdays', '07:45'));
  expect(reminders.get(E2E_PUSH_ENDPOINT)).toMatchObject({ p_weekday: 3, p_local_time: '07:45' });
  // The same subscription: the browser isn't asked again.
  expect(await pushRecord(page)).toMatchObject({ asked: 1, subscribed: 1 });

  await button(page, TEXT.turnOff).click();
  await expect(status(page)).toHaveText(TEXT.status.off);
  await expect(button(page, TEXT.turnOn)).toBeFocused();
  expect(reminders.size).toBe(0);
  expect((await pushRecord(page)).unsubscribed).toBe(1);
  // The day and time stay picked for next time.
  await expect(page.getByLabel(TEXT.day, { exact: true })).toHaveValue('3');

  await page.goto('/settings');
  await expect(reminderRow(page)).toContainText(TEXT.summaryOff);
});

test('a refused prompt saves nothing, and the page says how to allow notifications', async ({ page }) => {
  await stubPush(page, { answer: 'denied' });
  await acceptPrivacyNotes(page, ['reminder']);
  const reminders: ServerReminders = new Map();
  await mockSupabaseData(page, { reminders });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await skipUnlessReminders(page);
  await signIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await page.goto('/settings/reminder');

  await button(page, TEXT.turnOn).click();
  await expect(status(page)).toHaveText(TEXT.denied);
  await expect(button(page, TEXT.turnOn)).toHaveCount(0);
  expect(reminders.size).toBe(0);
  expect((await pushRecord(page)).subscribed).toBe(0);
});

test('a browser without push gets the calendar instead, and nothing to turn on', async ({ page }) => {
  await stubPush(page, { push: false });
  await mockSupabaseData(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await skipUnlessReminders(page);
  await signIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await page.goto('/settings/reminder');

  await expect(page.getByText(TEXT.noPush, { exact: true })).toBeVisible();
  await expect(button(page, TEXT.turnOn)).toHaveCount(0);
});

test('an account with two-step sign-in gives its code first', async ({ page }) => {
  await stubPush(page);
  await mockSupabaseData(page, { twoStep: true });
  const factors: AuthFactors = new Map([
    [EMAIL, [{ id: 'factor-phone', friendly_name: 'Phone', factor_type: 'totp', status: 'verified' } as const]],
  ]);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD }, { factors });
  await skipUnlessReminders(page);
  await signIn(page);
  // The account page now asks for the code; the reminder waits for it.
  await expect(page.getByRole('textbox', { name: '6-digit code', exact: true })).toBeVisible();
  await page.goto('/settings/reminder');

  await expect(page.getByText(TEXT.needsCode, { exact: true })).toBeVisible();
  await expect(button(page, TEXT.turnOn)).toHaveCount(0);
});

test.describe('on an iPhone, in a Safari tab', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });

  test('the page says to add the app to the Home Screen first', async ({ page }) => {
    await stubPush(page, { installed: false, push: false });
    await mockSupabaseData(page);
    await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
    await skipUnlessReminders(page);
    await signIn(page);
    await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
    await page.goto('/settings/reminder');

    await expect(page.getByText(TEXT.installFirst, { exact: true })).toBeVisible();
    await expect(button(page, TEXT.turnOn)).toHaveCount(0);
  });
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('the reminder is saved in German, and Settings says when', async ({ page }) => {
    const de = MESSAGES.de;
    await stubPush(page);
    await acceptPrivacyNotes(page, ['reminder']);
    const reminders: ServerReminders = new Map();
    await mockSupabaseData(page, { reminders });
    await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
    await skipUnlessReminders(page, de);
    await signIn(page, de.auth);
    await expect(page.getByText(`Angemeldet als ${EMAIL}.`, { exact: true })).toBeVisible();
    await page.goto('/settings/reminder');

    await expect(page.getByRole('heading', { level: 2, name: de.shell.headings.reminder, exact: true })).toBeVisible();
    await page.getByRole('button', { name: de.reminder.turnOn, exact: true }).click();
    await expect(status(page)).toHaveText('Die Erinnerung ist an: sonntags um 18:00.');
    expect(reminders.get(E2E_PUSH_ENDPOINT)?.p_lang).toBe('de');

    await page.goto('/settings');
    await expect(reminderRow(page, de.shell.headings.reminder)).toContainText('Sonntags um 18:00');
  });
});
