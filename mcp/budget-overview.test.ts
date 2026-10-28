import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BackupData } from '@/db/bulk';
import { sortAccounts } from '@/features/accounts/balances';
import { parseBackup } from '@/features/backup/backup';
import { weekToSpend } from '@/lib/budget';
import { StoreError, type UserDataStore } from '@/sync/store';
import { fakeStore, snapshot } from '@/sync/test-helpers';
import { applyUpload, planUpload } from '@/sync/upload';
import { AccountProblem, accountFromEnv, readAccountSettings, type ReadAccount } from './account.ts';
import type { BudgetOverview } from './budget.ts';
import { call, connect } from './test-client.ts';

// The demo pack's everyday student, saved to a fake account the way the app's Save writes it. On the pack's day
// (21-10-2026) the pack documents €138.10 left in October, and its balances.
const DEMO_DAY = '2026-10-21';
const SAVED_AT = '2026-10-21T09:30:00.000Z';

function demo(): BackupData {
  const parsed = parseBackup(readFileSync('fixtures/manual-demo/valid/01-everyday-student.json', 'utf8'));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

async function savedAccount(data: BackupData | null): Promise<{ read: ReadAccount; store: UserDataStore }> {
  const { store } = fakeStore();
  if (data !== null) await applyUpload(store, await planUpload(store, data));
  const read: ReadAccount = (task) => task({ store, lastSavedAt: async () => (data === null ? null : SAVED_AT) });
  return { read, store };
}

async function overview(read: ReadAccount, today = DEMO_DAY) {
  return call<BudgetOverview>(await connect(today, read), 'budget_overview');
}

describe('budget_overview', () => {
  it('gives Home’s figures for the saved data, as of the last save', async () => {
    const data = demo();
    const { isError, text, data: o } = await overview((await savedAccount(data)).read);
    expect(isError).toBe(false);
    expect(o.state).toBe('ready');
    expect(o.savedAt).toBe(SAVED_AT);
    expect(o.note).toContain('as of their last Save from the phone');
    expect(o.note).toContain('Last saved on 21-10-2026.');

    const b = o.budget!;
    expect(b.month).toBe('2026-10');
    expect(b.leftThisMonth).toEqual({ amount: '€138.10', minor: 13810 });
    const week = weekToSpend(data.plan!, data.entries, DEMO_DAY);
    expect(b.thisWeek).toMatchObject({ start: week.weekStart, end: week.weekEnd, minor: week.totalMinor });

    // Shopping is over in the demo month, and says so calmly.
    expect(b.envelopes.find((e) => e.categoryId === 'shopping')).toMatchObject({
      category: 'Shopping',
      planned: '€60.00',
      spent: '€95.00',
      left: '€35.00 over',
    });
    expect(text).toContain('- Shopping: €95.00 of €60.00, €35.00 over');
    // The figures themselves; the note above them asks the model never to say these words.
    expect(text.slice(o.note.length)).not.toMatch(/fail|warning/i);
    // Categories the plan leaves at €0 with nothing spent are left out.
    expect(b.envelopes.every((e) => e.plannedMinor !== 0 || e.spentMinor !== 0)).toBe(true);
  });

  it('gives each account’s balance in its own currency, and the total at the account’s manual rate', async () => {
    const data = demo();
    const { data: o } = await overview((await savedAccount(data)).read);
    // In the order Settings lists them.
    expect(o.budget!.accounts.map((a) => a.name)).toEqual(sortAccounts(data.accounts).map((a) => a.name));
    expect(Object.fromEntries(o.budget!.accounts.map((a) => [a.name, a.balance]))).toEqual({
      'Local bank (demo)': '€1,680.22',
      'Home bank (demo)': '₹170,050.00',
      'Cash (demo)': '€143.00',
    });
    expect(o.budget!.totalInEur).toEqual({ amount: '€3,613.22', minor: 361322, missingRates: [] });
  });

  it('leaves a currency without a manual rate out of the total, and names it', async () => {
    const data = { ...demo(), fxRates: [] };
    const { data: o } = await overview((await savedAccount(data)).read);
    expect(o.budget!.totalInEur).toMatchObject({ minor: 168022 + 14300, missingRates: ['INR'] });
    expect(o.note).toContain('totalInEur leaves out the currencies in missingRates');
  });

  it('says so when the account has nothing saved, or a save stopped halfway', async () => {
    const empty = await overview((await savedAccount(null)).read);
    expect(empty.data).toMatchObject({ state: 'empty', budget: null, savedAt: null });
    expect(empty.data.note).toContain('Save to my account');

    const { store } = fakeStore({ entries: { e1: snapshot().entries[0] } });
    const halfway = await overview((task) => task({ store, lastSavedAt: async () => null }));
    expect(halfway.data).toMatchObject({ state: 'unfinished', budget: null });
  });

  it('shows nothing from an account whose rows aren’t the app’s data', async () => {
    const { store } = await savedAccount(demo());
    await store.upsert('entries', [{ id: 'broken', data: { amountMinor: 'lots' } }]);
    const { data: o } = await overview((task) => task({ store, lastSavedAt: async () => SAVED_AT }));
    expect(o).toMatchObject({ state: 'invalid', budget: null });
    expect(o.note).toContain("a row of entries isn't the app's data");
  });

  it('turns a problem reading the account into a state with a calm note', async () => {
    const signInFailed: ReadAccount = async () => {
      throw new AccountProblem('sign-in-failed', 'Email or password is wrong.');
    };
    expect((await overview(signInFailed)).data).toMatchObject({ state: 'sign-in-failed', note: 'Email or password is wrong.' });

    const down: ReadAccount = async () => {
      throw new StoreError('plans', 0, '', 'fetch failed');
    };
    expect((await overview(down)).data).toMatchObject({
      state: 'unreachable',
      note: "Couldn't read the account. Check the connection and try again.",
    });
  });
});

describe('the account settings', () => {
  const full = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    STUDENTSBUDGET_MCP_EMAIL: ' a@example.com ',
    STUDENTSBUDGET_MCP_PASSWORD: 'test-password',
  };

  it('reads the project from the app’s two values and the sign-in from the server’s own two', () => {
    expect(readAccountSettings(full)).toEqual({
      url: full.NEXT_PUBLIC_SUPABASE_URL,
      publishableKey: 'sb_publishable_test',
      email: 'a@example.com',
      password: 'test-password',
    });
  });

  it('names what is missing, and never takes a secret key', async () => {
    expect(readAccountSettings({ ...full, STUDENTSBUDGET_MCP_PASSWORD: '' })).toEqual({ missing: ['STUDENTSBUDGET_MCP_PASSWORD'] });
    expect(readAccountSettings({ ...full, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' })).toEqual({
      missing: ['NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    });

    const { data: o } = await overview(accountFromEnv({}));
    expect(o.state).toBe('not-set-up');
    expect(o.note).toMatch(
      /^The server has no account to read: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, STUDENTSBUDGET_MCP_EMAIL and STUDENTSBUDGET_MCP_PASSWORD to \.env\.local/,
    );
  });
});
