'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { saveEntry } from '@/db/repo';
import type { Entry } from '@/db/types';
import { todayIso } from '@/lib/dates';
import { parseAmount, type Minor } from '@/lib/money';
import { sortAccounts } from './balances';
import { buildTransfer } from './transfer';

function minorToInput(minor: Minor): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

/**
 * Moves money between two accounts. With `entry` (a transfer being edited) the form starts filled in
 * and saving keeps that entry's id; any other entry type is ignored.
 */
export function TransferForm({ entry, onSaved }: { entry?: Entry; onSaved?: (saved: Entry) => void }) {
  const id = useId();
  const editing = entry?.type === 'transfer' ? entry : undefined;
  const accounts = useLiveQuery(async () => sortAccounts(await db.accounts.toArray()), []);
  // null until the person picks: the first account sends, the first other account receives.
  const [fromChoice, setFromChoice] = useState<string | null>(editing?.accountId ?? null);
  const [toChoice, setToChoice] = useState<string | null>(editing?.toAccountId ?? null);
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amountMinor) : '');
  // null until the person types: see `received` below for what the field shows then.
  const [receivedChoice, setReceivedChoice] = useState<string | null>(null);
  // null means today, read when the form shows; a form left open (or kept hidden by the router) then follows the date.
  const [dateChoice, setDateChoice] = useState<string | null>(editing?.date ?? null);
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (accounts === undefined) return null;
  if (accounts.length < 2) {
    return <p className="text-muted-foreground">Add a second account to move money between your accounts.</p>;
  }

  // An account deleted while the form is open falls back to the default.
  const from = accounts.find((account) => account.id === fromChoice) ?? accounts[0];
  const to = accounts.find((account) => account.id === toChoice) ?? accounts.filter((a) => a.id !== from.id)[0];
  // What the amount received shows until the person types in it. Between accounts in one currency it is the
  // amount sent, so editing only the amount keeps the two equal. An edit that keeps both accounts starts from
  // the stored amount where that cannot be worked out: across currencies, or when the two amounts differ on
  // purpose (a fee), so saving the note alone never changes it.
  const keepsStoredReceived =
    editing !== undefined &&
    from.id === editing.accountId &&
    to.id === editing.toAccountId &&
    (from.currency !== to.currency || editing.toAmountMinor !== editing.amountMinor);
  const received =
    receivedChoice ??
    (keepsStoredReceived ? minorToInput(editing.toAmountMinor) : from.currency === to.currency ? amount : '');
  const date = dateChoice ?? todayIso();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (date === '') return setError('Pick a date.');

    setSaving(true);
    setError(null);
    let saved: Entry;
    try {
      const result = buildTransfer(
        {
          fromAccountId: from.id,
          toAccountId: to.id,
          // 0 is rejected by buildTransfer, which words the message.
          amountMinor: parseAmount(amount) ?? 0,
          toAmountMinor: parseAmount(received) ?? 0,
          date,
          note,
        },
        from,
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
      console.error('StudentsBudget: could not save the transfer', saveError);
      setError('Could not save the transfer.');
      return;
    } finally {
      setSaving(false);
    }
    if (!editing) {
      setAmount('');
      setReceivedChoice(null);
      setDateChoice(null);
      setNote('');
    }
    onSaved?.(saved);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-from`}>From</Label>
        <NativeSelect
          id={`${id}-from`}
          className="w-full"
          value={from.id}
          onChange={(event) => {
            setFromChoice(event.target.value);
            // To would now equal From: let it fall back to the first other account.
            if (to.id === event.target.value) setToChoice(null);
          }}
        >
          {accounts.map((account) => (
            <NativeSelectOption key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
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
          <span className="w-10 text-sm text-muted-foreground">{from.currency}</span>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-to`}>To</Label>
        <NativeSelect
          id={`${id}-to`}
          className="w-full"
          value={to.id}
          onChange={(event) => setToChoice(event.target.value)}
        >
          {accounts.map((account) => (
            <NativeSelectOption key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-received`}>Amount received</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-received`}
            className="h-10 flex-1"
            inputMode="decimal"
            value={received}
            onChange={(event) => setReceivedChoice(event.target.value)}
            autoComplete="off"
          />
          <span className="w-10 text-sm text-muted-foreground">{to.currency}</span>
        </div>
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
        {editing ? 'Save changes' : 'Move money'}
      </Button>
    </form>
  );
}

/** The settings page's way in: a button that opens the transfer form and closes it again once a transfer is saved. */
export function TransferSection() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open) {
    return (
      <section className="flex flex-col gap-2">
        {saved && (
          <p role="status" className="text-sm text-muted-foreground">
            Transfer saved.
          </p>
        )}
        <Button
          variant="outline"
          className="h-10 px-4"
          onClick={() => {
            setSaved(false);
            setOpen(true);
          }}
        >
          Move money between accounts
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="transfer-heading" className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 id="transfer-heading" className="text-lg font-semibold">
        Move money between accounts
      </h3>
      <TransferForm
        onSaved={() => {
          setSaved(true);
          setOpen(false);
        }}
      />
      <Button variant="ghost" className="h-10 px-4" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </section>
  );
}
