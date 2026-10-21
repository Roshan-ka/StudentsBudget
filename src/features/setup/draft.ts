import { CATEGORIES } from '@/data/categories';
import type { CityRange } from '@/data/cities';
import type { Account, Amount, Category, Guess, OneOff, Plan, PlanLine, Schedule } from '@/db/types';
import { GUESS_CATEGORIES } from '@/features/entries/categories';
import { newSchedule, perOccurrence, restartSchedule } from '@/features/recurring/schedule';
import { planSummary, type PlanSummary } from '@/lib/budget';
import { monthOf, todayIso, type IsoDate, type IsoMonth } from '@/lib/dates';
import { formatMoney, formatRange, type Minor } from '@/lib/money';
import { newId } from '@/lib/new-id';

/**
 * "Add it automatically" for one line, as the wizard holds it. The choices stay while it is off or the line's amount
 * is cleared, so they come back. `accountId` is a draft account's key in a new setup, else a stored account's id.
 * For a new line, one that matches no account (or '') means the first account; a stored schedule whose account is
 * missing stays untouched until one is picked (`draftAccountOf`). `foreignMinor` is the amount each time, in the
 * account's currency, for an account that is not in EUR: setup has no rate to convert the euro figure with. `saved`
 * is the stored schedule in edit mode, so its id, start, watermark and pause carry over.
 */
export type DraftSchedule = {
  on: boolean;
  frequency: Schedule['frequency'];
  day: number;
  accountId: string;
  foreignMinor: Minor;
  saved?: Schedule;
};

/** An income or fixed cost in the draft: the monthly euro figure, and how it is added. */
export type DraftLine = Amount & { schedule?: DraftSchedule };

/** A draft account. `key` is draft-local until Save, when the account gets its id and every line that picked it follows. */
export type DraftAccount = Pick<Account, 'name' | 'kind' | 'currency' | 'openingMinor'> & { key?: string };

/** An account a line can be added to: a draft account (its key as `id`) or a stored one. */
export type AccountOption = Pick<Account, 'id' | 'name' | 'currency'>;

/**
 * What the wizard holds while the person fills it in. Nothing is stored until Save.
 *
 * A `NaN` amount stands for text in a field that did not parse. `validateStep` rejects it with a
 * message, so the draft alone decides whether a step may be left.
 *
 * `accounts` and `guesses` stay empty in edit mode: accounts are edited in Settings, guesses are locked.
 * `accounts` is empty in a new setup too when accounts already exist (added in Settings first), so Save adds none.
 * A one-off that carries an `id` came from the saved plan and keeps its `createdMonth` when saved again.
 * An income or fixed line without a `schedule` is added by hand. A line that gets an amount in the wizard starts with
 * "Add it automatically" on; a line opened from a plan that has no schedule for it starts with it off.
 *
 * Nothing in the draft blocks saving. A guess left blank is not saved, a one-off row without an amount is left out,
 * and `spendingBudgetMinor` (0 for none) is saved only when it is above 0 and only guides the envelope suggestion.
 */
export type SetupDraft = {
  rentMinor: Minor;
  /** Rent's "Add it automatically", asked in the fixed costs step once the accounts are known. */
  rentSchedule?: DraftSchedule;
  accounts: DraftAccount[];
  incomes: DraftLine[];
  fixed: DraftLine[];
  oneOffs: (Pick<OneOff, 'name' | 'amountMinor' | 'dueMonth'> & { id?: string })[];
  guesses: Amount[];
  /** The monthly everyday-spending budget in EUR, rent and fixed costs left out. 0 when none was entered. */
  spendingBudgetMinor: Minor;
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

/**
 * The categories a step asks about. A new setup asks the basic ones (`basicIds`); edit mode asks every one. A category
 * whose line has an amount is asked too, but that clause is only a guard: edit mode already asks every category, and a
 * new setup holds no line outside the basic ones, so today it never decides anything.
 */
export function askedCategories(
  all: Category[],
  basicIds: readonly string[],
  edit: boolean,
  lines: Amount[],
): Category[] {
  return all.filter((c) => edit || basicIds.includes(c.id) || (amountOf(lines, c.id) ?? 0) > 0);
}

const byCategoryOrder = (a: Amount, b: Amount): number =>
  (ORDER_OF.get(a.categoryId) ?? 0) - (ORDER_OF.get(b.categoryId) ?? 0);

/** Sets a row, or removes it when `minor` is `undefined`. Rows stay in category order. */
export function withAmount(list: Amount[], categoryId: string, minor: Minor | undefined): Amount[] {
  const rest = list.filter((a) => a.categoryId !== categoryId);
  if (minor === undefined) return rest;
  return [...rest, { categoryId, monthlyMinor: minor }].sort(byCategoryOrder);
}

/** "Add it automatically" as a line starts out: on, monthly on the 1st, from the first account. */
export function defaultDraftSchedule(): DraftSchedule {
  return { on: true, frequency: 'monthly', day: 1, accountId: '', foreignMinor: 0 };
}

/** A stored schedule as the wizard holds it; a line saved without one opens with "Add it automatically" off. */
function draftScheduleOf(saved: Schedule | undefined): DraftSchedule {
  if (!saved) return { ...defaultDraftSchedule(), on: false };
  const { frequency, day, accountId, amountMinor } = saved;
  return { on: true, frequency, day, accountId, foreignMinor: amountMinor, saved };
}

/**
 * Sets an income or fixed cost's monthly amount. A line that gets an amount above 0 and has no choices yet starts with
 * "Add it automatically" on. A 0 removes a line without choices (a source you do not have is no row) and keeps one
 * with choices, so they come back when the amount is typed again; a line at 0 is not saved.
 */
export function setLineAmount(list: DraftLine[], categoryId: string, minor: Minor): DraftLine[] {
  const row = list.find((l) => l.categoryId === categoryId);
  const rest = list.filter((l) => l.categoryId !== categoryId);
  const schedule = row?.schedule ?? (minor > 0 ? defaultDraftSchedule() : undefined);
  if (minor === 0 && schedule === undefined) return rest;
  return [...rest, { categoryId, monthlyMinor: minor, ...(schedule && { schedule }) }].sort(byCategoryOrder);
}

export function setLineSchedule(list: DraftLine[], categoryId: string, schedule: DraftSchedule): DraftLine[] {
  return list.map((l) => (l.categoryId === categoryId ? { ...l, schedule } : l));
}

/** Sets the rent. Rent that gets an amount above 0 and has no choices yet starts with "Add it automatically" on. */
export function setRentAmount(d: SetupDraft, minor: Minor): SetupDraft {
  return { ...d, rentMinor: minor, rentSchedule: d.rentSchedule ?? (minor > 0 ? defaultDraftSchedule() : undefined) };
}

/** Gives each draft account without a key one of its own, so a line can pick it. The draft itself when all have one. */
export function withAccountKeys(d: SetupDraft): SetupDraft {
  if (d.accounts.every((a) => a.key !== undefined)) return d;
  // Never a key a removed account had: a line that picked that account must not move to a new one.
  const keyed = d.accounts.map((a) => (a.key === undefined ? { ...a, key: `draft-${newId()}` } : a));
  return { ...d, accounts: keyed };
}

/** What a line can be added to: the draft accounts in a new setup, the stored ones when the draft has none. */
export function accountOptions(d: SetupDraft, stored: AccountOption[]): AccountOption[] {
  if (d.accounts.length === 0) return stored;
  return d.accounts.flatMap((a, i) =>
    a.key === undefined ? [] : [{ id: a.key, name: a.name.trim() || `Account ${i + 1}`, currency: a.currency }],
  );
}

/**
 * The account a line's schedule uses in the wizard: the one it picked, else the first (a new line, or a draft account
 * that was removed). A stored schedule whose account is gone has none until the person picks one: it is never
 * quietly moved to the first account.
 */
export function draftAccountOf(schedule: DraftSchedule | undefined, options: AccountOption[]): AccountOption | undefined {
  if (!schedule) return undefined;
  const picked = options.find((o) => o.id === schedule.accountId);
  if (schedule.saved && !picked) return undefined;
  return picked ?? options[0];
}

/** Whether a stored schedule's account is gone and the person has just picked another: it is added again from tomorrow. */
export function isRepaired(schedule: DraftSchedule, options: AccountOption[]): boolean {
  const { saved } = schedule;
  return (
    saved !== undefined &&
    !options.some((o) => o.id === saved.accountId) &&
    options.some((o) => o.id === schedule.accountId)
  );
}

/** The draft for a new setup. With `accountsExist` the prefilled accounts are left out: the ones in Settings stay. */
export function initialDraft(accountsExist = false): SetupDraft {
  return {
    rentMinor: 0,
    accounts: accountsExist
      ? []
      : [
          { key: 'draft-1', name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 0 },
          { key: 'draft-2', name: 'Home bank', kind: 'bank', currency: 'INR', openingMinor: 0 },
          { key: 'draft-3', name: 'Cash', kind: 'cash', currency: 'EUR', openingMinor: 0 },
        ],
    incomes: [],
    fixed: [],
    oneOffs: [],
    // A blank guess is not a 0: it is not saved, and a typed 0 is.
    guesses: [],
    spendingBudgetMinor: 0,
    envelopes: FLEXIBLE_CATEGORIES.map((c) => ({ categoryId: c.id, monthlyMinor: 0 })),
  };
}

/** The draft for edit mode, filled from the saved plan. Every line, rent included, carries its schedule through. */
export function draftFromPlan(plan: Plan): SetupDraft {
  const rent = plan.fixed.find((l) => l.categoryId === 'rent');
  const toDraft = ({ categoryId, monthlyMinor, schedule }: PlanLine): DraftLine => ({
    categoryId,
    monthlyMinor,
    schedule: draftScheduleOf(schedule),
  });
  return {
    rentMinor: rent?.monthlyMinor ?? 0,
    rentSchedule: rent && draftScheduleOf(rent.schedule),
    accounts: [],
    incomes: plan.incomes.map(toDraft),
    fixed: plan.fixed.filter((a) => a.categoryId !== 'rent').map(toDraft),
    oneOffs: plan.oneOffs.map(({ id, name, amountMinor, dueMonth }) => ({ id, name, amountMinor, dueMonth })),
    guesses: [],
    spendingBudgetMinor: plan.spendingBudgetMinor ?? 0,
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
 *
 * An income or fixed line at 0 is left out (rent is always saved), and so is a one-off without an amount. The everyday
 * budget is saved only above 0. A line set to be added automatically gets its
 * schedule: a stored one keeps its id, start, watermark and pause; a new one starts tomorrow with today as its
 * watermark, so nothing back-posts. Each occurrence posts the monthly euro figure (a weekly one: 12 months over 52
 * weeks), or for an account in another currency the amount typed for it. A draft account's key becomes that account's
 * new id. `stored` are the saved accounts, which a line picks from when the draft has none.
 */
export function draftToRecords(
  d: SetupDraft,
  today: IsoDate,
  existing?: Plan,
  stored: AccountOption[] = [],
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

  const oneOffs = d.oneOffs
    .filter((row) => row.amountMinor > 0)
    .map((row): OneOff => {
      const kept = claim(row);
      return {
        id: kept?.id ?? newId(),
        name: row.name,
        amountMinor: row.amountMinor,
        createdMonth: kept?.createdMonth ?? thisMonth,
        dueMonth: row.dueMonth,
      };
    });

  const createdAt = new Date().toISOString();
  const accounts = d.accounts.map(
    (a): Account => ({
      id: newId(),
      name: a.name,
      kind: a.kind,
      currency: a.currency,
      openingMinor: a.openingMinor,
      createdAt,
    }),
  );
  const idOfKey = new Map(
    d.accounts.flatMap((a, i) => (a.key === undefined ? [] : [[a.key, accounts[i].id] as const])),
  );
  const options = accountOptions(d, stored);

  const scheduleOf = (monthlyMinor: Minor, draft: DraftSchedule | undefined): Schedule | undefined => {
    if (!draft?.on || !(monthlyMinor > 0)) return undefined;
    const account = draftAccountOf(draft, options);
    // Its account is gone and none was picked, or there is none to pick from (a preview without the stored
    // accounts): a stored schedule stays exactly as it is.
    if (!account) return draft.saved;
    const amountMinor = account.currency === 'EUR' ? perOccurrence(monthlyMinor, draft.frequency) : draft.foreignMinor;
    if (!(Number.isSafeInteger(amountMinor) && amountMinor > 0)) return undefined;
    const fields = {
      frequency: draft.frequency,
      day: draft.day,
      accountId: idOfKey.get(account.id) ?? account.id,
      amountMinor,
    };
    if (!draft.saved) return newSchedule(fields, today);
    // A line whose account was gone is added again from tomorrow, so the periods it missed are not back-posted.
    return isRepaired(draft, options)
      ? { ...restartSchedule(draft.saved, today), ...fields }
      : { ...draft.saved, ...fields };
  };
  const toLine = (categoryId: string, monthlyMinor: Minor, draft: DraftSchedule | undefined): PlanLine => {
    const schedule = scheduleOf(monthlyMinor, draft);
    return schedule ? { categoryId, monthlyMinor, schedule } : { categoryId, monthlyMinor };
  };
  const toLines = (list: DraftLine[]): PlanLine[] =>
    list.filter((l) => l.monthlyMinor > 0).map((l) => toLine(l.categoryId, l.monthlyMinor, l.schedule));

  const plan: Plan = {
    id: 'current',
    cityId: 'regensburg',
    incomes: toLines(d.incomes),
    fixed: [toLine('rent', d.rentMinor, d.rentSchedule), ...toLines(d.fixed)],
    oneOffs,
    envelopes: d.envelopes.map((a) => ({ ...a })),
    ...(d.spendingBudgetMinor > 0 && { spendingBudgetMinor: d.spendingBudgetMinor }),
    createdOn: existing?.createdOn ?? today,
  };
  const guesses = d.guesses.map((g): Guess => ({ ...g, guessedOn: today }));
  return { plan, guesses, accounts };
}

/** Turns every amount that did not parse into 0, or removes its row where 0 would be a real answer. */
export function dropUnparsed(d: SetupDraft): SetupDraft {
  const zero = (m: Minor): Minor => (Number.isNaN(m) ? 0 : m);
  const parsed = (list: Amount[]): Amount[] => list.filter((a) => !Number.isNaN(a.monthlyMinor));
  const cleanSchedule = (s: DraftSchedule | undefined): DraftSchedule | undefined =>
    s && { ...s, foreignMinor: zero(s.foreignMinor) };
  // A line with choices keeps them at 0, as `setLineAmount` does.
  const lines = (list: DraftLine[]): DraftLine[] =>
    list.flatMap((l) => {
      const schedule = cleanSchedule(l.schedule);
      if (Number.isNaN(l.monthlyMinor)) return schedule ? [{ ...l, monthlyMinor: 0, schedule }] : [];
      return [schedule ? { ...l, schedule } : l];
    });
  return {
    rentMinor: zero(d.rentMinor),
    rentSchedule: cleanSchedule(d.rentSchedule),
    accounts: d.accounts.map((a) => ({ ...a, openingMinor: zero(a.openingMinor) })),
    incomes: lines(d.incomes),
    fixed: lines(d.fixed),
    oneOffs: d.oneOffs.map((o) => ({ ...o, amountMinor: zero(o.amountMinor) })),
    guesses: parsed(d.guesses),
    spendingBudgetMinor: zero(d.spendingBudgetMinor),
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

/**
 * Whether a one-off's due month is a problem. A row the saved plan already has, with the due month
 * it was saved with, is left alone even when that month has since come: the person did not pick it
 * now, and a due month in the past only means the cost has been paid. Rows are matched like
 * `draftToRecords` matches them: by `id`, else by name, amount and due month.
 */
export function isDueMonthProblem(row: SetupDraft['oneOffs'][number], today: IsoDate, existing?: Plan): boolean {
  if (isDueMonthValid(row.dueMonth, today)) return false;
  const unchanged = existing?.oneOffs.some((o) =>
    row.id !== undefined
      ? o.id === row.id && o.dueMonth === row.dueMonth
      : o.name === row.name && o.amountMinor === row.amountMinor && o.dueMonth === row.dueMonth,
  );
  return !unchanged;
}

const isAmount = (m: Minor | undefined): boolean => m !== undefined && Number.isSafeInteger(m) && m >= 0;

function amountProblems(list: Amount[], categories: Category[]): string[] {
  return categories.flatMap((c) => {
    const minor = amountOf(list, c.id);
    return minor === undefined || isAmount(minor) ? [] : [`Check the amount for ${c.name}.`];
  });
}

/** A line added automatically to an account in another currency needs the amount in that currency. */
function scheduleProblems(
  lines: { name: string; monthlyMinor: Minor; schedule?: DraftSchedule }[],
  options: AccountOption[],
): string[] {
  return lines.flatMap(({ name, monthlyMinor, schedule }) => {
    if (!schedule?.on || !(monthlyMinor > 0)) return [];
    const account = draftAccountOf(schedule, options);
    if (!account || account.currency === 'EUR') return [];
    const { foreignMinor } = schedule;
    return Number.isSafeInteger(foreignMinor) && foreignMinor > 0
      ? []
      : [`Enter the amount in ${account.currency} for ${name}.`];
  });
}

/** The lines of a list, in category order, with their names. */
function namedLines(list: DraftLine[], categories: Category[]): (DraftLine & { name: string })[] {
  return categories.flatMap((c) => {
    const line = list.find((l) => l.categoryId === c.id);
    return line ? [{ ...line, name: c.name }] : [];
  });
}

/**
 * Why the person cannot leave this step yet. Empty when they can. In edit mode pass the saved plan as
 * `existing`, so one-offs that are already in it are not held to the due-month rule again. `stored` are the saved
 * accounts, which a line picks from when the draft has none.
 */
export function validateStep(
  step: StepId,
  d: SetupDraft,
  today: IsoDate = todayIso(),
  existing?: Plan,
  stored: AccountOption[] = [],
): string[] {
  const options = accountOptions(d, stored);
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
      return [
        ...amountProblems(d.incomes, INCOME_CATEGORIES),
        ...scheduleProblems(namedLines(d.incomes, INCOME_CATEGORIES), options),
      ];

    case 'fixed': {
      // Rent's choices are asked in this step.
      const rent = { name: nameOf('rent'), monthlyMinor: d.rentMinor, schedule: d.rentSchedule };
      return [
        ...amountProblems(d.fixed, FIXED_CATEGORIES),
        ...scheduleProblems([rent, ...namedLines(d.fixed, FIXED_CATEGORIES)], options),
      ];
    }

    case 'one-offs': {
      const problems = new Set<string>();
      d.oneOffs.forEach((o, i) => {
        // A row without an amount is left out when saving, so it asks nothing: its due month is not needed.
        if (o.amountMinor === 0) return;
        const name = o.name.trim();
        if (name === '') problems.add('Name every one-off cost.');
        if (!isAmount(o.amountMinor)) problems.add(`Check the amount for ${name || `one-off cost ${i + 1}`}.`);
        if (isDueMonthProblem(o, today, existing)) problems.add('Pick a month after this one.');
      });
      return [...problems];
    }

    case 'guesses':
      // A blank guess is simply not saved: only one that did not parse is a problem.
      return GUESS_CATEGORIES.flatMap((c) => {
        const minor = amountOf(d.guesses, c.id);
        return minor === undefined || isAmount(minor) ? [] : [`Check the guess for ${c.name}.`];
      });

    case 'envelopes':
      return [
        // The everyday budget is asked at the top of this step. Blank, 0 and an amount are all fine.
        ...(isAmount(d.spendingBudgetMinor) ? [] : ['Check the amount for your everyday budget.']),
        ...FLEXIBLE_CATEGORIES.flatMap((c) => {
          const minor = amountOf(d.envelopes, c.id);
          if (minor === undefined) return [`Add an amount for ${c.name}`];
          return isAmount(minor) ? [] : [`Check the amount for ${c.name}.`];
        }),
      ];
  }
}

const wholeEuros = (minor: Minor): string => formatMoney(minor, 'EUR', { whole: true });

/**
 * The line under the envelopes: "Available €440 · Planned €465 · Over by €25". Whole euros, but a
 * set-aside is rounded up to the cent, so Available can have cents. It is shown rounded down and the
 * overage rounded up: the plan never reads as over by €0, and Available is never shown higher than it is.
 */
export function envelopesFooter(s: PlanSummary): string {
  const parts = [
    `Available ${wholeEuros(Math.floor(s.availableMinor / 100) * 100)}`,
    `Planned ${wholeEuros(s.envelopesMinor)}`,
  ];
  if (s.overByMinor > 0) parts.push(`Over by ${wholeEuros(Math.ceil(s.overByMinor / 100) * 100)}`);
  return parts.join(' · ');
}

/**
 * The line under the envelopes when there is an everyday budget: "€394 of your €600 budget", or "€40 over your €600
 * budget". Whole euros; the overage is rounded up, so it never reads as less than it is. `null` without a budget
 * (zero or less): there is nothing to compare with.
 */
export function budgetLine(plannedMinor: Minor, budgetMinor: Minor): string | null {
  if (!(budgetMinor > 0)) return null;
  const budget = wholeEuros(budgetMinor);
  if (plannedMinor <= budgetMinor) return `${wholeEuros(plannedMinor)} of your ${budget} budget`;
  return `${wholeEuros(Math.ceil((plannedMinor - budgetMinor) / 100) * 100)} over your ${budget} budget`;
}

/** "Students here: €200–260", with "(estimate)" added when no source gives the number. */
export function rangeLine(prefix: string, range: Pick<CityRange, 'minMinor' | 'maxMinor' | 'source'>): string {
  const line = `${prefix}: ${formatRange(range.minMinor, range.maxMinor)}`;
  return range.source === 'Estimate' ? `${line} (estimate)` : line;
}

/** iOS Safari only lets a home-screen app keep its own storage, so setup should happen there. */
export function shouldShowInstallHint(env: { isIos: boolean; standalone: boolean }): boolean {
  return env.isIos && !env.standalone;
}
