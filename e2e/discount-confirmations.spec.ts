import { expect, test, type Page } from '@playwright/test';
import { DISCOUNTS } from '../src/data/discounts';
import { acceptPrivacyNotes } from './helpers/privacy';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow } from './helpers/supabase';

// Shared discount confirmations (P2.6, docs/superpowers/plans/2026-11-04-shared-discount-confirmations.md): signed in,
// the Discounts list shows other students' totals this semester. Supabase is mocked: `discount_confirmations` answers
// the totals given to `mockSupabaseData`. How they move the list is unit-tested (`discounts.test.ts`).

test.use({ viewport: { width: 375, height: 812 } });

// The data-protection notes (the exchange rates, the discount votes) have their own spec (privacy-notes.spec.ts).
test.beforeEach(async ({ page }) => {
  await acceptPrivacyNotes(page);
});

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
const PLACE = DISCOUNTS[0];

async function showDiscounts(page: Page) {
  await page.goto('/tips');
  const tab = page.getByRole('tablist', { name: 'Tips or discounts', exact: true }).getByRole('tab', { name: 'Discounts', exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

function item(page: Page) {
  return page
    .getByRole('list', { name: 'Discounts', exact: true })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name: PLACE.place, exact: true }) });
}

test('signed in, a discount says how many students confirmed it this semester', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, {
    confirmations: [{ discount_id: PLACE.id, last_works: PLACE.checked, works_since: 14, outdated_since: 2 }],
  });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();

  await showDiscounts(page);
  await expect(item(page).getByText('14 confirmations this semester', { exact: true })).toBeVisible();
  await expect(item(page).getByText('2 students said it no longer works', { exact: true })).toBeVisible();
  await expect(page.getByText('Sign in to see what other students confirmed.', { exact: true })).toHaveCount(0);
});

test('signed out, the list goes by this phone’s votes and says signing in shows others', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await showDiscounts(page);
  await expect(page.getByText('Sign in to see what other students confirmed.', { exact: true })).toBeVisible();
  await expect(item(page).getByText(/confirmations? this semester/)).toHaveCount(0);
});
