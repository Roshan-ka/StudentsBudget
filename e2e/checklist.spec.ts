import { expect, test, type Page } from '@playwright/test';
import { CHECKLIST } from '../src/data/checklist';
import type { ChecklistTick } from '../src/db/types';
import { TIPS } from '../src/data/tips';
import { formatDate } from '../src/lib/dates';
import { aiSwitchedOff } from './helpers/ai';
import { openApp } from './helpers/app';
import { seedSetup } from './helpers/seed-setup';
import { mockFrankfurter, readStore } from './helpers/setup';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow, type ServerTables } from './helpers/supabase';

// The checklist for new students (checklist plan, chunk 6, docs/superpowers/plans/2026-11-10-checklist.md) at 375 px:
// the fourth tab on Tips, its ticks kept on the phone and, once linked, in the account.
test.use({ viewport: { width: 375, height: 812 } });

test.beforeEach(async ({ page }) => {
  await aiSwitchedOff(page);
});

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
/** A change reaches the account 3 s after it (at most 5 s), with starts 5 s apart: the schedule's own delays. */
const SENT_BY_ITSELF = { timeout: 15_000 };

const FIRST = CHECKLIST[0];
const WITH_TIP = CHECKLIST.find((item) => item.tipId !== undefined);

function checklistTab(page: Page, list = 'Tips, discounts, hacks or checklist', name = 'Checklist') {
  return page.getByRole('tablist', { name: list, exact: true }).getByRole('tab', { name, exact: true });
}

function panel(page: Page, name = 'Checklist') {
  return page.getByRole('tabpanel', { name, exact: true });
}

function tick(page: Page, title: string) {
  return panel(page).getByRole('checkbox', { name: `Done: ${title}`, exact: true });
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function openChecklist(page: Page) {
  await openApp(page, '/tips');
  await checklistTab(page).click();
  await expect(panel(page).getByRole('status')).toHaveText(new RegExp(`^\\d+ of ${CHECKLIST.length} done$`));
}

test('the checklist lists every item in its two groups, and a tick stays after a reload', async ({ page }) => {
  await seedSetup(page);
  await openChecklist(page);
  await expect(panel(page).getByRole('heading', { level: 3, name: 'First weeks', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('heading', { level: 3, name: 'Money to claim', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('heading', { level: 4 })).toHaveCount(CHECKLIST.length);
  await expect(panel(page).getByRole('status')).toHaveText(`0 of ${CHECKLIST.length} done`);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await tick(page, FIRST.title).check();
  await expect(panel(page).getByRole('status')).toHaveText(`1 of ${CHECKLIST.length} done`);
  const today = await page.evaluate(() => new Date().toLocaleDateString('sv'));
  await expect(panel(page).getByText(`Done on ${formatDate(today)}`, { exact: true })).toBeVisible();
  await expect.poll(() => readStore<ChecklistTick>(page, 'checklistTicks')).toEqual([{ itemId: FIRST.id, on: today }]);

  // The tab and the tick are both remembered.
  await page.reload();
  await expect(tick(page, FIRST.title)).toBeChecked();
  await expect(panel(page).getByRole('status')).toHaveText(`1 of ${CHECKLIST.length} done`);

  await tick(page, FIRST.title).uncheck();
  await expect(panel(page).getByRole('status')).toHaveText(`0 of ${CHECKLIST.length} done`);
  await expect.poll(() => readStore<ChecklistTick>(page, 'checklistTicks')).toEqual([]);
});

test('"See the tip" opens the Tips tab on that tip, with its heading focused', async ({ page }) => {
  if (WITH_TIP === undefined) throw new Error('no checklist item links to a tip');
  const tip = TIPS.find((t) => t.id === WITH_TIP.tipId);
  if (tip === undefined) throw new Error(`the tip ${WITH_TIP.tipId} is gone`);
  await seedSetup(page);
  await openChecklist(page);
  await panel(page).getByRole('button', { name: `See the tip: ${WITH_TIP.title}`, exact: true }).click();
  await expect(checklistTab(page, undefined, 'Tips')).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page, 'Tips').getByRole('heading', { level: 3, name: tip.title, exact: true })).toBeFocused();
  await expect(page.getByRole('group', { name: 'Show tips for' }).getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test.describe('on a phone set to German', () => {
  test.use({ locale: 'de-DE' });

  test('the checklist reads in German, with none of it marked English, and fits', async ({ page }) => {
    await seedSetup(page);
    await openApp(page, '/tips');
    await checklistTab(page, 'Tipps, Rabatte, Hacks oder Checkliste', 'Checkliste').click();
    const german = panel(page, 'Checkliste');
    await expect(german.getByRole('status')).toHaveText(`0 von ${CHECKLIST.length} erledigt`);
    await expect(german.getByRole('heading', { level: 3, name: 'Erste Wochen', exact: true })).toBeVisible();
    await expect(german.getByRole('heading', { level: 4, name: 'Melde deine Adresse an', exact: true })).toBeVisible();
    await expect(german.locator('[lang="en"]')).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});

test('on a linked phone a tick reaches the account by itself, and unticking leaves a tombstone', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockFrankfurter(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account: ServerTables = await mockSupabaseData(page);
  await seedSetup(page);
  await openApp(page, '/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Sync', exact: true }).getByText('Synced just now.', { exact: true })).toBeVisible();

  await openChecklist(page);
  await tick(page, FIRST.title).check();
  await expect.poll(() => (account.get('checklist_ticks')?.get(FIRST.id) as ChecklistTick | undefined)?.itemId, SENT_BY_ITSELF).toBe(
    FIRST.id,
  );

  await tick(page, FIRST.title).uncheck();
  await expect.poll(() => account.get('checklist_ticks')?.get(FIRST.id), SENT_BY_ITSELF).toBeNull();
});
