'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { saveEntry } from '@/db/repo';
import type { Entry } from '@/db/types';
import { sortAccounts } from '@/features/accounts/balances';
import { TransferForm } from '@/features/accounts/transfer-form';
import { todayIso } from '@/lib/dates';
import { parseAmount, type Minor } from '@/lib/money';
import { buildEntry } from './build-entry';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './categories';

type EntryType = Entry['type'];

const TABS: { type: EntryType; label: string }[] = [
  { type: 'expense', label: 'Expense' },
  { type: 'income', label: 'Income' },
  { type: 'transfer', label: 'Transfer' },
];

function minorToInput(minor: Minor): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

/**
 * The form for an expense or an income: amount, account, category, date and note. With `entry` it starts
 * filled in and saving keeps that entry's id and creation time.
 */
function MoneyEntryForm({
  type,
  entry,
  onSaved,
}: {
  type: 'expense' | 'income';
  entry?: Entry;
  onSaved?: (saved: Entry) => void;
}) {
  const id = useId();
  const editing = entry?.type === 'transfer' ? undefined : entry;
  const accounts = useLiveQuery(async () => sortAccounts(await db.accounts.toArray()), []);
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amountMinor) : '');
  // null until the person picks: the first account and the first category.
  const [accountChoice, setAccountChoice] = useState<string | null>(editing?.accountId ?? null);
  const [categoryChoice, setCategoryChoice] = useState<string | null>(editing?.categoryId ?? null);
  // null means today, read when the form shows; a form left open over midnight then follows the date.
  const [dateChoice, setDateChoice] = useState<string | null>(editing?.date ?? null);
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (accounts === undefined) return null;
  if (accounts.length === 0) {
    return <p className="text-muted-foreground">Add an account in Settings first.</p>;
  }

  const account = accounts.find((a) => a.id === accountChoice) ?? accounts[0];
  // Switching between Expense and Income leaves the other kind's category unknown, which falls back to the first.
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const category = categories.find((c) => c.id === categoryChoice) ?? categories[0];
  const date = dateChoice ?? todayIso();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (date === '') return setError('Pick a date.');

    setSaving(true);
    setError(null);
    let saved: Entry;
    try {
      const result = buildEntry(
        {
          type,
          date,
          accountId: account.id,
          // 0 is rejected by buildEntry, which words the message.
          amountMinor: parseAmount(amount) ?? 0,
          categoryId: category.id,
          note,
        },
        account,
        await loadRates(),
        new Date(),
        editing,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await saveEntry(result.entry);
      saved = result.entry;
    } catch (saveError) {
      console.error('StudentsBudget: could not save the entry', saveError);
      setError('Could not save the entry.');
      return;
    } finally {
      setSaving(false);
    }
    if (!editing) {
      setAmount('');
      setNote('');
      setDateChoice(null);
    }
    onSaved?.(saved);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-amount`}>Amount</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-amount`}
            className="h-10 flex-1"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoComplete="off"
          />
          <span className="w-10 text-sm text-muted-foreground">{account.currency}</span>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-account`}>Account</Label>
        <NativeSelect
          id={`${id}-account`}
          className="w-full"
          value={account.id}
          onChange={(event) => setAccountChoice(event.target.value)}
        >
          {accounts.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-category`}>Category</Label>
        <NativeSelect
          id={`${id}-category`}
          className="w-full"
          value={category.id}
          onChange={(event) => setCategoryChoice(event.target.value)}
        >
          {categories.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-date`}>Date</Label>
        <Input
          id={`${id}-date`}
          type="date"
          className="h-10"
          value={date}
          onChange={(event) => setDateChoice(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-note`}>Note</Label>
        <Input
          id={`${id}-note`}
          className="h-10"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoComplete="off"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-10 px-4" disabled={saving}>
        {editing ? 'Save changes' : type === 'income' ? 'Save income' : 'Save expense'}
      </Button>
    </form>
  );
}

/**
 * The manual way to log money. Without `entry`: tabs for Expense, Income and Transfer. With `entry`
 * (an edit): only the form for that entry's type, filled in. `onSaved` runs after a save, with the entry that was saved.
 */
export function EntryForm({ entry, onSaved }: { entry?: Entry; onSaved?: (saved: Entry) => void }) {
  const [tab, setTab] = useState<EntryType>('expense');

  if (entry?.type === 'transfer') return <TransferForm entry={entry} onSaved={onSaved} />;
  if (entry) return <MoneyEntryForm type={entry.type} entry={entry} onSaved={onSaved} />;

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = TABS.find((t) => t.type === value);
        if (next) setTab(next.type);
      }}
    >
      <TabsList aria-label="Entry type" className="w-full group-data-horizontal/tabs:h-10">
        {TABS.map(({ type, label }) => (
          <TabsTrigger key={type} value={type}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* One panel that follows the tab, so a typed amount survives a switch between Expense and Income. */}
      <TabsContent value={tab} className="pt-2 text-base">
        {tab === 'transfer' ? <TransferForm onSaved={onSaved} /> : <MoneyEntryForm type={tab} onSaved={onSaved} />}
      </TabsContent>
    </Tabs>
  );
}
