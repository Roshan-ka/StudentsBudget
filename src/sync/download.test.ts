import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { downloadContents, loadErrorMessage, planDownload } from './download';
import { StoreError } from './store';
import { ECB, MANUAL, expense, fakeStore, snapshot } from './test-helpers';
import { applyUpload, planUpload } from './upload';

/** The plan a save always writes, so a test's other rows read as a finished save. */
const PLAN_ROW = { plans: { current: snapshot().plan } };

describe('planDownload', () => {
  it('gives back exactly what was saved, like a backup round trip', async () => {
    const { store } = fakeStore();
    const phoneA = snapshot();
    await applyUpload(store, await planUpload(store, phoneA));

    // Phone B is new: no data, and an ECB rate of its own from today.
    const ecbOnB = { ...ECB, perEur: 96, fetchedOn: '2026-10-26' };
    const empty = snapshot({
      accounts: [],
      entries: [],
      plan: null,
      guesses: [],
      fxRates: [ecbOnB],
      weekResults: [],
      discountVotes: [],
      profile: null,
    });
    const result = await planDownload(store, empty);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;

    const sortById = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
    expect(sortById(result.data.accounts)).toEqual(sortById(phoneA.accounts));
    expect(sortById(result.data.entries)).toEqual(sortById(phoneA.entries));
    expect(result.data.plan).toEqual(phoneA.plan);
    expect(result.data.guesses).toEqual(phoneA.guesses);
    expect(result.data.weekResults).toEqual(phoneA.weekResults);
    expect(result.data.discountVotes).toEqual(phoneA.discountVotes);
    expect(result.data.profile).toEqual(phoneA.profile);
    // The built-in categories come from the app, the manual rate from the account, and the ECB rate stays phone B's.
    expect(result.data.categories).toEqual(CATEGORIES);
    expect(result.data.fxRates).toEqual([ecbOnB, MANUAL]);
  });

  it('says so when the account has nothing saved', async () => {
    expect(await planDownload(fakeStore().store, snapshot())).toEqual({ kind: 'empty' });
  });

  it('calls rows without a plan an unfinished save: a save writes the plan last', async () => {
    const { store } = fakeStore({ accounts: { local: snapshot().accounts[0] }, entries: { e1: expense('e1') } });
    expect(await planDownload(store, snapshot())).toEqual({ kind: 'unfinished' });
  });

  it('refuses a row that is not the app’s data, and names its table', async () => {
    const { store } = fakeStore({ ...PLAN_ROW, entries: { e1: { ...expense('e1'), amountMinor: '6.50' } } });
    expect(await planDownload(store, snapshot())).toEqual({
      kind: 'invalid',
      problem: "a row of entries isn't the app's data",
    });
  });

  it('refuses a row filed under another id than its own key', async () => {
    const { store } = fakeStore({ ...PLAN_ROW, entries: { 'not-e1': expense('e1') } });
    expect(await planDownload(store, snapshot())).toEqual({
      kind: 'invalid',
      problem: 'a row of entries is filed under the wrong id',
    });
  });

  it('refuses an ECB rate in the manual rates', async () => {
    const { store } = fakeStore({ ...PLAN_ROW, manual_rates: { INR: ECB } });
    expect((await planDownload(store, snapshot())).kind).toBe('invalid');
  });

  it('refuses rows that do not fit together, as a damaged backup is refused', async () => {
    // An entry on an account the account does not have.
    const { store } = fakeStore({ ...PLAN_ROW, entries: { e1: expense('e1') } });
    expect(await planDownload(store, snapshot())).toEqual({
      kind: 'invalid',
      problem: "an entry uses an account that isn't in the file",
    });
  });

  it('only reads', async () => {
    const { store, calls } = fakeStore();
    await applyUpload(store, await planUpload(store, snapshot()));
    calls.length = 0;
    await planDownload(store, snapshot());
    expect(calls.every((call) => call.startsWith('read '))).toBe(true);
  });
});

describe('the lines the load shows', () => {
  it('sums up what the account holds', () => {
    expect(downloadContents(snapshot())).toBe('2 accounts, 3 entries and your plan');
    expect(downloadContents(snapshot({ entries: [expense('e1')], plan: null }))).toBe('2 accounts and 1 entry');
  });

  it('says calmly why a load did not work', () => {
    expect(loadErrorMessage(new StoreError('entries', 401, 'PGRST301', 'JWT expired'))).toBe(
      'Your sign-in has run out. Sign out, sign in again, then load.',
    );
    expect(loadErrorMessage(new TypeError('Failed to fetch'))).toBe(
      "Couldn't load from your account. Check your connection and try again.",
    );
  });
});
