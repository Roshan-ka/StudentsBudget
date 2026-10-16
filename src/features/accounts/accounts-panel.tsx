'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { db } from '@/db/db';
import { loadRates, refreshRates } from '@/db/rates';
import { AccountInUseError, deleteAccount } from '@/db/repo';
import type { Account, Entry } from '@/db/types';
import { todayIso } from '@/lib/dates';
import { CURRENCIES, formatMoney, type CurrencyCode, type Minor } from '@/lib/money';
import { accountBalance, sortAccounts, totalInEur } from './balances';
import { parseOpeningBalance } from './opening-balance';

const KIND_LABELS: Record<Account['kind'], string> = { bank: 'Bank', cash: 'Cash' };

function minorToInput(minor: Minor): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

function hasEntries(accountId: string, entries: Entry[]): boolean {
  return entries.some((e) => e.accountId === accountId || (e.type === 'transfer' && e.toAccountId === accountId));
}

async function refreshExchangeRates() {
  try {
    await refreshRates(todayIso());
  } catch (error) {
    console.error('StudentsBudget: could not refresh the exchange rates', error);
  }
}

function AccountForm({
  account,
  currencyLocked,
  onDone,
}: {
  account?: Account;
  currencyLocked: boolean;
  onDone: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<Account['kind']>(account?.kind ?? 'bank');
  const [currency, setCurrency] = useState<CurrencyCode>(account?.currency ?? 'EUR');
  const [opening, setOpening] = useState(account ? minorToInput(account.openingMinor) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName === '') return setError('Enter a name.');
    const openingMinor = parseOpeningBalance(opening);
    if (openingMinor === null) return setError('Enter the opening balance as a number, like 250 or 12.50.');

    setSaving(true);
    setError(null);
    try {
      await db.accounts.put({
        id: account?.id ?? crypto.randomUUID(),
        name: trimmedName,
        kind,
        currency,
        openingMinor,
        createdAt: account?.createdAt ?? new Date().toISOString(),
      });
    } catch (saveError) {
      console.error('StudentsBudget: could not save the account', saveError);
      setError('Could not save the account.');
      setSaving(false);
      return;
    }
    onDone();
    // Not awaited: the rate appears through the live query once it arrives, and a slow network must not hold the form.
    if (currency !== 'EUR') void refreshExchangeRates();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          className="h-10"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-kind`}>Type</Label>
        <NativeSelect
          id={`${id}-kind`}
          className="w-full"
          value={kind}
          onChange={(event) => setKind(event.target.value as Account['kind'])}
        >
          <NativeSelectOption value="bank">{KIND_LABELS.bank}</NativeSelectOption>
          <NativeSelectOption value="cash">{KIND_LABELS.cash}</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-currency`}>Currency</Label>
        <NativeSelect
          id={`${id}-currency`}
          className="w-full"
          value={currency}
          disabled={currencyLocked}
          onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
        >
          {CURRENCIES.map((code) => (
            <NativeSelectOption key={code} value={code}>
              {code}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {currencyLocked && (
          <p className="text-sm text-muted-foreground">The currency can&apos;t change once the account has entries.</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-opening`}>Opening balance</Label>
        <Input
          id={`${id}-opening`}
          className="h-10"
          inputMode="decimal"
          placeholder="0"
          value={opening}
          onChange={(event) => setOpening(event.target.value)}
          autoComplete="off"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="h-10 px-4" disabled={saving}>
          Save account
        </Button>
        <Button type="button" variant="outline" className="h-10 px-4" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AccountsPanel() {
  const accounts = useLiveQuery(async () => sortAccounts(await db.accounts.toArray()), []);
  const entries = useLiveQuery(() => db.entries.toArray(), []);
  const rates = useLiveQuery(() => loadRates(), []);
  // 'new' is the add form; an account id is that account's edit form.
  const [editing, setEditing] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function remove(account: Account) {
    setRowError(null);
    try {
      await deleteAccount(account.id);
    } catch (error) {
      if (error instanceof AccountInUseError) {
        setRowError({ id: account.id, message: 'This account has entries. Delete them first.' });
      } else {
        console.error('StudentsBudget: could not delete the account', error);
        setRowError({ id: account.id, message: 'Could not delete the account.' });
      }
    }
  }

  const loaded = accounts !== undefined && entries !== undefined && rates !== undefined;
  const total = loaded && accounts.length > 0 ? totalInEur(accounts, entries, rates) : null;
  // Without a rate for any account's currency nothing was converted, and a total of €0.00 would read as real.
  const nothingConverted = loaded && total !== null && accounts.every((a) => total.missingRates.includes(a.currency));

  return (
    <section aria-labelledby="accounts-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="accounts-heading" className="text-lg font-semibold">
          Accounts
        </h3>
        {editing !== 'new' && (
          <Button
            variant="outline"
            className="h-10 px-4"
            onClick={() => {
              setRowError(null);
              setEditing('new');
            }}
          >
            Add account
          </Button>
        )}
      </div>

      {editing === 'new' && <AccountForm currencyLocked={false} onDone={() => setEditing(null)} />}

      {loaded && accounts.length === 0 && editing !== 'new' && (
        <p className="text-muted-foreground">No accounts yet. Add your bank account, your wallet or your account back home.</p>
      )}

      {loaded && accounts.length > 0 && (
        <ul className="flex flex-col">
          {accounts.map((account) => (
            <li key={account.id} className="border-b py-3 last:border-b-0">
              {editing === account.id ? (
                <AccountForm
                  account={account}
                  currencyLocked={hasEntries(account.id, entries)}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{account.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {KIND_LABELS[account.kind]} · {account.currency}
                      </p>
                    </div>
                    <p className="shrink-0 font-medium tabular-nums">
                      {formatMoney(accountBalance(account, entries), account.currency)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-10 px-4"
                      aria-label={`Edit ${account.name}`}
                      onClick={() => {
                        setRowError(null);
                        setEditing(account.id);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-10 px-4"
                      aria-label={`Delete ${account.name}`}
                      onClick={() => void remove(account)}
                    >
                      Delete
                    </Button>
                  </div>
                  {rowError?.id === account.id && (
                    <p role="alert" className="text-sm text-destructive">
                      {rowError.message}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {total && (
        <div className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium">Total</p>
            <p className="font-medium tabular-nums">{nothingConverted ? '—' : formatMoney(total.totalMinor, 'EUR')}</p>
          </div>
          {total.missingRates.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Without {total.missingRates.join(', ')}: no exchange rate yet.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
