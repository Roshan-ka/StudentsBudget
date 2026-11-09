// The setup chat's side of the wizard (the AI phase, chunk 11, docs/superpowers/plans/2026-11-09-ai-phase-1.md): the
// draft as the chat sends it, and a turn's patch applied to it. Pure, so the chat (chunk 12) only wires them.
//
// `applyPatch` goes through the wizard's own helpers (`setRentAmount`, `setLineAmount`, `withAmount`,
// `withAccountKeys`), so a filled-in line is what typing the amount would give, "Add it automatically" included. It
// checks the patch again, as it should for anything that came over the network: a line outside its step's categories,
// an amount that isn't money or is over MAX_SETUP_AMOUNT, or an account the app can't hold is left out, and the rest
// still applies. Accounts change only in a new setup that has none stored. Nothing is saved: the student goes through
// the steps, where `validateStep` holds as always, and taps Save.

import { CURRENCIES, type CurrencyCode, type Minor } from '@/lib/money';
import { MAX_SETUP_AMOUNT, setupPatch, type SetupPatch } from '@/features/ai/contract';
import {
  FIXED_CATEGORIES,
  FLEXIBLE_CATEGORIES,
  INCOME_CATEGORIES,
  setLineAmount,
  setRentAmount,
  withAccountKeys,
  withAmount,
  type SetupDraft,
  type StepId,
} from './draft';

/** The largest starting balance a chat may fill in, either side of zero, in the account's currency. */
const MAX_BALANCE = 1_000_000;

/** One thing a patch filled in: its step, and the category, 'rent', 'budget' or 'accounts'. */
export type PatchChange = { step: StepId; what: string; minor?: Minor };

/** A line of the draft as the chat sends it. */
type ChatLine = { categoryId: string; monthlyEur: number | null };

/** The draft as the setup chat sends it: euros, null for a field whose text isn't an amount, no keys or schedules. */
export type ChatDraft = {
  rentEur: number | null;
  spendingBudgetEur: number | null;
  accounts: { name: string; kind: 'bank' | 'cash'; currency: string; balance: number | null }[];
  incomes: ChatLine[];
  fixed: ChatLine[];
  envelopes: ChatLine[];
};

const euros = (minor: Minor): number | null => (Number.isFinite(minor) ? minor / 100 : null);

export function draftForChat(d: SetupDraft): ChatDraft {
  const lines = (list: { categoryId: string; monthlyMinor: Minor }[]) =>
    list.map((line) => ({ categoryId: line.categoryId, monthlyEur: euros(line.monthlyMinor) }));
  return {
    rentEur: euros(d.rentMinor),
    spendingBudgetEur: euros(d.spendingBudgetMinor),
    accounts: d.accounts.map((a) => ({ name: a.name, kind: a.kind, currency: a.currency, balance: euros(a.openingMinor) })),
    incomes: lines(d.incomes),
    fixed: lines(d.fixed),
    envelopes: lines(d.envelopes),
  };
}

/** Cents for an amount the chat may fill in, or undefined. */
function minorOf(amount: number | null, max = MAX_SETUP_AMOUNT): Minor | undefined {
  if (amount === null || !Number.isFinite(amount) || amount < 0 || amount > max) return undefined;
  return Math.round(amount * 100);
}

const idsOf = (categories: { id: string }[]) => new Set(categories.map((c) => c.id));
const INCOME_IDS = idsOf(INCOME_CATEGORIES);
const FIXED_IDS = idsOf(FIXED_CATEGORIES);
const FLEXIBLE_IDS = idsOf(FLEXIBLE_CATEGORIES);

const isCurrency = (code: string): code is CurrencyCode => (CURRENCIES as string[]).includes(code);

/**
 * The draft with what one chat turn filled in, and the list of what it changed. `accountsExist` is the new setup's
 * own flag (accounts already stored in Settings): then the patch's accounts are left out. A patch that isn't one
 * changes nothing.
 */
export function applyPatch(
  draft: SetupDraft,
  patch: unknown,
  { accountsExist }: { accountsExist: boolean },
): { draft: SetupDraft; changes: PatchChange[] } {
  const read = setupPatch.safeParse(patch);
  if (!read.success) return { draft, changes: [] };
  const p: SetupPatch = read.data;
  let d = draft;
  const changes: PatchChange[] = [];

  const rent = minorOf(p.rent);
  if (rent !== undefined) {
    d = setRentAmount(d, rent);
    changes.push({ step: 'fixed', what: 'rent', minor: rent });
  }
  for (const line of p.incomes) {
    const minor = minorOf(line.amount);
    if (minor === undefined || !INCOME_IDS.has(line.categoryId)) continue;
    d = { ...d, incomes: setLineAmount(d.incomes, line.categoryId, minor) };
    changes.push({ step: 'income', what: line.categoryId, minor });
  }
  for (const line of p.fixed) {
    const minor = minorOf(line.amount);
    if (minor === undefined || !FIXED_IDS.has(line.categoryId)) continue;
    d = { ...d, fixed: setLineAmount(d.fixed, line.categoryId, minor) };
    changes.push({ step: 'fixed', what: line.categoryId, minor });
  }
  for (const line of p.envelopes) {
    const minor = minorOf(line.amount);
    if (minor === undefined || !FLEXIBLE_IDS.has(line.categoryId)) continue;
    d = { ...d, envelopes: withAmount(d.envelopes, line.categoryId, minor) };
    changes.push({ step: 'envelopes', what: line.categoryId, minor });
  }
  const budget = minorOf(p.spendingBudget);
  if (budget !== undefined) {
    d = { ...d, spendingBudgetMinor: budget };
    changes.push({ step: 'envelopes', what: 'budget', minor: budget });
  }

  if (!accountsExist && p.accounts !== null) {
    const accounts = p.accounts.flatMap((a) => {
      const name = a.name.trim();
      const currency = a.currency.trim().toUpperCase();
      const balance = Number.isFinite(a.balance) && Math.abs(a.balance) <= MAX_BALANCE ? Math.round(a.balance * 100) : undefined;
      if (name === '' || !isCurrency(currency) || balance === undefined) return [];
      return [{ name, kind: a.kind, currency, openingMinor: balance }];
    });
    if (accounts.length > 0) {
      d = withAccountKeys({ ...d, accounts });
      changes.push({ step: 'accounts', what: 'accounts' });
    }
  }

  return { draft: d, changes };
}
