'use client';

import { ChevronDownIcon, Mic, Square } from 'lucide-react';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { deleteEntry, saveEntry } from '@/db/repo';
import type { Account } from '@/db/types';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { categoryNameIn } from '@/i18n/category-name';
import { useT } from '@/i18n/use-t';
import { todayIso } from '@/lib/dates';
import { formatMoney, type CurrencyCode, type Minor } from '@/lib/money';
import { cn } from '@/lib/utils';
import { buildEntry } from './build-entry';
import { FLEXIBLE_CATEGORIES, GUESS_CATEGORIES } from './categories';
import {
  accountFor,
  checkReading,
  chosenAmount,
  localQuickAddProvider,
  type QuickAddAmountReading,
  type QuickAddChoiceReading,
  type QuickAddContext,
  type QuickAddProvider,
  type QuickAddReading,
} from './quick-add-provider';
import { listen, recognizerFor } from './speech';
import { focusFirstControl } from '@/lib/focus';

// Whether the browser can turn speech into text: it never changes while the page is open, and the server renders
// without the mic button, as for passkeys.
const subscribeNever = () => () => {};
const speechOnClient = () => recognizerFor(window) !== null;
const speechOnServer = () => false;

/** The two readings of a line like "coffee 7 40 euros", shown in the currency quick add saves in. */
type Choice = QuickAddChoiceReading & { currency: CurrencyCode };

/** What the provider reads a line against: today, the accounts and every expense so far. */
async function loadContext(): Promise<QuickAddContext> {
  const [accounts, history] = await Promise.all([
    db.accounts.toArray(),
    db.entries.where('type').equals('expense').toArray(),
  ]);
  return { today: todayIso(), accounts, history };
}

/** How long the "Saved …" line, with its Undo, stays up. */
const SAVED_LINE_MS = 10_000;

/** The flexible categories added after the original six: they sit behind the More chip. */
const MORE_CATEGORIES = FLEXIBLE_CATEGORIES.filter((c) => !GUESS_CATEGORIES.some((g) => g.id === c.id));

/**
 * One chip per flexible category: the original six, then a More chip that shows the rest. It is only on screen
 * while the line waits for a category, so every new line starts with the six again.
 */
function CategoryChips({ busy, onPick }: { busy: boolean; onPick: (categoryId: string) => void }) {
  const { t } = useT();
  const questionId = useId();
  const [showMore, setShowMore] = useState(false);
  const chip = (category: { id: string }) => (
    <Button
      key={category.id}
      type="button"
      variant="chip"
      disabled={busy}
      onClick={() => onPick(category.id)}
    >
      {categoryNameIn(t, category.id)}
    </Button>
  );

  return (
    <div
      ref={focusFirstControl}
      role="group"
      aria-label={t.entries.quickAdd.categoryGroup}
      aria-describedby={questionId}
      className="flex flex-col gap-2"
    >
      <p id={questionId} className="text-sm text-muted-foreground">
        {t.entries.quickAdd.whichCategory}
      </p>
      <div className="flex flex-wrap gap-2">
        {GUESS_CATEGORIES.map(chip)}
        <Button type="button" variant="chip" aria-expanded={showMore} onClick={() => setShowMore((open) => !open)}>
          {t.entries.quickAdd.more}
          <ChevronDownIcon aria-hidden="true" className={cn('transition-transform', showMore && 'rotate-180')} />
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
  const { t, locale } = useT();
  const questionId = useId();
  return (
    <div
      ref={focusFirstControl}
      role="group"
      aria-label={t.entries.quickAdd.amountGroup}
      aria-describedby={questionId}
      className="flex flex-col gap-2"
    >
      <p id={questionId} className="text-sm text-muted-foreground">
        {t.entries.quickAdd.whichAmount}
      </p>
      <div className="flex flex-wrap gap-2">
        {choice.options.map((option) => (
          <Button
            key={option}
            type="button"
            variant="chip"
            disabled={busy}
            onClick={() => onPick(option)}
          >
            {formatMoney(option, choice.currency, { whole: option % 100 === 0, locale })}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * One line to log an expense: "döner 6", typed or dictated. It saves straight away when an earlier
 * expense whose note starts with one of the line's words gives the category; otherwise it asks with one chip per flexible
 * category (the original six, and the rest behind More). A line with two readings ("coffee 7 40 euros") first
 * asks which amount. A line that says what was saved comes with an Undo button.
 *
 * `provider` reads the line (the local parser unless another is given), once per submit. Its category, account and
 * date are checked against the data first: an unknown one falls back to the chips, the default account or today.
 *
 * Where the browser has speech recognition, a mic button speaks a line instead (`speech.ts`): the first tap on a phone
 * shows where the speech goes (`PrivacyNote`), and what is heard is added like a typed line, with the same Saved line
 * and Undo.
 */
export function QuickAddField({ provider = localQuickAddProvider }: { provider?: QuickAddProvider }) {
  const id = useId();
  const { t, lang, locale } = useT();
  const words = t.entries.quickAdd;
  const [text, setText] = useState('');
  // Set while the amount buttons are shown: the two readings of the typed line, waiting for a tap.
  const [choice, setChoice] = useState<Choice | null>(null);
  // Set while the chips are shown: what the typed line was read as, waiting for a category.
  const [pending, setPending] = useState<QuickAddAmountReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // True from the first tap until the save is over. A ref, because a second tap can arrive before React has
  // rendered the disabled button, and `busy` would still read false in the handler it calls.
  const inFlight = useRef(false);
  const canSpeak = useSyncExternalStore(subscribeNever, speechOnClient, speechOnServer);
  // Set while the mic listens: what stops it.
  const stopListening = useRef<(() => void) | null>(null);
  const [listening, setListening] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  // A page the router leaves stays mounted but hidden, so the mic is stopped here rather than left listening.
  useEffect(
    () => () => {
      stopListening.current?.();
      stopListening.current = null;
    },
    [],
  );

  // The line fades after a while: it says what happened some time ago, and Undo is for the moment after. Not while
  // the focus or the pointer is on it, so someone who needs longer to reach Undo still can (accessibility, chunk 5).
  const [holding, setHolding] = useState(false);
  useEffect(() => {
    if (saved === null || holding) return;
    const timer = setTimeout(() => setSaved(null), SAVED_LINE_MS);
    return () => clearTimeout(timer);
  }, [saved, holding]);
  // The field, which takes the focus back after a chip is picked or a save is undone.
  const fieldRef = useRef<HTMLInputElement>(null);

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
   * Saves to the account the reading names, else the default account, dated the reading's day or today. Says why in
   * `error` when it cannot. Callers go through `runOnce`.
   */
  async function save(line: QuickAddAmountReading, categoryId: string) {
    setError(null);
    try {
      // Read again rather than taken from the context: the chips can wait while the accounts change in Settings.
      const account = accountFor(await db.accounts.toArray(), line.accountId);
      if (account === undefined) {
        setError(t.entries.noAccount);
        return;
      }
      const now = new Date();
      const result = buildEntry(
        {
          type: 'expense',
          date: line.date ?? todayIso(now),
          accountId: account.id,
          amountMinor: line.amountMinor,
          categoryId,
          note: line.note,
        },
        account,
        await loadRates(),
        now,
        undefined,
        lang,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await saveEntry(result.entry);

      const parts = [
        formatMoney(result.entry.amountMinor, account.currency, { locale }),
        result.entry.note,
        categoryNameIn(t, categoryId),
      ];
      setSaved({ id: result.entry.id, message: words.saved(parts.filter((part) => part !== '').join(' · ')) });
      setText('');
      setChoice(null);
      setPending(null);
    } catch (saveError) {
      console.error('StudentsBudget: could not save the quick-add entry', saveError);
      setError(t.entries.saveFailed);
    }
  }

  /**
   * Saves under the category the line was read with, or shows the chips when it has none. The category is read once
   * per line, so a tap on an amount button does not look it up again. Callers go through `runOnce`.
   */
  async function saveOrAsk(line: QuickAddAmountReading) {
    if (line.categoryId === null) {
      setError(null);
      setChoice(null);
      setPending(line);
      return;
    }
    await save(line, line.categoryId);
  }

  /** Shows the two amount buttons, in the currency of the account quick add saves to. */
  function ask(readings: QuickAddChoiceReading, accounts: Account[]) {
    setError(null);
    setChoice({ ...readings, currency: accountFor(accounts, readings.accountId)?.currency ?? 'EUR' });
  }

  /** Reads one line, typed or spoken, and saves it or asks what it needs. */
  async function addLine(line: string) {
    // Nothing to add: a tap on the empty field right after a save must not take the Saved line away.
    if (line.trim() === '') return;

    await runOnce(async () => {
      setSaved(null);
      setChoice(null);
      setPending(null);
      let ctx: QuickAddContext;
      let reading: QuickAddReading | null;
      try {
        ctx = await loadContext();
        reading = checkReading(await provider.read(line, ctx), ctx);
      } catch (readError) {
        console.error('StudentsBudget: could not read the quick-add line', readError);
        setError(t.entries.saveFailed);
        return;
      }
      if (reading === null) {
        setError(words.noAmount);
        return;
      }
      if (reading.kind === 'choice') {
        ask(reading, ctx.accounts);
        return;
      }
      await saveOrAsk(reading);
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await addLine(text);
  }

  /** Listens once; what is heard goes into the field and is added as a typed line would be. */
  function startListening() {
    setError(null);
    if (!navigator.onLine) {
      setError(words.micErrors.offline);
      return;
    }
    const stop = listen({
      win: window,
      lang,
      onText: (heard) => {
        setText(heard);
        void addLine(heard);
      },
      onProblem: (problem) => setError(words.micErrors[problem]),
      onEnd: () => {
        stopListening.current = null;
        setListening(false);
      },
    });
    if (stop === null) return;
    stopListening.current = stop;
    setListening(true);
  }

  /** The mic button: stops while listening; otherwise listens, after the note on where speech goes the first time. */
  function onMic() {
    if (stopListening.current !== null) {
      stopListening.current();
      return;
    }
    if (!noteSeen('mic')) {
      setNoteOpen(true);
      return;
    }
    startListening();
  }

  async function undo() {
    if (saved === null) return;
    try {
      await deleteEntry(saved.id);
      setSaved(null);
      setHolding(false);
      fieldRef.current?.focus();
    } catch (deleteError) {
      console.error('StudentsBudget: could not undo the quick-add entry', deleteError);
      setError(words.undoFailed);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-text`}>{words.label}</Label>
        <div className="flex gap-2">
          <Input
            ref={fieldRef}
            id={`${id}-text`}
            className="min-w-0 flex-1"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              // The amount buttons and the chips belong to the line that was typed; a changed line has to be added again.
              setChoice(null);
              setPending(null);
              setError(null);
            }}
            aria-describedby={`${id}-hint`}
            autoComplete="off"
            enterKeyHint="done"
          />
          {canSpeak && (
            // The name says what a tap does now, so it changes while listening (no aria-pressed besides).
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-[50px] shrink-0 px-0"
              aria-label={listening ? words.stopMic : words.mic}
              disabled={busy}
              onClick={onMic}
            >
              {listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
            </Button>
          )}
          <Button type="submit" size="lg" disabled={busy}>
            {words.add}
          </Button>
        </div>
        {/* The example stays in sight while typing, where a placeholder went (accessibility, chunk 8). */}
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {words.hint}
        </p>
      </form>

      {noteOpen && (
        <PrivacyNote
          id="mic"
          label={words.mic}
          text={words.micNote.text}
          continueLabel={words.micNote.continue}
          cancelLabel={words.micNote.cancel}
          onContinue={() => {
            setNoteOpen(false);
            startListening();
          }}
          onCancel={() => setNoteOpen(false)}
        />
      )}

      {choice !== null && (
        <AmountChoice
          choice={choice}
          busy={busy}
          onPick={(amountMinor) => {
            fieldRef.current?.focus();
            void runOnce(() => saveOrAsk(chosenAmount(choice, amountMinor)));
          }}
        />
      )}

      {pending !== null && (
        <CategoryChips
          busy={busy}
          onPick={(categoryId) => {
            fieldRef.current?.focus();
            void runOnce(() => save(pending, categoryId));
          }}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div
        className={
          saved || listening ? 'flex items-center justify-between gap-3 rounded-lg bg-muted py-1 ps-4 pe-1' : undefined
        }
        onFocus={() => setHolding(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHolding(false);
        }}
        // A pointer that moves over the line holds it; one the line merely appeared under (where the chip was) does
        // not, and a finger has no hover.
        onPointerMove={(event) => {
          if (event.pointerType !== 'touch') setHolding(true);
        }}
        onPointerLeave={() => setHolding(false)}
      >
        {/* Always rendered, so a screen reader is already listening when the text appears. The one status line for
            the field: it says "Listening…" while the mic is on, and what was saved after. */}
        <p role="status" className={listening ? 'min-w-0 py-2.5 text-sm break-words' : 'min-w-0 text-sm break-words'}>
          {listening ? words.listening : saved?.message}
        </p>
        {saved && !listening && (
          <Button type="button" variant="ghost" className="shrink-0" onClick={() => void undo()}>
            {words.undo}
          </Button>
        )}
      </div>
    </div>
  );
}
