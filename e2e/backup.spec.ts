import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { Account, Category, Entry, Plan, Rate } from '../src/db/types';
import { completeSetup, readStore } from './helpers/setup';

// The clock is pinned to 2026-10-16 by `completeSetup`, so the file is named after that day.
const FILE_NAME = 'studentsbudget-backup-2026-10-16.json';
const QUESTION = 'Replace all data on this device with the backup from 16 Oct?';
const NOT_A_BACKUP = "This isn't a StudentsBudget backup file.";
const NEWER = 'This backup is from a newer version of the app.';

const EMPTY_BACKUP = {
  app: 'studentsbudget',
  version: 1,
  exportedAt: '2026-10-16T10:00:00.000Z',
  data: { accounts: [], categories: [], entries: [], plan: null, guesses: [], fxRates: [] },
};

// Next adds its own role="alert" route announcer outside <main>; the messages under test are inside it.
function inlineAlert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

function backupFileInput(page: Page) {
  return page.getByLabel('File to restore');
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function openSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 3, name: 'Backup' })).toBeVisible();
}

/** Takes the download path on every browser: some have a share sheet for files, some pretend to. */
async function withoutShareSheet(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
}

type ShareMode = 'ok' | 'abort' | 'blocked';
type ShareCall = { name: string; type: string; title: string; text: string; inDispatch: boolean };
type ShareWindow = Window & { shareLog: ShareCall[]; shareMode: ShareMode };

/**
 * A share sheet that behaves like iOS: it opens only when `navigator.share` is called inside the tap itself.
 * A capture-phase click listener raises a flag that a timer clears once the click's own task is over, so a
 * share that waited for the database first (a task of its own) sees the flag down, is logged with
 * `inDispatch: false` and is refused with NotAllowedError, as WebKit does. `shareMode` makes the stub
 * refuse ('blocked') or be closed by the person ('abort') even inside the tap.
 */
async function withShareSheet(page: Page) {
  await page.addInitScript(() => {
    const shareWindow = window as unknown as ShareWindow;
    shareWindow.shareLog = [];
    shareWindow.shareMode = 'ok';
    let inClick = false;
    window.addEventListener(
      'click',
      () => {
        inClick = true;
        setTimeout(() => {
          inClick = false;
        }, 0);
      },
      true,
    );
    Object.defineProperty(navigator, 'canShare', {
      value: (data: ShareData) => (data.files?.length ?? 0) > 0,
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: async (data: ShareData) => {
        const inDispatch = inClick;
        const file = data.files?.[0];
        if (!file) throw new TypeError('no file');
        const call: ShareCall = { name: file.name, type: file.type, title: data.title ?? '', text: '', inDispatch };
        shareWindow.shareLog.push(call);
        call.text = await file.text();
        if (!inDispatch || shareWindow.shareMode === 'blocked') {
          throw new DOMException('The share sheet could not be opened.', 'NotAllowedError');
        }
        if (shareWindow.shareMode === 'abort') throw new DOMException('The share sheet was closed.', 'AbortError');
      },
      configurable: true,
    });
  });
}

async function setShareMode(page: Page, mode: ShareMode) {
  await page.evaluate((next) => {
    (window as unknown as ShareWindow).shareMode = next;
  }, mode);
}

async function shareCalls(page: Page) {
  return page.evaluate(() => (window as unknown as ShareWindow).shareLog);
}

/** Counts the downloads a page starts. */
function countDownloads(page: Page) {
  const count = { value: 0 };
  page.on('download', () => (count.value += 1));
  return count;
}

async function everything(page: Page) {
  return {
    accounts: await readStore<Account>(page, 'accounts'),
    categories: await readStore<Category>(page, 'categories'),
    entries: await readStore<Entry>(page, 'entries'),
    plan: await readStore<Plan>(page, 'plan'),
    fxRates: await readStore<Rate>(page, 'fxRates'),
  };
}

test.describe('on a desktop browser', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'The iphone project only checks the layout, below.');
  });

  test('exports a backup, deletes everything, and restores from the file on /setup', async ({ page }, testInfo) => {
    await withoutShareSheet(page);
    // Settings has live queries open while the database is deleted and restored; none of them may crash the page.
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await completeSetup(page);

    // An entry, and a manual INR rate next to the ECB one.
    await page.getByRole('textbox', { name: 'Quick add' }).fill('döner 6');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Eating out' }).click();
    await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');
    await openSettings(page);
    await page.getByLabel('Your rate for INR per €1').fill('97');
    await page.getByRole('button', { name: 'Save rate' }).click();
    await expect(page.getByText('1 € = 97 INR · set by you')).toBeVisible();
    const before = await everything(page);
    expect(before.fxRates.map((rate) => rate.source).sort()).toEqual(['ecb', 'manual']);

    // Export: with no share sheet it is a download.
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export backup' }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe(FILE_NAME);
    const filePath = testInfo.outputPath(FILE_NAME);
    await download.saveAs(filePath);
    await expect(page.getByRole('status')).toHaveText(`Download started: ${FILE_NAME}`);
    const file = JSON.parse(await readFile(filePath, 'utf8')) as {
      app: string;
      version: number;
      data: { entries: Entry[]; fxRates: Rate[]; plan: Plan | null };
    };
    expect(file).toMatchObject({ app: 'studentsbudget', version: 1 });
    expect(file.data.entries.map((entry) => entry.note)).toEqual(['döner']);
    expect(file.data.fxRates.map((rate) => rate.source).sort()).toEqual(['ecb', 'manual']);
    expect(file.data.plan?.id).toBe('current');

    // Choosing the file asks first; Cancel changes nothing.
    await backupFileInput(page).setInputFiles(filePath);
    await expect(page.getByText(QUESTION)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(QUESTION)).toHaveCount(0);
    expect(await everything(page)).toEqual(before);

    // Delete everything: the button stays off until DELETE is typed exactly.
    await page.getByRole('button', { name: 'Delete everything' }).click();
    const confirmDelete = page.getByRole('button', { name: 'Delete everything' });
    await expect(confirmDelete).toBeDisabled();
    await page.getByLabel('Type DELETE to confirm').fill('delete');
    await expect(confirmDelete).toBeDisabled();
    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await expect(confirmDelete).toBeEnabled();
    await confirmDelete.click();

    // A new setup: nothing left but the built-in categories.
    await expect(page).toHaveURL('/setup');
    await expect(page.getByRole('heading', { level: 3, name: 'City and rent' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Restore from a backup' })).toBeVisible();
    const wiped = await everything(page);
    expect(wiped.accounts).toEqual([]);
    expect(wiped.entries).toEqual([]);
    expect(wiped.plan).toEqual([]);
    expect(wiped.fxRates).toEqual([]);
    expect(wiped.categories).toHaveLength(18);

    // Restore from the file, without setting up first.
    await backupFileInput(page).setInputFiles(filePath);
    await expect(page.getByText(QUESTION)).toBeVisible();
    await page.getByRole('button', { name: 'Yes' }).click();

    // The restored plan is home again, with the money left this week and the entry in the list.
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('region', { name: 'Safe to spend this week' }).getByText('€36', { exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    expect(await everything(page)).toEqual(before);
    await page.goto('/entries');
    await expect(page.getByRole('region', { name: 'Entries' }).getByText('döner')).toBeVisible();
    // The manual rate came back next to the ECB one.
    await openSettings(page);
    await expect(page.getByText('1 € = 97 INR · set by you')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('refuses a file that is not a usable backup and changes nothing', async ({ page }) => {
    await completeSetup(page);
    await page.getByRole('textbox', { name: 'Quick add' }).fill('döner 6');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Eating out' }).click();
    await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');
    await openSettings(page);
    const before = await everything(page);

    await backupFileInput(page).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('shopping list: milk, bread'),
    });
    await expect(inlineAlert(page)).toHaveText(NOT_A_BACKUP);
    await expect(page.getByRole('button', { name: 'Yes' })).toHaveCount(0);
    expect(await everything(page)).toEqual(before);

    // A newer file replaces the message, and still asks nothing.
    await backupFileInput(page).setInputFiles({
      name: 'later.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ ...EMPTY_BACKUP, version: 2 })),
    });
    await expect(inlineAlert(page)).toHaveText(NEWER);
    await expect(page.getByRole('button', { name: 'Yes' })).toHaveCount(0);
    expect(await everything(page)).toEqual(before);

    // The right file after a wrong one clears the message and asks.
    await backupFileInput(page).setInputFiles({
      name: 'empty.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(EMPTY_BACKUP)),
    });
    await expect(page.getByText(QUESTION)).toBeVisible();
    await expect(inlineAlert(page)).toHaveCount(0);
    expect(await everything(page)).toEqual(before);
  });

  test('shares the file from inside the tap, and a closed share sheet is not an error', async ({ page }) => {
    await withShareSheet(page);
    const downloads = countDownloads(page);
    await completeSetup(page);
    await openSettings(page);

    await page.getByRole('button', { name: 'Export backup' }).click();
    await expect(page.getByRole('status')).toHaveText('Backup shared.');
    // inDispatch: the share was called while the click was still being handled, with no wait for the database.
    expect(await shareCalls(page)).toEqual([
      {
        name: FILE_NAME,
        type: 'application/json',
        title: 'StudentsBudget backup',
        inDispatch: true,
        text: expect.stringContaining('"app": "studentsbudget"'),
      },
    ]);

    // Closing the sheet says nothing, and starts no download behind the person's back.
    await setShareMode(page, 'abort');
    await page.getByRole('button', { name: 'Export backup' }).click();
    await expect(page.getByRole('button', { name: 'Export backup' })).toBeEnabled();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(inlineAlert(page)).toHaveCount(0);
    expect((await shareCalls(page)).map((call) => call.inDispatch)).toEqual([true, true]);
    expect(downloads.value).toBe(0);
  });

  test('offers a download by tap when the share sheet does not open, and claims nothing before it', async ({
    page,
  }, testInfo) => {
    await withShareSheet(page);
    const downloads = countDownloads(page);
    await completeSetup(page);
    await openSettings(page);
    await setShareMode(page, 'blocked');

    await page.getByRole('button', { name: 'Export backup' }).click();
    await expect(inlineAlert(page)).toContainText("The share sheet didn't open. You can download the file instead.");
    await expect(page.getByRole('status')).toHaveCount(0);
    // No second, programmatic download without a tap, and no second share.
    expect(downloads.value).toBe(0);
    expect(await shareCalls(page)).toHaveLength(1);

    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download instead' }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe(FILE_NAME);
    const filePath = testInfo.outputPath(FILE_NAME);
    await download.saveAs(filePath);
    expect(await readFile(filePath, 'utf8')).toContain('"app": "studentsbudget"');
    await expect(page.getByRole('status')).toHaveText(`Download started: ${FILE_NAME}`);
    await expect(inlineAlert(page)).toHaveCount(0);
    expect(downloads.value).toBe(1);
    expect(await shareCalls(page)).toHaveLength(1);
  });
});

test.describe('on a phone', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'Only the iphone project is a phone.');
  });

  test('the backup panel and the restore entry on /setup fit without sideways scrolling', async ({ page }) => {
    await page.goto('/setup');
    await expect(page.getByRole('heading', { level: 2, name: 'Restore from a backup' })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await backupFileInput(page).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a backup'),
    });
    await expect(inlineAlert(page)).toHaveText(NOT_A_BACKUP);
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await openSettings(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await backupFileInput(page).setInputFiles({
      name: 'empty.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(EMPTY_BACKUP)),
    });
    await expect(page.getByText(QUESTION)).toBeVisible();
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.getByLabel('Type DELETE to confirm')).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
