'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { CameraIcon, ChevronDownIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { DateField } from '@/components/date-field';
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { CATEGORIES } from '@/data/categories';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { deleteEntry, saveEntry } from '@/db/repo';
import type { Entry } from '@/db/types';
import { sortAccounts } from '@/features/accounts/balances';
import type { EntryField } from '@/features/accounts/transfer';
import { categoryTint } from '@/features/charts/colors';
import { buildEntry } from '@/features/entries/build-entry';
import { ImportLink } from '@/features/entries/import-link';
import { savedWhat } from '@/features/entries/saved-line';
import { categoryNameIn } from '@/i18n/category-name';
import { useT } from '@/i18n/use-t';
import { todayIso } from '@/lib/dates';
import { describedBy } from '@/lib/described-by';
import { focusOnMount, useFocusAfter } from '@/lib/focus';
import { formatMoney, parseAmount } from '@/lib/money';
import { readPref, writePref } from '@/lib/phone-pref';
import { cn } from '@/lib/utils';
import { readReceipt } from './read-receipt';
import { chipIds, draftOf, type ReceiptEngine, type ScanDraft } from './scan';

/** Set once the student has seen the note on the first scan's download (per phone, localStorage). */
const NOTE_KEY = 'studentsbudget-receipt-note';

/** How long the Saved line, with its Undo, stays up: as long as quick add's. */
const SAVED_LINE_MS = 10_000;

/**
 * How long the page keeps the card's height after Save. The tall card goes and the page would move up under the
 * finger, so a double tap's second tap could open a list row; this way it lands on nothing.
 */
const KEEP_SPACE_MS = 600;

type Phase =
  | { kind: 'idle' }
  | { kind: 'note' }
  | { kind: 'reading'; photo: string; progress: number }
  | { kind: 'check'; photo: string; found: boolean; offline: boolean; draft: ScanDraft };

type FieldError = { text: string; field: EntryField | 'date' | 'category' | null };

/** The photo beside the card's heading. A `blob:` URL of the file on this phone, never sent or kept. */
function Photo({ src, alt, large = false }: { src: string; alt: string; large?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a blob: URL of a photo on this phone, not an asset to optimise
    <img
      src={src}
      alt={alt}
      className={cn(
        'shrink-0 rounded-[10px] border-[1.5px] border-outline object-cover',
        large ? 'h-24 w-[72px]' : 'h-[72px] w-[54px]',
      )}
    />
  );
}

/**
 * Scan a receipt (receipt scan, chunk 4, docs/superpowers/plans/2026-11-13-receipt-scan.md; the look is Roshan's
 * approved mockups, round 2, 16-11-2026). Two outline buttons above quick add, "Import a bank statement" and "Scan a
 * receipt", whose card takes their place while a scan goes on:
 * - the first time on a phone, a note on the reading files' download, whose Continue opens the picker from its tap;
 * - the photo, read by `engine` with its progress and Cancel;
 * - the check card, filled from `readReceipt`, or empty with "Couldn't read this receipt" and "Try another photo";
 * - Save, through `buildEntry` and `saveEntry` as quick add does, then quick add's Saved line with Undo.
 * The photo stays in the page's memory as a `blob:` URL, revoked once its card goes. Leaving the page stops a scan in
 * flight; a card being checked stays.
 */
export function ScanReceipt({ engine }: { engine: ReceiptEngine }) {
  const id = useId();
  const { t, lang, locale } = useT();
  const words = t.entries.scan;
  const accounts = useLiveQuery(async () => sortAccounts(await db.accounts.toArray()), []);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<FieldError | null>(null);
  const [saved, setSaved] = useState<{ id: string; message: string } | null>(null);
  const [holding, setHolding] = useState(false);
  const [keepHeight, setKeepHeight] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // True from Save's tap until it is over: a ref, because a second tap can come before React renders the disabled button.
  const inFlight = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  // The scan in flight, which Cancel, a new photo or leaving the page stops; and the photo's URL, to revoke.
  const scan = useRef<AbortController | null>(null);
  const photo = useRef<string | null>(null);
  const focus = useFocusAfter();

  function dropPhoto() {
    if (photo.current !== null) URL.revokeObjectURL(photo.current);
    photo.current = null;
  }

  // A page the router leaves stays mounted but hidden, and runs its cleanups: a scan in flight stops there, and the
  // Saved line goes, as quick add's does.
  useEffect(
    () => () => {
      if (scan.current !== null) {
        scan.current.abort();
        scan.current = null;
        dropPhoto();
        setPhase({ kind: 'idle' });
      }
      setSaved(null);
    },
    [],
  );

  // The Saved line fades after a while, but not while the focus or a pointer is on it (as quick add's).
  useEffect(() => {
    if (saved === null || holding) return;
    const timer = setTimeout(() => setSaved(null), SAVED_LINE_MS);
    return () => clearTimeout(timer);
  }, [saved, holding]);

  useEffect(() => {
    if (keepHeight === null) return;
    const timer = setTimeout(() => setKeepHeight(null), KEEP_SPACE_MS);
    return () => clearTimeout(timer);
  }, [keepHeight]);

  /** Opens the camera or the photos: no `capture`, so the phone offers both. Called from a tap. */
  function openPicker() {
    fileRef.current?.click();
  }

  function onScan() {
    if (readPref(NOTE_KEY) === null) {
      setPhase({ kind: 'note' });
      return;
    }
    openPicker();
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Emptied, so the same photo can be picked again.
    event.target.value = '';
    if (file !== undefined) void start(file);
  }

  /** Reads the photo, then shows the check card: filled from the reading, or empty when nothing could be read. */
  async function start(file: File) {
    scan.current?.abort();
    const controller = new AbortController();
    scan.current = controller;
    dropPhoto();
    const url = URL.createObjectURL(file);
    photo.current = url;
    setError(null);
    setSaved(null);
    setMoreOpen(false);
    setPhase({ kind: 'reading', photo: url, progress: 0 });

    let text = '';
    let failed = false;
    try {
      text = await engine.read(file, {
        signal: controller.signal,
        onProgress: (share) => {
          if (scan.current === controller) setPhase((now) => (now.kind === 'reading' ? { ...now, progress: share } : now));
        },
      });
    } catch (readError) {
      if (controller.signal.aborted) return;
      console.error('StudentsBudget: could not read the receipt', readError);
      failed = true;
    }
    if (scan.current !== controller) return;

    let history: Entry[] = [];
    try {
      history = await db.entries.where('type').equals('expense').toArray();
    } catch (loadError) {
      // Only the student's own earlier categories are lost: the chain list still names the shop's.
      console.error('StudentsBudget: could not load the expenses for the receipt', loadError);
    }
    if (scan.current !== controller) return;
    scan.current = null;
    const today = todayIso();
    const reading = failed ? null : readReceipt(text, { today, history, categories: CATEGORIES });
    const { draft, found } = draftOf(reading, accounts ?? [], today, locale);
    setPhase({ kind: 'check', photo: url, found, offline: failed && !navigator.onLine, draft });
  }

  /** Cancel and Discard: the buttons come back, with the focus on "Scan a receipt". */
  function backToButtons() {
    scan.current?.abort();
    scan.current = null;
    dropPhoto();
    setError(null);
    setMoreOpen(false);
    focus.mark('scan');
    setPhase({ kind: 'idle' });
  }

  function update(change: Partial<ScanDraft>) {
    setPhase((now) => (now.kind === 'check' ? { ...now, draft: { ...now.draft, ...change } } : now));
  }

  async function save(draft: ScanDraft) {
    if (inFlight.current) return;
    setError(null);
    if (draft.date === '') return setError({ text: t.entries.form.pickDate, field: 'date' });
    if (draft.categoryId === null) return setError({ text: words.pickCategory, field: 'category' });
    const all = accounts ?? [];
    const account = all.find((candidate) => candidate.id === draft.accountId);
    if (account === undefined) return setError({ text: t.entries.noAccount, field: 'account' });

    inFlight.current = true;
    setBusy(true);
    try {
      const now = new Date();
      const result = buildEntry(
        {
          type: 'expense',
          date: draft.date,
          accountId: account.id,
          // 0 is refused by buildEntry, which words the message.
          amountMinor: parseAmount(draft.amount) ?? 0,
          categoryId: draft.categoryId,
          note: draft.note,
        },
        account,
        await loadRates(),
        now,
        undefined,
        lang,
      );
      if (!result.ok) {
        setError({ text: result.error, field: result.field });
        return;
      }
      await saveEntry(result.entry);
      const what = savedWhat(
        {
          amount: formatMoney(result.entry.amountMinor, account.currency, { locale }),
          note: result.entry.note,
          category: categoryNameIn(t, draft.categoryId),
          accountId: account.id,
          date: result.entry.date,
        },
        all,
        todayIso(now),
      );
      setKeepHeight(cardRef.current?.offsetHeight ?? null);
      dropPhoto();
      setMoreOpen(false);
      focus.mark('scan');
      setPhase({ kind: 'idle' });
      setSaved({ id: result.entry.id, message: t.entries.quickAdd.saved(what) });
    } catch (saveError) {
      console.error('StudentsBudget: could not save the scanned receipt', saveError);
      setError({ text: t.entries.saveFailed, field: null });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function undo() {
    if (saved === null) return;
    try {
      await deleteEntry(saved.id);
      setSaved(null);
      setHolding(false);
      focus.mark('scan');
    } catch (deleteError) {
      console.error('StudentsBudget: could not undo the scanned receipt', deleteError);
      setError({ text: t.entries.quickAdd.undoFailed, field: null });
    }
  }

  // The field a message is about says so, and reads the message with its name (accessibility, chunk 6).
  const errorId = `${id}-error`;
  const invalid = (field: FieldError['field']) => (error !== null && error.field === field) || undefined;
  const errorFor = (field: FieldError['field']) => invalid(field) && errorId;
  const alert = error && (
    <p id={errorId} role="alert" className="text-sm text-destructive">
      {error.text}
    </p>
  );
  const headingId = `${id}-heading`;
  const headingClass = 'text-xl font-extrabold outline-none';
  const percent = phase.kind === 'reading' ? Math.round(Math.min(Math.max(phase.progress, 0), 1) * 100) : 0;
  const account = phase.kind === 'check' ? accounts?.find((candidate) => candidate.id === phase.draft.accountId) : undefined;

  return (
    <div className="flex flex-col gap-2" style={keepHeight === null ? undefined : { minHeight: keepHeight }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFile}
      />

      {phase.kind === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <ImportLink />
          <Button ref={focus.refFor('scan')} type="button" variant="outline" className="h-full" onClick={onScan}>
            <CameraIcon aria-hidden="true" className="size-[18px]" />
            {words.button}
          </Button>
        </div>
      )}

      {phase.kind === 'note' && (
        <div role="group" aria-label={words.button} className={cn(cardVariants(), 'gap-2 text-sm')}>
          <p ref={focusOnMount} tabIndex={-1} className="outline-none">
            {words.firstScan(new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(engine.downloadMb))}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                writePref(NOTE_KEY, 'seen');
                focus.mark('scan');
                setPhase({ kind: 'idle' });
                // From the same tap, which is what lets the browser open the picker.
                openPicker();
              }}
            >
              {words.continue}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                focus.mark('scan');
                setPhase({ kind: 'idle' });
              }}
            >
              {words.cancel}
            </Button>
          </div>
        </div>
      )}

      {phase.kind === 'reading' && (
        <section key="reading" ref={cardRef} aria-labelledby={headingId} className={cardVariants()}>
          <h3 id={headingId} ref={focusOnMount} tabIndex={-1} className={headingClass}>
            {words.button}
          </h3>
          <div className="flex items-center gap-3">
            <Photo src={phase.photo} alt={words.photo} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <StatusLine className="text-sm">{words.reading}</StatusLine>
              <div
                role="progressbar"
                aria-label={words.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-3 overflow-hidden rounded-full border-[1.5px] border-outline bg-track"
              >
                <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{words.onPhone}</p>
          <Button type="button" variant="outline" onClick={backToButtons}>
            {words.cancel}
          </Button>
        </section>
      )}

      {phase.kind === 'check' && (
        <section key="check" ref={cardRef} aria-labelledby={headingId} className={cn(cardVariants(), 'gap-4')}>
          <div className="flex items-start gap-3">
            <Photo src={phase.photo} alt={words.photo} large />
            <div className="flex min-w-0 flex-col gap-1">
              <h3 id={headingId} ref={focusOnMount} tabIndex={-1} className={headingClass}>
                {phase.found ? words.checkHeading : words.failedHeading}
              </h3>
              <p className="text-sm text-muted-foreground">{phase.found ? words.checkHint : words.failedHint}</p>
            </div>
          </div>
          {!phase.found && (
            <div className="flex flex-col gap-2">
              {phase.offline && <p className="text-sm text-muted-foreground">{words.offline}</p>}
              <Button type="button" variant="outline" onClick={openPicker}>
                <CameraIcon aria-hidden="true" className="size-[18px]" />
                {words.tryAgain}
              </Button>
            </div>
          )}

          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save(phase.draft);
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-amount`}>{t.entries.form.amount}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`${id}-amount`}
                  className="flex-1"
                  inputMode="decimal"
                  autoComplete="off"
                  value={phase.draft.amount}
                  onChange={(event) => update({ amount: event.target.value })}
                  aria-invalid={invalid('amount')}
                  aria-describedby={describedBy(`${id}-currency`, errorFor('amount'))}
                />
                <span id={`${id}-currency`} className="w-10 text-sm text-muted-foreground">
                  {account?.currency}
                </span>
              </div>
            </div>
            <DateField
              pastFirst
              chips={false}
              value={phase.draft.date}
              onChange={(date) => update({ date })}
              invalid={invalid('date')}
              describedBy={describedBy(errorFor('date'))}
            />
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-note`}>{t.entries.form.note}</Label>
              <Input
                id={`${id}-note`}
                autoComplete="off"
                value={phase.draft.note}
                onChange={(event) => update({ note: event.target.value })}
              />
            </div>
            <div
              role="group"
              aria-labelledby={`${id}-category`}
              aria-describedby={describedBy(errorFor('category'))}
              className="flex flex-col gap-2"
            >
              <p id={`${id}-category`} className="text-sm leading-snug font-semibold">
                {t.entries.form.category}
              </p>
              <div className="flex flex-wrap gap-2">
                {chipIds(phase.draft.categoryId, moreOpen).map((categoryId) => {
                  const pressed = categoryId === phase.draft.categoryId;
                  return (
                    <Button
                      key={categoryId}
                      type="button"
                      variant="chip"
                      aria-pressed={pressed}
                      // The category's tint, until pressed: then the chip's own fill shows (an inline colour would win).
                      style={pressed ? undefined : { backgroundColor: categoryTint(categoryId) }}
                      onClick={() => update({ categoryId })}
                    >
                      {categoryNameIn(t, categoryId)}
                    </Button>
                  );
                })}
                <Button type="button" variant="chip" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
                  {t.entries.quickAdd.more}
                  <ChevronDownIcon aria-hidden="true" className={cn('transition-transform', moreOpen && 'rotate-180')} />
                </Button>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-account`}>{t.entries.form.account}</Label>
              <NativeSelect
                id={`${id}-account`}
                className="w-full"
                value={phase.draft.accountId}
                onChange={(event) => update({ accountId: event.target.value })}
                aria-invalid={invalid('account')}
                aria-describedby={describedBy(errorFor('account'))}
              >
                {(accounts ?? []).map((option) => (
                  <NativeSelectOption key={option.id} value={option.id}>
                    {t.common.accountOption(option.name, option.currency)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {alert}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {t.entries.form.saveExpense}
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full" onClick={backToButtons}>
              {words.discard}
            </Button>
          </form>
        </section>
      )}

      {phase.kind === 'idle' && saved !== null && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg bg-muted py-1 ps-4 pe-1"
          onFocus={() => setHolding(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setHolding(false);
          }}
          onPointerMove={(event) => {
            if (event.pointerType !== 'touch') setHolding(true);
          }}
          onPointerLeave={() => setHolding(false)}
        >
          <StatusLine key={saved.id} className="min-w-0 text-sm break-words">
            {saved.message}
          </StatusLine>
          <Button type="button" variant="ghost" className="shrink-0" onClick={() => void undo()}>
            {t.entries.quickAdd.undo}
          </Button>
        </div>
      )}
      {phase.kind !== 'check' && alert}
    </div>
  );
}
