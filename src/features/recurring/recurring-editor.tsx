'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select';
import { db } from '@/db/db';
import type { Account, Category, Plan, PlanLine } from '@/db/types';
import { sortAccounts } from '@/features/accounts/balances';
import { categoryName } from '@/features/entries/categories';
import { monthOf, todayIso, type IsoDate } from '@/lib/dates';
import { formatMoney, parseAmount, type Minor } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { AUTO_HINT } from './draft-schedule-fields';
import {
  ADDED_AGAIN,
  PICK_ACCOUNT,
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

type Change = (mutate: (plan: Plan) => Plan) => Promise<boolean>;

function minorToInput(minor: Minor): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

const AMOUNT_ERROR = 'Enter an amount above 0, like 250 or 12.50.';
const NO_ACCOUNT = 'Add an account below to have this added automatically.';

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
  const s = line?.schedule;
  const [categoryId, setCategoryId] = useState(line?.categoryId ?? addable[0]?.id ?? '');
  const [auto, setAuto] = useState(line ? s !== undefined : true);
  const [timing, setTiming] = useState<Timing>({ frequency: s?.frequency ?? 'monthly', day: s?.day ?? 1 });
  // '' when the account the line used is gone: the person has to pick one.
  const [accountId, setAccountId] = useState(
    s ? (accounts.some((a) => a.id === s.accountId) ? s.accountId : '') : (accounts[0]?.id ?? ''),
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
  const name = line ? categoryName(line.categoryId) : null;
  // A new or turned-on line starts tomorrow, as does one whose account was gone once one is picked; a resumed one has
  // not started either. Each says when its first entry comes.
  const firstOn = auto && account ? firstAddedOn(timing, s, today, orphaned) : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let lineChange: LineChange;
    if (auto) {
      // Without an account nothing can be added automatically, and a schedule the line has must not be dropped.
      if (accounts.length === 0) return setError(NO_ACCOUNT);
      if (!account) return setError(`${PICK_ACCOUNT}.`);
      if (eachMinor === null) return setError(AMOUNT_ERROR);
      const monthlyMinor = account.currency === 'EUR' ? 0 : parseAmount(monthly);
      if (monthlyMinor === null) return setError('Enter what it comes to in euros a month, like 400.');
      lineChange = {
        categoryId,
        auto: { ...timing, accountId: account.id, amountMinor: eachMinor, currency: account.currency },
        monthlyMinor,
      };
    } else {
      const monthlyMinor = parseAmount(monthly);
      if (monthlyMinor === null) return setError(AMOUNT_ERROR);
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
      aria-label={name ? `Change ${name}` : 'New fixed cost or income'}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      {!line && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-category`}>Fixed cost or income</Label>
          <NativeSelect
            id={`${id}-category`}
            className="w-full"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {fixedChoices.length > 0 && (
              <NativeSelectOptGroup label="Fixed costs">
                {fixedChoices.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            )}
            {incomeChoices.length > 0 && (
              <NativeSelectOptGroup label="Income">
                {incomeChoices.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
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
        Add it automatically
      </label>

      {auto && accounts.length === 0 && <p className="text-sm text-muted-foreground">{NO_ACCOUNT}</p>}

      {auto && accounts.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">{AUTO_HINT}</p>
          <RepeatFields timing={timing} onChange={setTiming} />
          {/* The watermark stays, so the change applies from the first period not handled yet. */}
          {s && timing.frequency !== s.frequency && (
            <p className="text-sm text-muted-foreground">A new frequency starts with the next period.</p>
          )}
          {firstOn && <p className="text-sm text-muted-foreground">{firstAddedLine(firstOn)}</p>}
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-account`}>Account</Label>
            <NativeSelect
              id={`${id}-account`}
              className="w-full"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {account === undefined && <NativeSelectOption value="">Pick an account</NativeSelectOption>}
              {accounts.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {account === undefined && <p className="text-sm text-muted-foreground">{PICK_ACCOUNT}</p>}
            {orphaned && account && <p className="text-sm text-muted-foreground">{ADDED_AGAIN}</p>}
          </div>
          {account && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-amount`}>Amount in {account.currency}</Label>
              <Input
                id={`${id}-amount`}
                className="h-10"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                autoComplete="off"
                aria-describedby={`${id}-amount-hint`}
              />
              <p id={`${id}-amount-hint`} className="text-sm text-muted-foreground">
                {planMinor !== null
                  ? `Each time it's added. In your plan: ${formatMoney(planMinor, 'EUR')} a month.`
                  : "Each time it's added."}
              </p>
            </div>
          )}
        </>
      )}

      {askMonthly && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-monthly`}>Per month in your plan, in €</Label>
          <Input
            id={`${id}-monthly`}
            className="h-10"
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
      <div className="flex gap-2">
        <Button type="submit" className="h-10 px-4" disabled={saving}>
          Save
        </Button>
        <Button type="button" variant="outline" className="h-10 px-4" onClick={onDone}>
          Cancel
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
  const name = categoryName(line.categoryId);
  const s = line.schedule;
  // Delete asks first, as deleting an entry does.
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{describeLine(line, accounts)}</p>
      </div>
      {confirming ? (
        <div role="group" aria-label={`Delete ${name}?`} className="flex flex-col gap-2">
          <p className="text-sm font-medium">{`Delete ${name}? Entries already added stay.`}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              className="h-10 px-4"
              onClick={() => void change((plan) => removeLine(plan, line.categoryId))}
            >
              Delete
            </Button>
            <Button variant="outline" className="h-10 px-4" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 px-4" aria-label={`Edit ${name}`} onClick={onEdit}>
            Edit
          </Button>
          {s && (
            <Button
              variant="outline"
              className="h-10 px-4"
              aria-label={`${s.paused ? 'Resume' : 'Pause'} ${name}`}
              onClick={() => void change((plan) => setLinePaused(plan, line.categoryId, !s.paused, todayIso()))}
            >
              {s.paused ? 'Resume' : 'Pause'}
            </Button>
          )}
          <Button variant="ghost" className="h-10 px-4" aria-label={`Delete ${name}`} onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      )}
    </li>
  );
}

function LineList({
  title,
  lines,
  render,
}: {
  title: string;
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
        // Specific, not "None yet": Settings stays in the page while hidden, and its text with it.
        <p className="text-sm text-muted-foreground">No {title.toLowerCase()} yet.</p>
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
  // 'loading' (no answer yet) and null (no plan) both render nothing.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const accounts = useLiveQuery(async () => sortAccounts(await db.accounts.toArray()), []);
  const today = useToday();
  // The category whose form is open, 'new' for the add form, or null.
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (plan === 'loading' || plan === null || accounts === undefined || today === null) return null;

  const addable = addableCategories(plan);
  const overBy = overBudgetLine(plan, monthOf(today));

  const change: Change = async (mutate) => {
    setError(null);
    try {
      await updatePlan(mutate);
      return true;
    } catch (saveError) {
      console.error('StudentsBudget: could not change the plan', saveError);
      setError('Could not save the change. Try again.');
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
    <section aria-labelledby="recurring-heading" className="flex flex-col gap-3">
      <h3 id="recurring-heading" className="text-lg font-semibold">
        Fixed costs and income
      </h3>
      <p className="text-muted-foreground">
        Rent, income and other money that comes or goes on a set day. Envelopes and one-off costs are under Plan.
      </p>
      {overBy && <p className="rounded-lg bg-muted px-4 py-3 text-sm font-medium">{overBy}</p>}
      <LineList title="Income" lines={plan.incomes} render={render} />
      <LineList title="Fixed costs" lines={plan.fixed} render={render} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {open === 'new' ? (
        <LineForm addable={addable} accounts={accounts} today={today} change={change} onDone={() => setOpen(null)} />
      ) : (
        addable.length > 0 && (
          <Button variant="outline" className="h-10 self-start px-4" onClick={() => setOpen('new')}>
            Add a fixed cost or income
          </Button>
        )
      )}
    </section>
  );
}
