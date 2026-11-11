import { expect, test, type Page } from '@playwright/test';
import type { PlanMonth } from '../src/db/types';
import { aiSwitchedOff } from './helpers/ai';
import { openApp } from './helpers/app';
import { seedSetup } from './helpers/seed-setup';
import { readStore } from './helpers/setup';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow } from './helpers/supabase';

// Plan history (docs/superpowers/plans/2026-11-10-plan-history.md, chunk 6) at 375 px: each month keeps the plan it
// had, so raising an envelope in November leaves October as it was. `seedSetup` creates the plan on Friday
// 2026-10-16 with food €310 and eating out €124 (€434 planned a month), and writes no history: the first save starts it.
test.use({ viewport: { width: 375, height: 812 } });

test.beforeEach(async ({ page }) => {
  await aiSwitchedOff(page);
});

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
/** A change reaches the account 3 s after it (at most 5 s), with starts 5 s apart: the schedule's own delays. */
const SENT_BY_ITSELF = { timeout: 15_000 };

/** Noon on a day, local time, as the clock the page should show. */
const noon = (iso: string) => new Date(`${iso}T12:00:00`);

function recaps(page: Page) {
  return page.getByRole('list', { name: 'Month by month', exact: true }).getByRole('listitem');
}

/** Sets the eating-out envelope on `day` through Edit plan's envelopes step, the way the recaps page leads there. */
async function setEatingOut(page: Page, day: string, euros: string) {
  await page.clock.setFixedTime(noon(day));
  await openApp(page, '/setup?edit=1&step=envelopes');
  await expect(page.getByRole('heading', { level: 3, name: 'Envelopes', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Eating out', exact: true }).fill(euros);
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  // Saved: Edit plan ends on Home.
  await expect(page.getByRole('textbox', { name: 'Quick add' })).toBeVisible();
}

const eatingOutOf = (row: PlanMonth) => row.envelopes.find((envelope) => envelope.categoryId === 'eating-out')?.monthlyMinor;

test('raising an envelope in November leaves October’s recap with the plan October had', async ({ page }) => {
  await seedSetup(page);
  // October: eating out down to €100, so October plans €410.
  await setEatingOut(page, '2026-10-20', '100');
  // November: eating out up to €200, so November and later plan €510.
  await setEatingOut(page, '2026-11-05', '200');

  // Each month that was saved in keeps its own row.
  const rows = (await readStore<PlanMonth>(page, 'planMonths')).sort((a, b) => a.month.localeCompare(b.month));
  expect(rows.map((row) => [row.month, eatingOutOf(row)])).toEqual([
    ['2026-10', 10000],
    ['2026-11', 20000],
  ]);

  // 2 December: both months are over, nothing was spent. Without plan history both would read €510.
  await page.clock.setFixedTime(noon('2026-12-02'));
  await openApp(page, '/reveal');
  await expect(recaps(page)).toHaveText([
    'November 2026: €510 left over → savings',
    'October 2026: €410 left over → savings',
  ]);
});

test('on a linked phone, the month’s plan reaches the account', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  await seedSetup(page);
  await setEatingOut(page, '2026-10-20', '100');

  // Linking sends the phone's data, its plan history with it.
  await openApp(page, '/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Sync', exact: true }).getByText('Synced just now.', { exact: true })).toBeVisible();
  expect(eatingOutOf(account.get('plan_months')?.get('2026-10') as PlanMonth)).toBe(10000);

  // A later change sends its month's row by itself.
  await setEatingOut(page, '2026-11-05', '200');
  await expect
    .poll(() => {
      const november = account.get('plan_months')?.get('2026-11') as PlanMonth | undefined;
      return november === undefined ? undefined : eatingOutOf(november);
    }, SENT_BY_ITSELF)
    .toBe(20000);
});
