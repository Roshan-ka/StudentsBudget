import { expect, test, type Page } from '@playwright/test';
import type { Account } from '../src/db/types';
import { readStore } from './helpers/setup';
import { E2E_USER_ID, mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow } from './helpers/supabase';

// Sync now (P2.2 chunk 6) at 375 px, against the mocked account. Nothing links a phone yet (linking is chunk 7), so the
// spec links it by writing the sync state straight into IndexedDB, as linking will.
test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

const FROM_ACCOUNT: Account = {
  id: 'from-account',
  name: 'Saved on the other phone',
  kind: 'bank',
  currency: 'EUR',
  openingMinor: 0,
  createdAt: '2026-10-29T08:00:00.000Z',
};

function syncRegion(page: Page) {
  return page.getByRole('region', { name: 'Sync', exact: true });
}

/** Links this phone to the mocked account, as linking (chunk 7) will: the sync state names the user, cursor 0. */
async function link(page: Page) {
  await page.evaluate(
    (userId) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('studentsbudget');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const transaction = open.result.transaction('syncState', 'readwrite');
          transaction.objectStore('syncState').put({ id: 'current', userId, cursor: 0, lastSyncedAt: null, problem: null });
          transaction.oncomplete = () => {
            open.result.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    E2E_USER_ID,
  );
}

test('a linked phone shows how its sync stands, and Sync now brings the account’s changes', async ({ page, context }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  // What the other phone saved.
  account.set('accounts', new Map([[FROM_ACCOUNT.id, FROM_ACCOUNT]]));

  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  // Not linked: no Sync section.
  await expect(syncRegion(page)).toHaveCount(0);

  await link(page);
  await page.reload();
  await expect(syncRegion(page).getByText('Not synced yet.', { exact: true })).toBeVisible();

  await syncRegion(page).getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  expect((await readStore<Account>(page, 'accounts')).map((a) => a.id)).toContain(FROM_ACCOUNT.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await context.setOffline(true);
  await expect(syncRegion(page).getByText('Offline. Changes made now wait on this phone.', { exact: true })).toBeVisible();
  await context.setOffline(false);

  // The Settings card says it too.
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Your account', exact: true });
  await expect(card.getByText('Synced just now.', { exact: true })).toBeVisible();
});
