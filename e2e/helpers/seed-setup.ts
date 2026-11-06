import type { Page } from '@playwright/test';
import type { Account, Plan } from '../../src/db/types';
import { sortAccounts } from '../../src/features/accounts/balances';
import { parseOptionalAmount, parseSignedAmount } from '../../src/features/accounts/opening-balance';
import {
  draftToRecords,
  initialDraft,
  setLineAmount,
  setLineSchedule,
  setRentAmount,
  validateStep,
  withAccountKeys,
  withAmount,
  type AccountOption,
  type DraftLine,
  type SetupDraft,
  type StepId,
} from '../../src/features/setup/draft';
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../../src/i18n/languages';
import { todayIso } from '../../src/lib/dates';
import type { Minor } from '../../src/lib/money';
import { openApp, waitForHome } from './app';
import { acceptPrivacyNotes } from './privacy';
import {
  DEFAULT_SETUP,
  FLEXIBLE_IDS,
  ensureClock,
  mockFrankfurter,
  readStore,
  type SetupFixture,
  type SetupOptions,
} from './setup';

/** A field's text as the wizard's amount field reads it: blank is 0, text that is no amount is `NaN` (refused below). */
const amount = (text: string): Minor => parseOptionalAmount(text) ?? Number.NaN;

/** "Add it automatically" unticked, as `fillSetup`'s `addByHand` leaves a line. The other choices stay. */
function byHand(lines: DraftLine[], categoryId: string): DraftLine[] {
  const schedule = lines.find((l) => l.categoryId === categoryId)?.schedule;
  return schedule ? setLineSchedule(lines, categoryId, { ...schedule, on: false }) : lines;
}

/**
 * The draft the wizard holds once `fillSetup` has typed `f` into it, built with the wizard's own functions, plus
 * `f.oneOff` as Edit plan would add it. `lang` is the page's language, which names the prefilled accounts; `stored` are
 * the accounts already saved (`accountsExist`).
 */
function draftOf(f: SetupFixture, options: SetupOptions, lang: Language, stored: AccountOption[]): SetupDraft {
  let d = initialDraft(stored.length > 0, lang);
  d = setRentAmount(d, amount(f.rent));
  if (!options.schedules && d.rentSchedule && d.rentMinor > 0) d = { ...d, rentSchedule: { ...d.rentSchedule, on: false } };

  // Opening balances of the prefilled accounts, in order; the Accounts step is skipped when accounts exist.
  d = {
    ...d,
    accounts: d.accounts.map((a, i) => ({ ...a, openingMinor: parseSignedAmount(f.openingBalances[i]) ?? Number.NaN })),
  };

  let incomes = setLineAmount(d.incomes, 'income-parents', amount(f.incomes.parents));
  incomes = setLineAmount(incomes, 'income-job', amount(f.incomes.job));
  if (!options.schedules) incomes = byHand(byHand(incomes, 'income-parents'), 'income-job');

  // A new setup asks no one-off cost; Edit plan's step adds this one on the setup day. A row without an amount is left
  // out when saving.
  const oneOffs: SetupDraft['oneOffs'] = [
    { name: f.oneOff.name, amountMinor: amount(f.oneOff.amount), dueMonth: f.oneOff.dueMonth },
  ];

  let envelopes = d.envelopes;
  for (const id of FLEXIBLE_IDS) envelopes = withAmount(envelopes, id, amount(f.envelopes[id]));

  return withAccountKeys({ ...d, incomes, oneOffs, spendingBudgetMinor: amount(f.budget), envelopes });
}

/** The new setup's steps, and Edit plan's one-off costs for `f.oneOff`; one the wizard would refuse stops the seed. */
const STEPS: StepId[] = ['accounts', 'income', 'fixed', 'one-offs', 'envelopes'];

/** Writes the rows in one transaction, as `saveWizard` does: the accounts are added and the plan put. */
async function writeSetup(page: Page, rows: { accounts: Account[]; plan: Plan }) {
  await page.evaluate(
    ({ accounts, plan }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('studentsbudget');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction(['accounts', 'plan'], 'readwrite');
          for (const account of accounts) transaction.objectStore('accounts').add(account);
          transaction.objectStore('plan').put(plan);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        };
      }),
    rows,
  );
}

/**
 * Sets up a plan from `DEFAULT_SETUP` (or the overrides) without walking the wizard: the same rows the wizard's Save
 * writes, built in Node with its own `draftToRecords` from the draft `fillSetup` would type, with `f.oneOff` added as
 * Edit plan would on the setup day (so the fixture's numbers stay), then written straight into IndexedDB from /tips. Ends on Home with the plan shown, as `completeSetup` does. Same fixture, options and
 * preparation: mocks Frankfurter, accepts the exchange-rate note only, and pins the date to `SETUP_DAY` unless the
 * caller set `page.clock` first. setup.spec.ts checks that both write the same rows.
 */
export async function seedSetup(page: Page, overrides: Partial<SetupFixture> = {}, options: SetupOptions = {}) {
  const f: SetupFixture = { ...DEFAULT_SETUP, ...overrides };
  await mockFrankfurter(page);
  await acceptPrivacyNotes(page, ['rates']);
  await ensureClock(page);

  // Any page creates the database. Not / or /setup: each reads the plan once as it opens and navigates to the other
  // by what it finds, so a read that lands after the write below would send the page away under the next goto
  // ("interrupted by another navigation"). Tips reads nothing from the database.
  await openApp(page, '/tips');
  const { now, lang } = await page.evaluate(() => ({ now: Date.now(), lang: document.documentElement.lang }));
  const language: Language = lang in LANGUAGES ? (lang as Language) : DEFAULT_LANGUAGE;
  // The accounts already saved, as the wizard reads them: in their order, with kind and default mark.
  const stored: AccountOption[] = sortAccounts(await readStore<Account>(page, 'accounts')).map(
    ({ id, name, currency, kind, isDefault }) => ({ id, name, currency, kind, ...(isDefault && { isDefault }) }),
  );
  if (options.accountsExist && stored.length === 0) throw new Error('seedSetup: accountsExist, but no account is saved');
  if (!options.accountsExist && stored.length > 0) throw new Error('seedSetup: accounts are saved; pass accountsExist');

  const draft = draftOf(f, options, language, stored);
  const today = todayIso(new Date(now));
  const steps = STEPS.filter((s) => !(s === 'accounts' && stored.length > 0));
  const problems = steps.flatMap((s) => validateStep(s, draft, today, undefined, stored, language));
  if (problems.length > 0) throw new Error(`seedSetup: the wizard would refuse this setup: ${problems.join(' ')}`);

  await writeSetup(page, draftToRecords(draft, today, undefined, stored, now));
  await openApp(page, '/');
  await waitForHome(page);
}
