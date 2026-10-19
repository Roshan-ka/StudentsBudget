import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { Account, Category, Entry, Plan, Rate } from '../src/db/types';
import { completeSetup, readStore } from './helpers/setup';

// The clock is pinned to 2026-10-16 by `completeSetup`, so the file is named after that day.
const FILE_NAME = 'studentsbudget-backup-2026-10-16.json';
const QUESTION = `Replace all data with ${FILE_NAME}?`;
// Made on the pinned day with the 3 accounts and the 1 entry of the test.
const SUMMARY = /^Saved 16-10-2026, \d{2}:\d{2} · 3 accounts · 1 entry$/;
const NOT_A_BACKUP = "This isn't a StudentsBudget backup file.";
const NEWER = 'This backup is from a newer version of the app.';
const DAMAGED = "This backup file is damaged: an entry uses an account that isn't in the file.";

const EMPTY_BACKUP = {
  app: 'studentsbudget',
  version: 1,
  exportedAt: '2026-10-16T10:00:00.000Z',
  data: { accounts: [], categories: [], entries: [], plan: null, guesses: [], fxRates: [] },
};

function expenseOf(id: string, accountId: string) {
  return {
    id,
    type: 'expense',
    date: '2026-10-16',
    accountId,
    categoryId: 'food',
    amountMinor: 600,
    eurMinor: 600,
    note: '',
    createdAt: '2026-10-16T10:00:00.000Z',
  };
}

function accountOf(id: string) {
  return { id, name: id, kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: '2026-10-16T08:00:00.000Z' };
}

/** Good for the shape and for the references: 2 accounts and 3 entries. */
const GOOD_BACKUP = {
  ...EMPTY_BACKUP,
  data: {
    ...EMPTY_BACKUP.data,
    accounts: [accountOf('a1'), accountOf('a2')],
    entries: [expenseOf('e1', 'a1'), expenseOf('e2', 'a2'), expenseOf('e3', 'a1')],
  },
};

/** Right in shape, wrong in substance: its only entry uses an account the file does not have. */
const DAMAGED_BACKUP = { ...EMPTY_BACKUP, data: { ...EMPTY_BACKUP.data, entries: [expenseOf('e1', 'ghost')] } };

function jsonFile(name: string, content: unknown) {
  return { name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(content)) };
}

// Next adds its own role="alert" route announcer outside <main>; the messages under test are inside it.
function inlineAlert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

function backupFileInput(page: Page) {
  return page.getByLabel('File to restore');
}

function confirmation(page: Page) {
  return page.getByRole('group', { name: 'Confirm restore' });
}

type SlowReadWindow = Window & { slowReadsDone: number };

/**
 * Makes reading the one file called `fileName` take `delayMs` longer, so its result arrives after a file
 * chosen later has been read. `slowReadsDone` counts the slow reads that have handed their text back.
 */
async function withSlowRead(page: Page, fileName: string, delayMs: number) {
  await page.addInitScript(
    ({ slowName, delay }) => {
      const slowWindow = window as unknown as SlowReadWindow;
      slowWindow.slowReadsDone = 0;
      const original = Blob.prototype.text;
      Blob.prototype.text = async function text(this: Blob) {
        const content = await original.call(this);
        if (this instanceof File && this.name === slowName) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          slowWindow.slowReadsDone += 1;
        }
        return content;
      };
    },
    { slowName: fileName, delay: delayMs },
  );
}

/** Resolves once the slow read has finished and React has had two frames to show whatever it wrongly would. */
async function afterSlowRead(page: Page) {
  await page.waitForFunction(() => (window as unknown as SlowReadWindow).slowReadsDone > 0);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
    expect(file).toMatchObject({ app: 'studentsbudget', version: 2 });
    expect(file.data.entries.map((entry) => entry.note)).toEqual(['döner']);
    expect(file.data.fxRates.map((rate) => rate.source).sort()).toEqual(['ecb', 'manual']);
    expect(file.data.plan?.id).toBe('current');

    // Choosing the file asks first, naming the file and what it holds; Cancel changes nothing.
    await backupFileInput(page).setInputFiles(filePath);
    await expect(page.getByText(QUESTION)).toBeVisible();
    await expect(confirmation(page).getByText(SUMMARY)).toBeVisible();
    await confirmation(page).getByRole('button', { name: 'Cancel', exact: true }).click();
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
    await expect(page.getByRole('heading', { level: 2, name: 'Have a backup? Restore it' })).toBeVisible();
    const wiped = await everything(page);
    expect(wiped.accounts).toEqual([]);
    expect(wiped.entries).toEqual([]);
    expect(wiped.plan).toEqual([]);
    expect(wiped.fxRates).toEqual([]);
    expect(wiped.categories).toHaveLength(26);

    // Restore from the file, without setting up first.
    await backupFileInput(page).setInputFiles(filePath);
    await expect(page.getByText(QUESTION)).toBeVisible();
    await confirmation(page).getByRole('button', { name: 'Replace all data', exact: true }).click();

    // The restored plan is home again, and the entry is in the list. The stores below are the proof of the restore.
    await expect(page).toHaveURL('/');
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
    await expect(page.getByRole('button', { name: 'Replace all data' })).toHaveCount(0);
    expect(await everything(page)).toEqual(before);

    // A newer file replaces the message, and still asks nothing.
    await backupFileInput(page).setInputFiles(jsonFile('later.json', { ...EMPTY_BACKUP, version: 3 }));
    await expect(inlineAlert(page)).toHaveText(NEWER);
    await expect(page.getByRole('button', { name: 'Replace all data' })).toHaveCount(0);
    expect(await everything(page)).toEqual(before);

    // A file whose rows contradict each other says what is wrong, and asks nothing either.
    await backupFileInput(page).setInputFiles(jsonFile('damaged.json', DAMAGED_BACKUP));
    await expect(inlineAlert(page)).toHaveText(DAMAGED);
    await expect(page.getByRole('button', { name: 'Replace all data' })).toHaveCount(0);
    expect(await everything(page)).toEqual(before);

    // The right file after a wrong one clears the message and asks.
    await backupFileInput(page).setInputFiles(jsonFile('empty.json', EMPTY_BACKUP));
    await expect(page.getByText('Replace all data with empty.json?')).toBeVisible();
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

// A time stamp in UTC reads the same in the confirmation whatever the machine's zone is.
test.describe('choosing a file to restore, on every screen size', () => {
  test.use({ timezoneId: 'Europe/Berlin' });

  test('the last file chosen wins: a damaged file that is read slowly cannot bring its error back', async ({ page }) => {
    await withSlowRead(page, 'slow-damaged.json', 600);
    await page.goto('/setup');

    // The damaged file is still being read when the good one is chosen; the good one is read, shown and asked about first.
    await backupFileInput(page).setInputFiles(jsonFile('slow-damaged.json', DAMAGED_BACKUP));
    await expect(page.getByText('Reading…', { exact: true })).toBeVisible();
    await backupFileInput(page).setInputFiles(jsonFile('good.json', GOOD_BACKUP));
    await expect(page.getByText('Replace all data with good.json?')).toBeVisible();
    await expect(confirmation(page).getByText('Saved 16-10-2026, 12:00 · 2 accounts · 3 entries')).toBeVisible();

    await afterSlowRead(page);
    await expect(inlineAlert(page)).toHaveCount(0);
    await expect(page.getByText('Replace all data with good.json?')).toBeVisible();
    await expect(page.getByText('Reading…', { exact: true })).toHaveCount(0);
  });

  test('the last file chosen wins the other way round too: a good file read slowly cannot hide a later error', async ({
    page,
  }) => {
    await withSlowRead(page, 'slow-good.json', 600);
    await page.goto('/setup');

    await backupFileInput(page).setInputFiles(jsonFile('slow-good.json', GOOD_BACKUP));
    await backupFileInput(page).setInputFiles(jsonFile('damaged.json', DAMAGED_BACKUP));
    await expect(inlineAlert(page)).toHaveText(DAMAGED);

    await afterSlowRead(page);
    await expect(inlineAlert(page)).toHaveText(DAMAGED);
    await expect(confirmation(page)).toHaveCount(0);
    await expect(page.getByText('Reading…', { exact: true })).toHaveCount(0);
  });

  test('says "Reading…" while a file is read, and an error and a confirmation take each other away', async ({
    page,
  }) => {
    await withSlowRead(page, 'slow-good.json', 600);
    await page.goto('/setup');

    await backupFileInput(page).setInputFiles(jsonFile('slow-good.json', GOOD_BACKUP));
    await expect(page.getByText('Reading…', { exact: true })).toBeVisible();
    await expect(page.getByText('Replace all data with slow-good.json?')).toBeVisible();
    await expect(page.getByText('Reading…', { exact: true })).toHaveCount(0);

    // An error takes an earlier question away ...
    await backupFileInput(page).setInputFiles(jsonFile('damaged.json', DAMAGED_BACKUP));
    await expect(inlineAlert(page)).toHaveText(DAMAGED);
    await expect(confirmation(page)).toHaveCount(0);

    // ... and a question takes an earlier error away.
    await backupFileInput(page).setInputFiles(jsonFile('good.json', GOOD_BACKUP));
    await expect(page.getByText('Replace all data with good.json?')).toBeVisible();
    await expect(inlineAlert(page)).toHaveCount(0);
  });

  test('the confirmation names the file, gives its date as DD-MM-YYYY with the time, and counts what is in it', async ({
    page,
  }) => {
    await page.goto('/setup');

    await backupFileInput(page).setInputFiles(jsonFile('studentsbudget-backup-2026-10-19.json', GOOD_BACKUP));

    const question = page.getByText('Replace all data with studentsbudget-backup-2026-10-19.json?');
    await expect(question).toBeVisible();
    await expect(question.locator('strong')).toHaveText('studentsbudget-backup-2026-10-19.json');
    await expect(confirmation(page).getByText('Saved 16-10-2026, 12:00 · 2 accounts · 3 entries')).toBeVisible();
    await expect(confirmation(page).getByRole('button')).toHaveText(['Replace all data', 'Cancel']);
    await confirmation(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(confirmation(page)).toHaveCount(0);
  });

  test('the restore section sits below the wizard on /setup, under its own heading', async ({ page }) => {
    await page.goto('/setup');
    const restore = page.getByRole('heading', { level: 2, name: 'Have a backup? Restore it' });
    await expect(restore).toBeVisible();

    // The wizard has headings of its own, and every one of them comes before the restore heading.
    const headings = page.getByRole('main').getByRole('heading');
    await expect.poll(() => headings.count()).toBeGreaterThan(1);
    await expect(headings.last()).toHaveText('Have a backup? Restore it');
    const restoreTop = (await restore.boundingBox())?.y ?? 0;
    const wizardTop = (await headings.first().boundingBox())?.y ?? Number.POSITIVE_INFINITY;
    expect(restoreTop).toBeGreaterThan(wizardTop);
  });
});

test.describe('on a phone', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'Only the iphone project is a phone.');
  });

  test('the backup panel and the restore entry on /setup fit without sideways scrolling', async ({ page }) => {
    const longName = `${'a-long-backup-file-name-'.repeat(5)}.json`;
    await page.goto('/setup');
    await expect(page.getByRole('heading', { level: 2, name: 'Have a backup? Restore it' })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await backupFileInput(page).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a backup'),
    });
    await expect(inlineAlert(page)).toHaveText(NOT_A_BACKUP);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await backupFileInput(page).setInputFiles(jsonFile('damaged.json', DAMAGED_BACKUP));
    await expect(inlineAlert(page)).toHaveText(DAMAGED);
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await openSettings(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    // A long file name wraps inside the question instead of pushing the page sideways.
    await backupFileInput(page).setInputFiles(jsonFile(longName, EMPTY_BACKUP));
    await expect(page.getByText(`Replace all data with ${longName}?`)).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.getByLabel('Type DELETE to confirm')).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
