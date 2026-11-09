'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type FormEvent } from 'react';
import { DateField } from '@/components/date-field';
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { saveEntry } from '@/db/repo';
import type { Entry } from '@/db/types';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import { describedBy } from '@/lib/described-by';
import { amountInputText, parseAmount } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { defaultAccount, sortAccounts } from './balances';
import { buildTransfer, type EntryField } from './transfer';
import { focusFirstControl, useFocusAfter } from '@/lib/focus';

/** A message under the form, and the field it is about (none when saving failed): that field points at it. */
type FormError = { text: string; field: EntryField | 'date' | null };

/**
 * Moves money between two accounts. With `entry` (a transfer being edited) the form starts filled in
 * and saving keeps that entry's id; any other entry type is ignored.
 */
export function TransferForm({ entry, onSaved }: { entry?: Entry; onSaved?: (saved: Entry) => void }) {
  const id = useId();
  const { t, lang, locale } = useT();
  const text = t.accounts.transfer;
  const editing = entry?.type === 'transfer' ? entry : undefined;
  const accounts = useLiveQuery(async () => sortAccounts(await db.accounts.toArray()), []);
  // Today's date, kept current: null until the browser runs this (never the date of the prerender).
  const today = useToday();
  // null until the person picks: the default account sends, the first other account receives.
  const [fromChoice, setFromChoice] = useState<string | null>(editing?.accountId ?? null);
  const [toChoice, setToChoice] = useState<string | null>(editing?.toAccountId ?? null);
  const [amount, setAmount] = useState(editing ? amountInputText(editing.amountMinor, locale) : '');
  // null until the person types: see `received` below for what the field shows then.
  const [receivedChoice, setReceivedChoice] = useState<string | null>(null);
  // null means today, so a form left open (or kept hidden by the router) follows the date; a date that was picked stays.
  const [dateChoice, setDateChoice] = useState<IsoDate | null>(editing?.date ?? null);
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState(false);

  if (accounts === undefined || today === null) return null;
  if (accounts.length < 2) {
    return <p className="text-muted-foreground">{text.needsTwo}</p>;
  }

  // An account deleted while the form is open falls back to the default.
  const from = accounts.find((account) => account.id === fromChoice) ?? defaultAccount(accounts) ?? accounts[0];
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
    (keepsStoredReceived ? amountInputText(editing.toAmountMinor, locale) : from.currency === to.currency ? amount : '');
  const date = dateChoice ?? today;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (date === '') return setError({ text: t.entries.form.pickDate, field: 'date' });

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
        lang,
      );
      if (!result.ok) {
        setError({ text: result.error, field: result.field });
        return;
      }
      await saveEntry(result.entry);
      saved = result.entry;
    } catch (saveError) {
      console.error('StudentsBudget: could not save the transfer', saveError);
      setError({ text: text.saveFailed, field: null });
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

  // The field the message is about says so, and reads the message with its name (accessibility, chunk 6).
  const errorId = `${id}-error`;
  const invalid = (field: FormError['field']) => (error !== null && error.field === field) || undefined;
  const errorFor = (field: FormError['field']) => invalid(field) && errorId;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-from`}>{text.from}</Label>
        <NativeSelect
          id={`${id}-from`}
          className="w-full"
          aria-invalid={invalid('account')}
          aria-describedby={describedBy(errorFor('account'))}
          value={from.id}
          onChange={(event) => {
            setFromChoice(event.target.value);
            // To would now equal From: let it fall back to the first other account.
            if (to.id === event.target.value) setToChoice(null);
          }}
        >
          {accounts.map((account) => (
            <NativeSelectOption key={account.id} value={account.id}>
              {t.common.accountOption(account.name, account.currency)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-amount`}>{t.entries.form.amount}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-amount`}
            className="flex-1"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoComplete="off"
            aria-invalid={invalid('amount')}
            aria-describedby={describedBy(`${id}-from-currency`, errorFor('amount'))}
          />
          <span id={`${id}-from-currency`} className="w-10 text-sm text-muted-foreground">
            {from.currency}
          </span>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-to`}>{text.to}</Label>
        <NativeSelect
          id={`${id}-to`}
          className="w-full"
          aria-invalid={invalid('toAccount')}
          aria-describedby={describedBy(errorFor('toAccount'))}
          value={to.id}
          onChange={(event) => setToChoice(event.target.value)}
        >
          {accounts.map((account) => (
            <NativeSelectOption key={account.id} value={account.id}>
              {t.common.accountOption(account.name, account.currency)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-received`}>{text.received}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-received`}
            className="flex-1"
            inputMode="decimal"
            value={received}
            onChange={(event) => setReceivedChoice(event.target.value)}
            autoComplete="off"
            aria-invalid={invalid('received')}
            aria-describedby={describedBy(`${id}-to-currency`, errorFor('received'))}
          />
          <span id={`${id}-to-currency`} className="w-10 text-sm text-muted-foreground">
            {to.currency}
          </span>
        </div>
      </div>
      <DateField
        pastFirst
        value={date}
        onChange={setDateChoice}
        invalid={invalid('date')}
        describedBy={describedBy(errorFor('date'))}
      />
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-note`}>{t.entries.form.note}</Label>
        <Input
          id={`${id}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoComplete="off"
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error.text}
        </p>
      )}
      <Button type="submit" size="lg" disabled={saving}>
        {editing ? t.entries.form.saveChanges : text.move}
      </Button>
    </form>
  );
}

/** The settings page's way in: a button that opens the transfer form and closes it again once a transfer is saved. */
export function TransferSection() {
  const { t } = useT();
  const text = t.accounts.transfer;
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  // The form opens on its first field; closing it gives the focus back to the button that opened it.
  const focus = useFocusAfter();

  if (!open) {
    return (
      <section className="flex flex-col gap-2">
        {saved && <StatusLine className="text-sm text-muted-foreground">{text.saved}</StatusLine>}
        <Button
          ref={focus.refFor('open')}
          variant="outline"
          className="px-4"
          onClick={() => {
            setSaved(false);
            setOpen(true);
          }}
        >
          {text.open}
        </Button>
      </section>
    );
  }

  return (
    <section ref={focusFirstControl} aria-labelledby="transfer-heading" className={cardVariants()}>
      <h3 id="transfer-heading" className="text-xl leading-tight font-extrabold">
        {text.open}
      </h3>
      <TransferForm
        onSaved={() => {
          focus.mark('open');
          setSaved(true);
          setOpen(false);
        }}
      />
      <Button
        variant="ghost"
        className="px-4"
        onClick={() => {
          focus.mark('open');
          setOpen(false);
        }}
      >
        {text.cancel}
      </Button>
    </section>
  );
}
