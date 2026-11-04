'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select';
import { db } from '@/db/db';
import type { Account, Category, Plan, PlanLine } from '@/db/types';
import { defaultAccount, sortAccounts } from '@/features/accounts/balances';
import { INCOME_CATEGORIES } from '@/features/entries/categories';
import { categoryNameIn } from '@/i18n/category-name';
import { useT } from '@/i18n/use-t';
import { monthOf, todayIso, type IsoDate } from '@/lib/dates';
import { formatMoney, parseAmount, type Minor } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import {
  addableCategories,
  applyLineChange,
  describeLine,
  firstAddedLine,
  overBudgetLine,
  removeLine,
  setLinePaused,
  type LineChange,
} from './lines';
import { RepeatFields, type Timing } from './repeat-fields';
import { firstAddedOn, monthlyEquivalent } from './schedule';
import { updatePlan } from './update-plan';
import { useLineEntries } from './use-line-entries';

type Change = (mutate: (plan: Plan) => Plan) => Promise<boolean>;

function minorToInput(minor: Minor): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

/**
 * The form for one line: whether it is added automatically, when, from or into which account and how much. With
 * `line` it changes that line; without, it adds one of `addable`. Saving reads the stored plan again (`updatePlan`),
 * so a watermark the poster moved meanwhile stays where it is.
 */
function LineForm({
  line,
  addable,
  accounts,
  today,
  change,
  onDone,
}: {
  line?: PlanLine;
  addable: Category[];
  accounts: Account[];
  today: IsoDate;
  change: Change;
  onDone: () => void;
}) {
  const id = useId();
  const { t, lang, locale } = useT();
  const text = t.recurring;
  const s = line?.schedule;
  const [categoryId, setCategoryId] = useState(line?.categoryId ?? addable[0]?.id ?? '');
  const [auto, setAuto] = useState(line ? s !== undefined : true);
  const [timing, setTiming] = useState<Timing>({ frequency: s?.frequency ?? 'monthly', day: s?.day ?? 1 });
  // '' when the account the line used is gone: the person has to pick one.
  const [accountId, setAccountId] = useState(
    s ? (accounts.some((a) => a.id === s.accountId) ? s.accountId : '') : (defaultAccount(accounts)?.id ?? ''),
  );
  const [amount, setAmount] = useState(s ? minorToInput(s.amountMinor) : line ? minorToInput(line.monthlyMinor) : '');
  const [monthly, setMonthly] = useState(line ? minorToInput(line.monthlyMinor) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  // The account this line's schedule used is gone; picking one adds it again from tomorrow.
  const orphaned = s !== undefined && !accounts.some((a) => a.id === s.accountId);
  const askMonthly = !auto || (account !== undefined && account.currency !== 'EUR');
  const eachMinor = parseAmount(amount);
  // A euro line's plan figure follows from its amount; a foreign one has its own field.
  const planMinor =
    account?.currency === 'EUR' && eachMinor !== null
      ? monthlyEquivalent({ frequency: timing.frequency, amountMinor: eachMinor })
      : null;
  const name = line ? categoryNameIn(t, line.categoryId) : null;
  // A new or turned-on line starts tomorrow, as does one whose account was gone once one is picked; a resumed one has
  // not started either. Each says when its first entry comes, past a period the line already has an automatic entry
  // in, as the poster passes over it.
  const lineType = INCOME_CATEGORIES.some((c) => c.id === categoryId) ? 'income' : 'expense';
  const lineEntries = useLineEntries(lineType, categoryId);
  // Whether the line is coming at all does not depend on the entries (they only move the day later), so an empty line
  // holds its place while they load, and the form below does not jump when the day appears.
  const expectsFirst = auto && account !== undefined && firstAddedOn(timing, s, today, orphaned) !== null;
  const firstOn = expectsFirst && lineEntries ? firstAddedOn(timing, s, today, orphaned, lineEntries) : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let lineChange: LineChange;
    if (auto) {
      // Without an account nothing can be added automatically, and a schedule the line has must not be dropped.
      if (accounts.length === 0) return setError(text.noAccountBelow);
      if (!account) return setError(text.pickAccountError);
      if (eachMinor === null) return setError(t.common.amountField.positive);
      const monthlyMinor = account.currency === 'EUR' ? 0 : parseAmount(monthly);
      if (monthlyMinor === null) return setError(text.monthlyError);
      lineChange = {
        categoryId,
        auto: { ...timing, accountId: account.id, amountMinor: eachMinor, currency: account.currency },
        monthlyMinor,
      };
    } else {
      const monthlyMinor = parseAmount(monthly);
      if (monthlyMinor === null) return setError(t.common.amountField.positive);
      lineChange = { categoryId, auto: null, monthlyMinor };
    }

    setSaving(true);
    setError(null);
    const saved = await change((plan) => applyLineChange(plan, lineChange, todayIso(), accounts));
    setSaving(false);
    if (saved) onDone();
  }

  const fixedChoices = addable.filter((c) => c.kind === 'fixed');
  const incomeChoices = addable.filter((c) => c.kind === 'income');

  return (
    <form
      aria-label={name ? text.change(name) : text.newLine}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      {!line && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-category`}>{text.lineKind}</Label>
          <NativeSelect
            id={`${id}-category`}
            className="w-full"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {fixedChoices.length > 0 && (
              <NativeSelectOptGroup label={text.fixedCosts}>
                {fixedChoices.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {categoryNameIn(t, c.id)}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            )}
            {incomeChoices.length > 0 && (
              <NativeSelectOptGroup label={text.income}>
                {incomeChoices.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {categoryNameIn(t, c.id)}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            )}
          </NativeSelect>
        </div>
      )}

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          checked={auto}
          onChange={(event) => setAuto(event.target.checked)}
        />
        {text.automatic}
      </label>

      {auto && accounts.length === 0 && <p className="text-sm text-muted-foreground">{text.noAccountBelow}</p>}

      {auto && accounts.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">{text.autoHint}</p>
          <RepeatFields timing={timing} onChange={setTiming} />
          {/* The watermark stays, so the change applies from the first period not handled yet. */}
          {s && timing.frequency !== s.frequency && (
            <p className="text-sm text-muted-foreground">{text.newFrequency}</p>
          )}
          {expectsFirst && (
            <p className="min-h-5 text-sm text-muted-foreground">{firstOn ? firstAddedLine(firstOn, lang) : null}</p>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-account`}>{text.account}</Label>
            <NativeSelect
              id={`${id}-account`}
              className="w-full"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {account === undefined && <NativeSelectOption value="">{text.pickAccountOption}</NativeSelectOption>}
              {accounts.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {t.common.accountOption(a.name, a.currency)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {account === undefined && <p className="text-sm text-muted-foreground">{text.pickAccount}</p>}
            {orphaned && account && <p className="text-sm text-muted-foreground">{text.addedAgain}</p>}
          </div>
          {account && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-amount`}>{text.amountIn(account.currency)}</Label>
              <Input
                id={`${id}-amount`}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                autoComplete="off"
                aria-describedby={`${id}-amount-hint`}
              />
              <p id={`${id}-amount-hint`} className="text-sm text-muted-foreground">
                {planMinor !== null
                  ? text.eachTimeInPlan(formatMoney(planMinor, 'EUR', { locale }))
                  : text.eachTime}
              </p>
            </div>
          )}
        </>
      )}

      {askMonthly && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-monthly`}>{text.perMonth}</Label>
          <Input
            id={`${id}-monthly`}
            inputMode="decimal"
            value={monthly}
            onChange={(event) => setMonthly(event.target.value)}
            autoComplete="off"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="px-4" disabled={saving}>
          {text.save}
        </Button>
        <Button type="button" variant="outline" className="px-4" onClick={onDone}>
          {text.cancel}
        </Button>
      </div>
    </form>
  );
}

function LineRow({
  line,
  accounts,
  change,
  onEdit,
}: {
  line: PlanLine;
  accounts: Account[];
  change: Change;
  onEdit: () => void;
}) {
  const { t, lang } = useT();
  const text = t.recurring;
  const name = categoryNameIn(t, line.categoryId);
  const s = line.schedule;
  // Delete asks first, as deleting an entry does.
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{describeLine(line, accounts, lang)}</p>
      </div>
      {confirming ? (
        <div role="group" aria-label={text.deleteQuestion(name)} className="flex flex-col gap-2">
          <p className="text-sm font-medium">{text.deleteNote(name)}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              className="px-4"
              onClick={() => void change((plan) => removeLine(plan, line.categoryId))}
            >
              {text.delete}
            </Button>
            <Button variant="outline" className="px-4" onClick={() => setConfirming(false)}>
              {text.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="px-4" aria-label={text.editLine(name)} onClick={onEdit}>
            {text.edit}
          </Button>
          {s && (
            <Button
              variant="outline"
              className="px-4"
              aria-label={s.paused ? text.resumeLine(name) : text.pauseLine(name)}
              onClick={() => void change((plan) => setLinePaused(plan, line.categoryId, !s.paused, todayIso()))}
            >
              {s.paused ? text.resume : text.pause}
            </Button>
          )}
          <Button
            variant="ghost"
            className="px-4"
            aria-label={text.deleteLine(name)}
            onClick={() => setConfirming(true)}
          >
            {text.delete}
          </Button>
        </div>
      )}
    </li>
  );
}

function LineList({
  title,
  empty,
  lines,
  render,
}: {
  title: string;
  /** Specific, not "None yet": Settings stays in the page while hidden, and its text with it. */
  empty: string;
  lines: PlanLine[];
  render: (line: PlanLine) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <h4 id={id} className="font-semibold">
        {title}
      </h4>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul aria-labelledby={id}>{lines.map(render)}</ul>
      )}
    </div>
  );
}

/**
 * Settings → "Fixed costs and income": every income and fixed line of the plan, with its amount, when it is added
 * and the account. Each can be changed, paused, resumed, set to be added by hand or deleted, and a line can be added
 * for a category the plan does not have yet. Every change goes through `updatePlan`. Shown once a plan exists.
 */
export function RecurringEditor() {
  const { t, lang } = useT();
  const text = t.recurring;
  // 'loading' (no answer yet) and null (no plan) both render nothing.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const accounts = useLiveQuery(async () => sortAccounts(await db.accounts.toArray()), []);
  const today = useToday();
  // The category whose form is open, 'new' for the add form, or null.
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (plan === 'loading' || plan === null || accounts === undefined || today === null) return null;

  const addable = addableCategories(plan);
  const overBy = overBudgetLine(plan, monthOf(today), lang);

  const change: Change = async (mutate) => {
    setError(null);
    try {
      await updatePlan(mutate);
      return true;
    } catch (saveError) {
      console.error('StudentsBudget: could not change the plan', saveError);
      setError(text.saveFailed);
      return false;
    }
  };

  const render = (line: PlanLine) =>
    open === line.categoryId ? (
      <li key={line.categoryId} className="py-3">
        <LineForm
          line={line}
          addable={addable}
          accounts={accounts}
          today={today}
          change={change}
          onDone={() => setOpen(null)}
        />
      </li>
    ) : (
      <LineRow
        key={line.categoryId}
        line={line}
        accounts={accounts}
        change={change}
        onEdit={() => setOpen(line.categoryId)}
      />
    );

  return (
    <section aria-labelledby="recurring-heading" className={cardVariants()}>
      <h3 id="recurring-heading" className="text-xl leading-tight font-extrabold">
        {text.heading}
      </h3>
      <p className="text-muted-foreground">{text.intro}</p>
      {overBy && <p className="rounded-lg bg-muted px-4 py-3 text-sm font-medium">{overBy}</p>}
      <LineList title={text.income} empty={text.noIncome} lines={plan.incomes} render={render} />
      <LineList title={text.fixedCosts} empty={text.noFixedCosts} lines={plan.fixed} render={render} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {open === 'new' ? (
        <LineForm addable={addable} accounts={accounts} today={today} change={change} onDone={() => setOpen(null)} />
      ) : (
        addable.length > 0 && (
          <Button variant="outline" className="self-start px-4" onClick={() => setOpen('new')}>
            {text.add}
          </Button>
        )
      )}
    </section>
  );
}
