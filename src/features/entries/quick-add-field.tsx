'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { deleteEntry, saveEntry } from '@/db/repo';
import { todayIso } from '@/lib/dates';
import { formatMoney, type CurrencyCode, type Minor } from '@/lib/money';
import { buildEntry } from './build-entry';
import { FLEXIBLE_CATEGORIES, GUESS_CATEGORIES, categoryName } from './categories';
import { parseQuickAdd, suggestCategory, type QuickAddAmount, type QuickAddChoice } from './quick-add';
import { pickQuickAddAccount } from './quick-add-account';

/** The two readings of a line like "coffee 7 40 euros", shown in the currency quick add saves in. */
type Choice = QuickAddChoice & { currency: CurrencyCode };

/** How long the "Saved …" line, with its Undo, stays up. */
const SAVED_LINE_MS = 10_000;

/** The flexible categories added after the original six: they sit behind the More chip. */
const MORE_CATEGORIES = FLEXIBLE_CATEGORIES.filter((c) => !GUESS_CATEGORIES.some((g) => g.id === c.id));

/**
 * One chip per flexible category: the original six, then a More chip that shows the rest. It is only on screen
 * while the line waits for a category, so every new line starts with the six again.
 */
function CategoryChips({ busy, onPick }: { busy: boolean; onPick: (categoryId: string) => void }) {
  const [showMore, setShowMore] = useState(false);
  const chip = (category: { id: string; name: string }) => (
    <Button
      key={category.id}
      type="button"
      variant="outline"
      className="h-10 px-3"
      disabled={busy}
      onClick={() => onPick(category.id)}
    >
      {category.name}
    </Button>
  );

  return (
    <div role="group" aria-label="Category" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Which category?</p>
      <div className="flex flex-wrap gap-2">
        {GUESS_CATEGORIES.map(chip)}
        <Button
          type="button"
          variant="secondary"
          className="h-10 px-3"
          aria-expanded={showMore}
          onClick={() => setShowMore((open) => !open)}
        >
          More
        </Button>
        {showMore && MORE_CATEGORIES.map(chip)}
      </div>
    </div>
  );
}

/** One button per reading of the line: "€7.40" and "€40". Whole amounts print without cents. */
function AmountChoice({
  choice,
  busy,
  onPick,
}: {
  choice: Choice;
  busy: boolean;
  onPick: (amountMinor: Minor) => void;
}) {
  return (
    <div role="group" aria-label="Amount" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Which amount?</p>
      <div className="flex flex-wrap gap-2">
        {choice.options.map((option) => (
          <Button
            key={option}
            type="button"
            variant="outline"
            className="h-10 px-3"
            disabled={busy}
            onClick={() => onPick(option)}
          >
            {formatMoney(option, choice.currency, { whole: option % 100 === 0 })}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * One line to log an expense: "döner 6", typed or dictated. It saves straight away when an earlier
 * expense with the same first word gives the category; otherwise it asks with one chip per flexible
 * category (the original six, and the rest behind More). A line with two readings ("coffee 7 40 euros") first
 * asks which amount. A line that says what was saved comes with an Undo button.
 */
export function QuickAddField() {
  const id = useId();
  const [text, setText] = useState('');
  // Set while the amount buttons are shown: the two readings of the typed line, waiting for a tap.
  const [choice, setChoice] = useState<Choice | null>(null);
  // Set while the chips are shown: what the typed line parsed to, waiting for a category.
  const [pending, setPending] = useState<QuickAddAmount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // True from the first tap until the save is over. A ref, because a second tap can arrive before React has
  // rendered the disabled button, and `busy` would still read false in the handler it calls.
  const inFlight = useRef(false);

  // The line fades after a while: it says what happened some time ago, and Undo is for the moment after.
  useEffect(() => {
    if (saved === null) return;
    const timer = setTimeout(() => setSaved(null), SAVED_LINE_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  // The router keeps a page it has left mounted but hidden and runs its effect cleanups, so this clears the
  // line when the person leaves. Back on the page, an Undo that deletes an entry edited since would be a trap.
  useEffect(() => () => setSaved(null), []);

  /** Runs `task` unless one is running already. The flag is set before the first await. */
  async function runOnce(task: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  /**
   * Saves to the account `pickQuickAddAccount` chooses, dated today. Says why in `error` when it cannot.
   * Callers go through `runOnce`.
   */
  async function save(parsed: QuickAddAmount, categoryId: string) {
    setError(null);
    try {
      const account = pickQuickAddAccount(await db.accounts.toArray());
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
      setChoice(null);
      setPending(null);
    } catch (saveError) {
      console.error('StudentsBudget: could not save the quick-add entry', saveError);
      setError('Could not save the entry.');
    }
  }

  /**
   * Saves under the category of an earlier expense with the same first word, or shows the chips when there is none.
   * Callers go through `runOnce`.
   */
  async function saveOrAsk(parsed: QuickAddAmount) {
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
      setChoice(null);
      setPending(parsed);
      return;
    }
    await save(parsed, suggestion);
  }

  /** Shows the two amount buttons, in the currency of the account quick add saves to. Callers go through `runOnce`. */
  async function ask(readings: QuickAddChoice) {
    let currency: CurrencyCode;
    try {
      currency = pickQuickAddAccount(await db.accounts.toArray())?.currency ?? 'EUR';
    } catch (readError) {
      console.error('StudentsBudget: could not read the accounts', readError);
      setError('Could not save the entry.');
      return;
    }
    setError(null);
    setChoice({ ...readings, currency });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Nothing to add: a tap on the empty field right after a save must not take the Saved line away.
    if (text.trim() === '') return;

    await runOnce(async () => {
      setSaved(null);
      setChoice(null);
      setPending(null);
      const parsed = parseQuickAdd(text);
      if (parsed === null) {
        setError('Add an amount, like “döner 6”');
        return;
      }
      if ('kind' in parsed) {
        await ask(parsed);
        return;
      }
      await saveOrAsk(parsed);
    });
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
              // The amount buttons and the chips belong to the line that was typed; a changed line has to be added again.
              setChoice(null);
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

      {choice !== null && (
        <AmountChoice
          choice={choice}
          busy={busy}
          onPick={(amountMinor) => void runOnce(() => saveOrAsk({ amountMinor, note: choice.note }))}
        />
      )}

      {pending !== null && (
        <CategoryChips busy={busy} onPick={(categoryId) => void runOnce(() => save(pending, categoryId))} />
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
