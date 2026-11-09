'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useRef, useState, type FormEvent } from 'react';
import { DateField } from '@/components/date-field';
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { saveEntry } from '@/db/repo';
import type { Entry } from '@/db/types';
import { defaultAccount, sortAccounts } from '@/features/accounts/balances';
import type { EntryField } from '@/features/accounts/transfer';
import { TransferForm } from '@/features/accounts/transfer-form';
import { categoryNameIn } from '@/i18n/category-name';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import { describedBy } from '@/lib/described-by';
import { amountInputText, parseAmount } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { buildEntry } from './build-entry';
import { categoryName, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './categories';
import { readLastChoice, rememberChoice } from './last-choice';

type EntryType = Entry['type'];

/** A message under the form, and the field it is about (none when saving failed): that field points at it. */
type FormError = { text: string; field: EntryField | 'date' | null };

const TABS: readonly EntryType[] = ['expense', 'income', 'transfer'];

/** The expense categories in the list's three groups, in category order within each. */
const EXPENSE_GROUPS = (['flexible', 'fixed', 'oneoff'] as const).map((kind) => ({
  kind,
  categories: EXPENSE_CATEGORIES.filter((c) => c.kind === kind),
}));

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
  const { t, lang, locale } = useT();
  const text = t.entries.form;
  const editing = entry?.type === 'transfer' ? undefined : entry;
  const accounts = useLiveQuery(async () => sortAccounts(await db.accounts.toArray()), []);
  // Today's date, kept current: null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const [amount, setAmount] = useState(editing ? amountInputText(editing.amountMinor, locale) : '');
  // null until the person picks: the account and category last saved with on this phone (pain points, chunk 6), else
  // the default account and the first category.
  const [accountChoice, setAccountChoice] = useState<string | null>(editing?.accountId ?? null);
  const [categoryChoice, setCategoryChoice] = useState<string | null>(editing?.categoryId ?? null);
  // After "Save and add another": the line that says it was saved, and the amount field to type the next one into.
  const [savedAnother, setSavedAnother] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  // null means today, so a form left open over midnight follows the date; a date that was picked stays.
  const [dateChoice, setDateChoice] = useState<IsoDate | null>(editing?.date ?? null);
  // The poster writes a scheduled entry's note as its category's English name (post-due.ts), which the lists show in the
  // phone's language (entryTitle). The form starts it empty instead: in German it read "Rent", and a changed category
  // then left "Rent" as the entry's title (review, 09-11-2026).
  const [note, setNote] = useState(
    editing && editing.note === categoryName(editing.categoryId) ? '' : (editing?.note ?? ''),
  );
  const [error, setError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState(false);

  if (accounts === undefined || today === null) return null;
  if (accounts.length === 0) {
    return <p className="text-muted-foreground">{t.entries.noAccount}</p>;
  }

  // Read while rendering, after the accounts have loaded, so never during the prerender or hydration.
  const last = editing ? null : readLastChoice(type);
  const account =
    accounts.find((a) => a.id === (accountChoice ?? last?.accountId)) ?? defaultAccount(accounts) ?? accounts[0];
  // Switching between Expense and Income leaves the other kind's category unknown, which falls back to the first.
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const category = categories.find((c) => c.id === (categoryChoice ?? last?.categoryId)) ?? categories[0];
  const date = dateChoice ?? today;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Which button sent it: "Save and add another" keeps the form here for the next one.
    const another = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'another';
    setSavedAnother(false);
    if (date === '') return setError({ text: text.pickDate, field: 'date' });

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
        lang,
      );
      if (!result.ok) {
        setError({ text: result.error, field: result.field });
        return;
      }
      await saveEntry(result.entry);
      saved = result.entry;
    } catch (saveError) {
      console.error('StudentsBudget: could not save the entry', saveError);
      setError({ text: t.entries.saveFailed, field: null });
      return;
    } finally {
      setSaving(false);
    }
    if (!editing) {
      rememberChoice(type, { categoryId: category.id, accountId: account.id });
      setAmount('');
      setNote('');
      if (another) {
        // The date, category and account stay for the next receipt.
        setSavedAnother(true);
        amountRef.current?.focus();
        return;
      }
      setDateChoice(null);
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
        <Label htmlFor={`${id}-amount`}>{text.amount}</Label>
        <div className="flex items-center gap-2">
          <Input
            ref={amountRef}
            id={`${id}-amount`}
            className="flex-1"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoComplete="off"
            aria-invalid={invalid('amount')}
            aria-describedby={describedBy(`${id}-currency`, errorFor('amount'))}
          />
          <span id={`${id}-currency`} className="w-10 text-sm text-muted-foreground">
            {account.currency}
          </span>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-account`}>{text.account}</Label>
        <NativeSelect
          id={`${id}-account`}
          className="w-full"
          aria-invalid={invalid('account')}
          aria-describedby={describedBy(errorFor('account'))}
          value={account.id}
          onChange={(event) => setAccountChoice(event.target.value)}
        >
          {accounts.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {t.common.accountOption(a.name, a.currency)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-category`}>{text.category}</Label>
        <NativeSelect
          id={`${id}-category`}
          className="w-full"
          value={category.id}
          onChange={(event) => setCategoryChoice(event.target.value)}
        >
          {type === 'income'
            ? categories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {categoryNameIn(t, c.id)}
                </NativeSelectOption>
              ))
            : EXPENSE_GROUPS.map((group) => (
                <NativeSelectOptGroup key={group.kind} label={text.groups[group.kind]}>
                  {group.categories.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {categoryNameIn(t, c.id)}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
        </NativeSelect>
      </div>
      <DateField
        value={date}
        onChange={setDateChoice}
        invalid={invalid('date')}
        describedBy={describedBy(errorFor('date'))}
      />
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-note`}>{text.note}</Label>
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
      {savedAnother && <StatusLine className="text-sm text-muted-foreground">{text.savedAnother}</StatusLine>}
      <Button type="submit" size="lg" disabled={saving}>
        {editing ? text.saveChanges : type === 'income' ? text.saveIncome : text.saveExpense}
      </Button>
      {!editing && (
        <Button type="submit" value="another" variant="outline" size="lg" disabled={saving}>
          {text.saveAnother}
        </Button>
      )}
    </form>
  );
}

/**
 * The manual way to log money. Without `entry`: tabs for Expense, Income and Transfer. With `entry`
 * (an edit): only the form for that entry's type, filled in. `onSaved` runs after a save, with the entry that was saved.
 */
export function EntryForm({ entry, onSaved }: { entry?: Entry; onSaved?: (saved: Entry) => void }) {
  const { t } = useT();
  const [tab, setTab] = useState<EntryType>('expense');

  if (entry?.type === 'transfer') return <TransferForm entry={entry} onSaved={onSaved} />;
  if (entry) return <MoneyEntryForm type={entry.type} entry={entry} onSaved={onSaved} />;

  const tabLabel = (type: EntryType) => (type === 'transfer' ? t.entries.transfer : t.entries.form[type]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = TABS.find((type) => type === value);
        if (next) setTab(next);
      }}
    >
      <TabsList aria-label={t.entries.form.typeLabel} className="w-full">
        {TABS.map((type) => (
          <TabsTrigger key={type} value={type}>
            {tabLabel(type)}
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
