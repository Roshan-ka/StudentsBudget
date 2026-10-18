'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { deleteEntry, saveEntry } from '@/db/repo';
import { sortAccounts } from '@/features/accounts/balances';
import { todayIso } from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';
import { buildEntry } from './build-entry';
import { FLEXIBLE_CATEGORIES, categoryName } from './categories';
import { parseQuickAdd, suggestCategory } from './quick-add';

type Parsed = { amountMinor: Minor; note: string };

/**
 * One line to log an expense: "döner 6", typed or dictated. It saves straight away when an earlier
 * expense with the same first word gives the category; otherwise it asks with one chip per flexible
 * category. A line that says what was saved comes with an Undo button.
 */
export function QuickAddField() {
  const id = useId();
  const [text, setText] = useState('');
  // Set while the chips are shown: what the typed line parsed to, waiting for a category.
  const [pending, setPending] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /** Saves to the first cash account (else the first account), dated today. Says why in `error` when it cannot. */
  async function save(parsed: Parsed, categoryId: string) {
    setBusy(true);
    setError(null);
    try {
      const accounts = sortAccounts(await db.accounts.toArray());
      const account = accounts.find((a) => a.kind === 'cash') ?? accounts[0];
      if (account === undefined) {
        setError('Add an account in Settings first.');
        return;
      }
      const now = new Date();
      const result = buildEntry(
        {
          type: 'expense',
          date: todayIso(now),
          accountId: account.id,
          amountMinor: parsed.amountMinor,
          categoryId,
          note: parsed.note,
        },
        account,
        await loadRates(),
        now,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await saveEntry(result.entry);

      const parts = [formatMoney(result.entry.amountMinor, account.currency), result.entry.note, categoryName(categoryId)];
      setSaved({ id: result.entry.id, message: `Saved ${parts.filter((part) => part !== '').join(' · ')}` });
      setText('');
      setPending(null);
    } catch (saveError) {
      console.error('StudentsBudget: could not save the quick-add entry', saveError);
      setError('Could not save the entry.');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setSaved(null);
    setPending(null);
    const parsed = parseQuickAdd(text);
    if (parsed === null) {
      setError('Add an amount, like “döner 6”');
      return;
    }

    let suggestion: string | null;
    try {
      const history = await db.entries.where('type').equals('expense').toArray();
      suggestion = suggestCategory(parsed.note, history);
    } catch (readError) {
      console.error('StudentsBudget: could not read the earlier entries', readError);
      setError('Could not save the entry.');
      return;
    }

    if (suggestion === null) {
      setError(null);
      setPending(parsed);
      return;
    }
    await save(parsed, suggestion);
  }

  async function undo() {
    if (saved === null) return;
    try {
      await deleteEntry(saved.id);
      setSaved(null);
    } catch (deleteError) {
      console.error('StudentsBudget: could not undo the quick-add entry', deleteError);
      setError('Could not undo.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-text`}>Quick add</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-text`}
            className="h-10 flex-1"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              // The chips belong to the line that was typed; a changed line has to be added again.
              setPending(null);
              setError(null);
            }}
            placeholder="What and how much, like “döner 6”"
            autoComplete="off"
            enterKeyHint="done"
          />
          <Button type="submit" className="h-10 px-4" disabled={busy}>
            Add
          </Button>
        </div>
      </form>

      {pending !== null && (
        <div role="group" aria-label="Category" className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Which category?</p>
          <div className="flex flex-wrap gap-2">
            {FLEXIBLE_CATEGORIES.map((category) => (
              <Button
                key={category.id}
                type="button"
                variant="outline"
                className="h-10 px-3"
                disabled={busy}
                onClick={() => void save(pending, category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className={saved ? 'flex items-center justify-between gap-3 rounded-lg bg-muted py-1 pr-1 pl-4' : undefined}>
        {/* Always rendered, so a screen reader is already listening when the text appears. */}
        <p role="status" className="min-w-0 text-sm break-words">
          {saved?.message}
        </p>
        {saved && (
          <Button type="button" variant="ghost" className="h-10 shrink-0 px-3" onClick={() => void undo()}>
            Undo
          </Button>
        )}
      </div>
    </div>
  );
}
