import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { BackupData } from '@/db/bulk';
import { sortAccounts } from '@/features/accounts/balances';
import { parseBackup } from '@/features/backup/backup';
import { planSummary, weekToSpend } from '@/lib/budget';
import { StoreError, type UserDataStore } from '@/sync/store';
import { fakeStore, snapshot } from '@/sync/test-helpers';
import { applyUpload, planUpload } from '@/sync/upload';
import {
  AccountProblem,
  accountFromEnv,
  accountFromSettings,
  needsSecondStep,
  readAccountSettings,
  readOnly,
  type ReadAccount,
} from './account.ts';
import type { BudgetOverview, RecentEntries } from './budget.ts';
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

    // An account with two-step sign-in shows a password-only session nothing: that is said, not read as "empty".
    const secondStep: ReadAccount = async () => {
      throw new AccountProblem('needs-second-step', 'This account uses two-step sign-in.');
    };
    for (const tool of ['budget_overview', 'recent_entries', 'week_check_in']) {
      const { data } = await call<{ state: string; note: string }>(await connect(DEMO_DAY, secondStep), tool);
      expect(data, tool).toMatchObject({ state: 'needs-second-step', note: 'This account uses two-step sign-in.' });
    }

    // The rest also leaves a trace on stderr, which stays quiet here.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = (error: unknown): ReadAccount => async () => {
      throw error;
    };
    expect((await overview(failing(new StoreError('plans', 0, '', 'fetch failed')))).data).toMatchObject({
      state: 'unreachable',
      note: "Couldn't reach the account. Check the connection and try again.",
    });
    // An answer that says no is not a connection problem.
    expect((await overview(failing(new StoreError('plans', 403, '42501', 'permission denied')))).data).toMatchObject({
      state: 'refused',
      note: 'The account refused the read (HTTP 403, 42501): plans: permission denied.',
    });
    expect((await overview(failing(new TypeError('x is not a function')))).data).toMatchObject({
      state: 'error',
      note: "Couldn't read the account: x is not a function",
    });
    expect(quiet).toHaveBeenCalledTimes(3);
    quiet.mockRestore();
  });

  it('gives no total when no account’s currency could be converted, as Home and Settings', async () => {
    const data = demo();
    const allInRupees = { ...data, accounts: data.accounts.map((a) => ({ ...a, currency: 'INR' as const })), fxRates: [] };
    const { text, data: o } = await overview((await savedAccount(allInRupees)).read);
    expect(o.budget!.totalInEur).toEqual({ amount: null, minor: null, missingRates: ['INR'] });
    expect(text).toContain('No total in euros');
    expect(o.note).toContain('its amount is null when nothing could be converted');
  });

  it('weighs the plan against what the month brings in, and says when the envelopes plan more', async () => {
    const data = demo();
    const plain = await overview((await savedAccount(data)).read);
    const summary = planSummary(data.plan!, '2026-10');
    expect(plain.data.budget!.plan).toEqual({
      available: { amount: expect.any(String), minor: summary.availableMinor },
      envelopes: { amount: expect.any(String), minor: summary.envelopesMinor },
      overBy: { amount: expect.any(String), minor: summary.overByMinor },
    });

    const plan = { ...data.plan!, envelopes: data.plan!.envelopes.map((e) => ({ ...e, monthlyMinor: e.monthlyMinor + 100_000 })) };
    const over = await overview((await savedAccount({ ...data, plan })).read);
    const overBy = over.data.budget!.plan.overBy;
    expect(overBy.minor).toBe(planSummary(plan, '2026-10').overByMinor);
    expect(overBy.minor).toBeGreaterThan(0);
    expect(over.text).toContain(`, ${overBy.amount} more than the `);
  });
});

describe('the account session', () => {
  const settings = { url: 'https://x.supabase.co', publishableKey: 'sb_publishable_x', email: 'a@example.com', password: 'p' };
  const reader = { store: fakeStore().store, lastSavedAt: async () => null };

  it('knows a session that still owes the second step', () => {
    // The account has a verified factor, and only the password was given.
    expect(needsSecondStep({ currentLevel: 'aal1', nextLevel: 'aal2' })).toBe(true);
    // The code was given; or the account has no factor; or an unconfirmed one only (next level stays aal1).
    expect(needsSecondStep({ currentLevel: 'aal2', nextLevel: 'aal2' })).toBe(false);
    expect(needsSecondStep({ currentLevel: 'aal1', nextLevel: 'aal1' })).toBe(false);
    expect(needsSecondStep(null)).toBe(false);
  });

  it('signs in once for many reads, and doesn’t keep a sign-in that failed', async () => {
    let signIns = 0;
    const read = accountFromSettings(settings, async () => {
      signIns += 1;
      if (signIns === 1) throw new AccountProblem('unreachable', 'The account server can’t be reached.');
      return reader;
    });
    await expect(read(async () => 'x')).rejects.toThrow('can’t be reached');
    expect(await read(async () => 'a')).toBe('a');
    expect(await read(async () => 'b')).toBe('b');
    expect(signIns).toBe(2);
  });

  it('signs in afresh and tries once more after a 401, and never loops', async () => {
    let signIns = 0;
    const read = accountFromSettings(settings, async () => {
      signIns += 1;
      return reader;
    });
    let tries = 0;
    expect(
      await read(async () => {
        tries += 1;
        if (tries === 1) throw new StoreError('plans', 401, 'PGRST301', 'JWT expired');
        return 'read';
      }),
    ).toBe('read');
    expect([tries, signIns]).toEqual([2, 2]);

    tries = 0;
    await expect(
      read(async () => {
        tries += 1;
        throw new StoreError('plans', 401, 'PGRST301', 'JWT expired');
      }),
    ).rejects.toThrow('JWT expired');
    expect(tries).toBe(2);
  });

  it('passes any other error on without signing in again', async () => {
    for (const error of [new StoreError('plans', 403, '42501', 'no'), new StoreError('plans', 0, '', 'fetch failed')]) {
      let signIns = 0;
      let tries = 0;
      const read = accountFromSettings(settings, async () => {
        signIns += 1;
        return reader;
      });
      await expect(
        read(async () => {
          tries += 1;
          throw error;
        }),
      ).rejects.toBe(error);
      expect([tries, signIns]).toEqual([1, 1]);
    }
  });

  it('only ever reads: the tools list and read, and the store refuses writes', async () => {
    const { store, calls } = fakeStore();
    await applyUpload(store, await planUpload(store, demo()));
    calls.length = 0;
    const read: ReadAccount = (task) => task({ store: readOnly(store), lastSavedAt: async () => SAVED_AT });
    await overview(read);
    await call(await connect(DEMO_DAY, read), 'recent_entries');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.startsWith('read ') || c.startsWith('list '))).toBe(true);
    await expect(readOnly(store).upsert('entries', [])).rejects.toThrow('only reads the account');
    await expect(readOnly(store).tombstone('entries', ['x'])).rejects.toThrow('only reads the account');
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

describe('recent_entries', () => {
  async function entries(read: ReadAccount, args: Record<string, unknown> = {}, today = DEMO_DAY) {
    return call<RecentEntries>(await connect(today, read), 'recent_entries', args);
  }

  it('lists this month’s entries newest first, each with its account, amounts and note', async () => {
    const data = demo();
    const october = data.entries.filter((e) => e.date.startsWith('2026-10'));
    const { isError, data: r } = await entries((await savedAccount(data)).read);
    expect(isError).toBe(false);
    expect(r).toMatchObject({ state: 'ready', savedAt: SAVED_AT, month: '2026-10', found: october.length });
    expect(r.entries).toHaveLength(october.length);
    const dates = r.entries.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(r.note).toMatch(/^24 entries in 2026-10\. The user’s own entries/);
    expect(r.note).toContain('Last saved on 21-10-2026.');
  });

  it('adds up to what budget_overview counts as spent, for one category', async () => {
    const { read } = await savedAccount(demo());
    const { data: r } = await entries(read, { category: 'shopping' });
    expect(r.entries.every((e) => e.type === 'expense' && e.category === 'Shopping')).toBe(true);
    const { data: o } = await overview(read);
    const shopping = o.budget!.envelopes.find((e) => e.categoryId === 'shopping')!;
    // In euros: one of them was paid from the INR account, so its amount is in rupees.
    expect(r.entries.reduce((n, e) => n + e.eurMinor, 0)).toBe(shopping.spentMinor);
    expect(r.entries.some((e) => e.amount.startsWith('₹'))).toBe(true);
    expect(r.note).toContain('add up eurMinor, never amountMinor');
    expect(r.note).toMatch(/^\d+ Shopping entries in 2026-10\./);
  });

  it('shows a transfer as a move between two accounts, with no category', async () => {
    const { data: r } = await entries((await savedAccount(demo())).read);
    const transfer = r.entries.find((e) => e.type === 'transfer');
    expect(transfer).toMatchObject({ categoryId: null, category: null, automatic: false });
    expect(transfer?.toAccount).not.toBeNull();
    expect(transfer?.toAmount).not.toBeNull();
  });

  it('takes another month and a limit, and says how many it left out', async () => {
    const data = demo();
    const september = data.entries.filter((e) => e.date.startsWith('2026-09')).length;
    const { text, data: r } = await entries((await savedAccount(data)).read, { month: '2026-09', limit: 5 });
    expect(r).toMatchObject({ month: '2026-09', found: september });
    expect(r.entries).toHaveLength(5);
    expect(r.note).toMatch(new RegExp(`^${september} entries in 2026-09, the newest 5 shown\\.`));
    expect(text.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(5);
  });

  it('refuses a month that isn’t one, and shows nothing from an account it can’t read', async () => {
    const client = await connect(DEMO_DAY, (await savedAccount(demo())).read);
    expect((await client.callTool({ name: 'recent_entries', arguments: { month: '2026-13' } })).isError).toBe(true);
    expect((await client.callTool({ name: 'recent_entries', arguments: { limit: 0 } })).isError).toBe(true);

    const { data: r } = await entries((await savedAccount(null)).read);
    expect(r).toMatchObject({ state: 'empty', found: 0, entries: [], savedAt: null });
  });

  it('marks the expenses from before the setup day, which the budget leaves out', async () => {
    const data = demo();
    // As if the plan had been set up on 10 October: October spending counts from that day on.
    const plan = { ...data.plan!, createdOn: '2026-10-10' };
    const { read } = await savedAccount({ ...data, plan });
    const { data: r } = await entries(read, { category: 'shopping' });
    expect(r.entries.map((e) => [e.date, e.beforeSetup])).toEqual([
      ['2026-10-17', false],
      ['2026-10-08', true],
    ]);
    const { data: o } = await overview(read);
    const counted = r.entries.filter((e) => !e.beforeSetup).reduce((n, e) => n + e.eurMinor, 0);
    expect(counted).toBe(o.budget!.envelopes.find((e) => e.categoryId === 'shopping')!.spentMinor);
    expect(r.note).toContain('beforeSetup: true marks an expense from before the plan was set up');
  });
});
