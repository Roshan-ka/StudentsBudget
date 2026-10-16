import { CATEGORIES } from '@/data/categories';
import type { Account, Amount, Category, Guess, OneOff, Plan } from '@/db/types';
import { planSummary, type PlanSummary } from '@/lib/budget';
import { monthOf, todayIso, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';

/**
 * What the wizard holds while the person fills it in. Nothing is stored until Save.
 *
 * A `NaN` amount stands for text in a field that did not parse. `validateStep` rejects it with a
 * message, so the draft alone decides whether a step may be left.
 *
 * `accounts` and `guesses` stay empty in edit mode: accounts are edited in Settings, guesses are locked.
 * A one-off that carries an `id` came from the saved plan and keeps its `createdMonth` when saved again.
 */
export type SetupDraft = {
  rentMinor: Minor;
  accounts: Pick<Account, 'name' | 'kind' | 'currency' | 'openingMinor'>[];
  incomes: Amount[];
  fixed: Amount[];
  oneOffs: (Pick<OneOff, 'name' | 'amountMinor' | 'dueMonth'> & { id?: string })[];
  guesses: Amount[];
  envelopes: Amount[];
};

export type DraftUpdate = (change: (d: SetupDraft) => SetupDraft) => void;

export type StepId = 'city-rent' | 'accounts' | 'income' | 'fixed' | 'one-offs' | 'guesses' | 'envelopes';

const ofKind = (kind: Category['kind']): Category[] => CATEGORIES.filter((c) => c.kind === kind);

export const FLEXIBLE_CATEGORIES = ofKind('flexible');
export const INCOME_CATEGORIES = ofKind('income');
/** The fixed costs step asks for these; rent has its own question in step 1. */
export const FIXED_CATEGORIES = ofKind('fixed').filter((c) => c.id !== 'rent');

const NAME_OF = new Map(CATEGORIES.map((c) => [c.id, c.name]));
const ORDER_OF = new Map(CATEGORIES.map((c) => [c.id, c.order]));

const nameOf = (categoryId: string): string => NAME_OF.get(categoryId) ?? categoryId;

/** The amount a list holds for a category, or `undefined` when it has no row for it. */
export function amountOf(list: Amount[], categoryId: string): Minor | undefined {
  return list.find((a) => a.categoryId === categoryId)?.monthlyMinor;
}

/** Sets a row, or removes it when `minor` is `undefined`. Rows stay in category order. */
export function withAmount(list: Amount[], categoryId: string, minor: Minor | undefined): Amount[] {
  const rest = list.filter((a) => a.categoryId !== categoryId);
  if (minor === undefined) return rest;
  return [...rest, { categoryId, monthlyMinor: minor }].sort(
    (a, b) => (ORDER_OF.get(a.categoryId) ?? 0) - (ORDER_OF.get(b.categoryId) ?? 0),
  );
}

export function initialDraft(): SetupDraft {
  return {
    rentMinor: 0,
    accounts: [
      { name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 0 },
      { name: 'Home bank', kind: 'bank', currency: 'INR', openingMinor: 0 },
      { name: 'Cash', kind: 'cash', currency: 'EUR', openingMinor: 0 },
    ],
    incomes: [],
    fixed: [],
    oneOffs: [],
    // A blank guess is not a 0: guesses are saved once, so every one has to be answered.
    guesses: [],
    envelopes: FLEXIBLE_CATEGORIES.map((c) => ({ categoryId: c.id, monthlyMinor: 0 })),
  };
}

/** The draft for edit mode, filled from the saved plan. */
export function draftFromPlan(plan: Plan): SetupDraft {
  return {
    rentMinor: amountOf(plan.fixed, 'rent') ?? 0,
    accounts: [],
    incomes: plan.incomes.map((a) => ({ ...a })),
    fixed: plan.fixed.filter((a) => a.categoryId !== 'rent').map((a) => ({ ...a })),
    oneOffs: plan.oneOffs.map(({ id, name, amountMinor, dueMonth }) => ({ id, name, amountMinor, dueMonth })),
    guesses: [],
    envelopes: FLEXIBLE_CATEGORIES.map((c) => ({
      categoryId: c.id,
      monthlyMinor: amountOf(plan.envelopes, c.id) ?? 0,
    })),
  };
}

/**
 * The records the wizard saves. With `existing` (edit mode) the plan keeps its creation date, and each
 * one-off that is still there keeps its `id` and `createdMonth`, so editing does not relock the reveal
 * or restart the set-asides. A one-off counts as still there when its row carries the saved `id`, or
 * else when name, amount and due month all match a saved one that no other row has claimed.
 */
export function draftToRecords(
  d: SetupDraft,
  today: IsoDate,
  existing?: Plan,
): { plan: Plan; guesses: Guess[]; accounts: Account[] } {
  const thisMonth = monthOf(today);
  const unclaimed = [...(existing?.oneOffs ?? [])];
  const claim = (row: SetupDraft['oneOffs'][number]): OneOff | undefined => {
    const index = unclaimed.findIndex((o) =>
      row.id !== undefined
        ? o.id === row.id
        : o.name === row.name && o.amountMinor === row.amountMinor && o.dueMonth === row.dueMonth,
    );
    return index === -1 ? undefined : unclaimed.splice(index, 1)[0];
  };

  const oneOffs = d.oneOffs.map((row): OneOff => {
    const kept = claim(row);
    return {
      id: kept?.id ?? crypto.randomUUID(),
      name: row.name,
      amountMinor: row.amountMinor,
      createdMonth: kept?.createdMonth ?? thisMonth,
      dueMonth: row.dueMonth,
    };
  });

  const plan: Plan = {
    id: 'current',
    cityId: 'regensburg',
    incomes: d.incomes.map((a) => ({ ...a })),
    fixed: [{ categoryId: 'rent', monthlyMinor: d.rentMinor }, ...d.fixed.map((a) => ({ ...a }))],
    oneOffs,
    envelopes: d.envelopes.map((a) => ({ ...a })),
    createdOn: existing?.createdOn ?? today,
  };
  const guesses = d.guesses.map((g): Guess => ({ ...g, guessedOn: today }));
  const createdAt = new Date().toISOString();
  const accounts = d.accounts.map((a): Account => ({ id: crypto.randomUUID(), ...a, createdAt }));
  return { plan, guesses, accounts };
}

/** Turns every amount that did not parse into 0, or removes its row where 0 would be a real answer. */
export function dropUnparsed(d: SetupDraft): SetupDraft {
  const zero = (m: Minor): Minor => (Number.isNaN(m) ? 0 : m);
  const parsed = (list: Amount[]): Amount[] => list.filter((a) => !Number.isNaN(a.monthlyMinor));
  return {
    rentMinor: zero(d.rentMinor),
    accounts: d.accounts.map((a) => ({ ...a, openingMinor: zero(a.openingMinor) })),
    incomes: parsed(d.incomes),
    fixed: parsed(d.fixed),
    oneOffs: d.oneOffs.map((o) => ({ ...o, amountMinor: zero(o.amountMinor) })),
    guesses: parsed(d.guesses),
    envelopes: d.envelopes.map((a) => ({ ...a, monthlyMinor: zero(a.monthlyMinor) })),
  };
}

/** The plan as it would be saved right now, ignoring amounts that did not parse. For live feedback only. */
export function previewPlan(d: SetupDraft, today: IsoDate, existing?: Plan): Plan {
  return draftToRecords(dropUnparsed(d), today, existing).plan;
}

export function summarizeDraft(d: SetupDraft, today: IsoDate, existing?: Plan): PlanSummary {
  return planSummary(previewPlan(d, today, existing), monthOf(today));
}

const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** A due month must be a real `YYYY-MM` after the current month. */
export function isDueMonthValid(dueMonth: IsoMonth, today: IsoDate): boolean {
  // 'YYYY-MM' strings sort chronologically, so plain comparison is enough.
  return MONTH_PATTERN.test(dueMonth) && dueMonth > monthOf(today);
}

const isAmount = (m: Minor | undefined): boolean => m !== undefined && Number.isSafeInteger(m) && m >= 0;

function amountProblems(list: Amount[], categories: Category[]): string[] {
  return categories.flatMap((c) => {
    const minor = amountOf(list, c.id);
    return minor === undefined || isAmount(minor) ? [] : [`Check the amount for ${c.name}.`];
  });
}

/** Why the person cannot leave this step yet. Empty when they can. */
export function validateStep(step: StepId, d: SetupDraft, today: IsoDate = todayIso()): string[] {
  switch (step) {
    case 'city-rent':
      return isAmount(d.rentMinor) ? [] : [`Check the amount for ${nameOf('rent')}.`];

    case 'accounts': {
      if (d.accounts.length === 0) return ['Add at least one account'];
      const problems: string[] = [];
      if (d.accounts.some((a) => a.name.trim() === '')) problems.push('Give every account a name.');
      d.accounts.forEach((a, i) => {
        if (!isAmount(a.openingMinor)) {
          problems.push(`Check the opening balance for ${a.name.trim() || `account ${i + 1}`}.`);
        }
      });
      return problems;
    }

    case 'income':
      return amountProblems(d.incomes, INCOME_CATEGORIES);

    case 'fixed':
      return amountProblems(d.fixed, FIXED_CATEGORIES);

    case 'one-offs': {
      const problems = new Set<string>();
      d.oneOffs.forEach((o, i) => {
        const name = o.name.trim();
        if (name === '') problems.add('Name every one-off cost.');
        if (!(Number.isSafeInteger(o.amountMinor) && o.amountMinor > 0)) {
          problems.add(`Enter an amount above 0 for ${name || `one-off cost ${i + 1}`}.`);
        }
        if (!isDueMonthValid(o.dueMonth, today)) problems.add('Pick a month after this one.');
      });
      return [...problems];
    }

    case 'guesses':
      return FLEXIBLE_CATEGORIES.flatMap((c) => {
        const minor = amountOf(d.guesses, c.id);
        if (minor === undefined) return [`Add a guess for ${c.name}`];
        return isAmount(minor) ? [] : [`Check the guess for ${c.name}.`];
      });

    case 'envelopes':
      return FLEXIBLE_CATEGORIES.flatMap((c) => {
        const minor = amountOf(d.envelopes, c.id);
        if (minor === undefined) return [`Add an amount for ${c.name}`];
        return isAmount(minor) ? [] : [`Check the amount for ${c.name}.`];
      });
  }
}

/** iOS Safari only lets a home-screen app keep its own storage, so setup should happen there. */
export function shouldShowInstallHint(env: { isIos: boolean; standalone: boolean }): boolean {
  return env.isIos && !env.standalone;
}
