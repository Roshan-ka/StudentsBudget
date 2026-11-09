'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { db } from '@/db/db';
import type { Account } from '@/db/types';
import { defaultAccount, sortAccounts } from '@/features/accounts/balances';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { formatDate } from '@/lib/dates';
import { describedBy } from '@/lib/described-by';
import { useFocusAfter, useFocusOnMount } from '@/lib/focus';
import { CURRENCIES, formatMoney, type CurrencyCode, type Minor } from '@/lib/money';
import { guessChoice, isComplete, mappingOf, rememberChoice, rememberedChoice, type ColumnChoice } from './mapping';
import { fold } from './merchants';
import type { SkipReason, SkippedRow } from './plan-import';
import { readRows, type ReadRows, type Table } from './read-rows';
import { saveImport, undoImport, type SavedImport } from './save-import';
import { openStatement } from './statement';

// Settings → Import and export → Import a bank statement (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md,
// chunks 7 and 8): pick a file, see which bank it is from and how many rows it has (or, for a CSV the app doesn't
// recognise, say which column holds what), pick the account, import. The import saves straight away (Roshan,
// 09-11-2026); the summary that replaces the form says what was added and what was left out, with Undo. The file is read
// in this page's memory only: nothing of it is stored or sent.

/** Where the rows came from: a recognised bank (its name, and the words that find its account), or columns matched by hand. */
type Source = { bank: string; hints: readonly string[] } | null;

type Step =
  | { kind: 'pick' }
  | { kind: 'reading' }
  | { kind: 'match'; table: Table; choice: ColumnChoice; remembered: boolean }
  | { kind: 'ready'; source: Source; read: ReadRows }
  | { kind: 'saving'; source: Source; read: ReadRows }
  | { kind: 'done'; saved: SavedImport };

/** The order the summary lists the reasons in: what the student can act on first. */
const REASON_ORDER: readonly SkipReason[] = [
  'duplicate',
  'pending',
  'beforePlan',
  'future',
  'currency',
  'noTransferAccount',
  'otherCurrencyTransfer',
  'internal',
  'zero',
  'unreadable',
];

/** The account a statement is for: one whose name holds the bank's name, else the default one. */
function accountFor(source: Source, accounts: readonly Account[]): Account | undefined {
  const hints = source?.hints ?? [];
  return accounts.find((account) => hints.some((hint) => fold(account.name).includes(hint))) ?? defaultAccount(accounts);
}

function money(minor: Minor, currency: string | null, locale: string): string {
  if (currency !== null && (CURRENCIES as string[]).includes(currency)) return formatMoney(minor, currency as CurrencyCode, { locale });
  return `${(minor / 100).toLocaleString(locale, { minimumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
}

export function ImportStatement() {
  const id = useId();
  const { t } = useT();
  const text = t.importExport.import;
  const accounts = useLiveQuery(async () => sortAccounts(await db.accounts.toArray()), []);
  // null once read and absent; undefined while still reading.
  const plan = useLiveQuery(async () => (await db.plan.get('current')) ?? null, []);
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [accountId, setAccountId] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
  const latestPick = useRef(0);
  const focus = useFocusAfter();

  if (accounts === undefined || plan === undefined) return null;

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    latestPick.current += 1;
    const pick = latestPick.current;
    setProblem(null);
    setUndone(null);
    if (file === undefined) return setStep({ kind: 'pick' });
    setStep({ kind: 'reading' });
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch (readError) {
      console.error('StudentsBudget: could not read the statement file', readError);
      if (pick === latestPick.current) {
        setStep({ kind: 'pick' });
        setProblem(text.problems.failed);
      }
      return;
    }
    // A newer pick while this one was being read wins.
    if (pick !== latestPick.current) return;
    const statement = openStatement(bytes);
    if (statement.kind === 'bank') {
      const source = { bank: statement.profile.bank, hints: statement.profile.accountHints };
      setAccountId(accountFor(source, accounts ?? [])?.id ?? '');
      return setStep({ kind: 'ready', source, read: statement.read });
    }
    if (statement.kind === 'unknown') {
      // Matched as last time for a file with the same header row, else the app's own guess.
      const remembered = rememberedChoice(statement.table.header);
      return setStep({ kind: 'match', table: statement.table, choice: remembered ?? guessChoice(statement.table), remembered: remembered !== null });
    }
    setStep({ kind: 'pick' });
    setProblem(
      statement.kind === 'tooBig'
        ? text.problems.tooBig
        : statement.kind === 'empty'
          ? text.problems.empty
          : text.problems.creditCard(statement.profile.bank),
    );
  }

  /** The columns as matched: remembered for files with this header row, and read. */
  function onMatched(table: Table, choice: ColumnChoice) {
    rememberChoice(table.header, choice);
    setAccountId(accountFor(null, accounts ?? [])?.id ?? '');
    setStep({ kind: 'ready', source: null, read: readRows(table, mappingOf(choice, table.header)) });
  }

  async function onImport() {
    if (step.kind !== 'ready' || accountId === '') return;
    const { source, read } = step;
    setStep({ kind: 'saving', source, read });
    setProblem(null);
    try {
      const saved = await saveImport({ read, accountId });
      if (saved.ok) return setStep({ kind: 'done', saved });
      setStep({ kind: 'ready', source, read });
      setProblem(saved.reason === 'noRate' ? text.problems.noRate(saved.currency) : text.problems.noAccount);
    } catch (saveError) {
      console.error('StudentsBudget: could not save the import', saveError);
      setStep({ kind: 'ready', source, read });
      setProblem(text.problems.saveFailed);
    }
  }

  function startOver(message: string | null = null) {
    latestPick.current += 1;
    focus.mark('file');
    setUndone(message);
    setProblem(null);
    setStep({ kind: 'pick' });
  }

  async function onUndo(saved: SavedImport) {
    try {
      const { removed } = await undoImport(saved);
      startOver(t.importExport.result.undone(removed));
    } catch (undoError) {
      console.error('StudentsBudget: could not undo the import', undoError);
    }
  }

  const headingId = `${id}-heading`;
  const problemId = `${id}-problem`;

  return (
    <section aria-labelledby={headingId} className={cardVariants()}>
      <h3 id={headingId} className="text-lg leading-tight font-bold">
        {text.heading}
      </h3>
      {plan === null ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>{text.noPlan}</p>
          <Link href="/setup" className="font-semibold text-primary underline underline-offset-4">
            {text.toSetup}
          </Link>
        </div>
      ) : step.kind === 'done' ? (
        <ImportSummary saved={step.saved} accounts={accounts} onUndo={() => void onUndo(step.saved)} onAnother={() => startOver()} />
      ) : (
        <div className="flex flex-col gap-3">
          {undone && <StatusLine className="text-sm">{undone}</StatusLine>}
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {text.hint}
          </p>
          {step.kind === 'pick' || step.kind === 'reading' ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-file`}>{text.file}</Label>
              <Input
                ref={focus.refFor('file')}
                id={`${id}-file`}
                type="file"
                accept=".csv,text/csv"
                aria-describedby={describedBy(`${id}-hint`, problem && problemId)}
                aria-invalid={problem ? true : undefined}
                onChange={(event) => void onPick(event)}
              />
              {step.kind === 'reading' && <StatusLine className="text-sm">{text.reading}</StatusLine>}
            </div>
          ) : step.kind === 'match' ? (
            <ColumnMatching
              id={id}
              table={step.table}
              initial={step.choice}
              remembered={step.remembered}
              onUse={(choice) => onMatched(step.table, choice)}
              onChoose={() => startOver()}
            />
          ) : (
            <Ready
              id={id}
              step={step}
              accounts={accounts}
              accountId={accountId}
              onAccount={setAccountId}
              onImport={() => void onImport()}
              onChoose={() => startOver()}
              text={text}
            />
          )}
          {problem && (
            <p id={problemId} role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** A recognised statement: the bank and its rows, the account to import into, and Import. */
function Ready({
  id,
  step,
  accounts,
  accountId,
  onAccount,
  onImport,
  onChoose,
  text,
}: {
  id: string;
  step: Extract<Step, { kind: 'ready' | 'saving' }>;
  accounts: readonly Account[];
  accountId: string;
  onAccount: (id: string) => void;
  onImport: () => void;
  onChoose: () => void;
  text: Messages['importExport']['import'];
}) {
  const { t } = useT();
  const { read, source } = step;
  const dates = read.rows.map((row) => row.date).sort();
  const rows = read.rows.length + read.unread.length;
  const from = dates.length > 0 ? formatDate(dates[0]) : '–';
  const to = dates.length > 0 ? formatDate(dates[dates.length - 1]) : '–';
  return (
    <div className="flex flex-col gap-3">
      <StatusLine className="text-sm font-medium">
        {source === null ? t.importExport.match.file(rows, from, to) : text.recognised(source.bank, rows, from, to)}
      </StatusLine>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-account`}>{text.account}</Label>
        <NativeSelect id={`${id}-account`} className="w-full" value={accountId} onChange={(event) => onAccount(event.target.value)}>
          {accounts.map((account) => (
            <NativeSelectOption key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" onClick={onImport} disabled={step.kind === 'saving' || accountId === ''}>
          {text.submit}
        </Button>
        <Button type="button" variant="outline" onClick={onChoose} disabled={step.kind === 'saving'}>
          {text.choose}
        </Button>
      </div>
    </div>
  );
}

/** How many of a file's rows the matching form shows, read with the columns as chosen. */
const PREVIEW_ROWS = 3;

/**
 * A CSV the app doesn't recognise (chunk 8): which column holds the date (and in which order), the amount (one signed
 * column, or money out and money in), who was paid, and the optional details and currency. It opens on the app's
 * guess, or on the choice made for the last file with this header row; the first rows show how the file reads.
 */
function ColumnMatching({
  id,
  table,
  initial,
  remembered,
  onUse,
  onChoose,
}: {
  id: string;
  table: Table;
  initial: ColumnChoice;
  remembered: boolean;
  onUse: (choice: ColumnChoice) => void;
  onChoose: () => void;
}) {
  const { t, locale } = useT();
  const text = t.importExport.match;
  const [choice, setChoice] = useState(initial);
  const [error, setError] = useState(false);
  const heading = useFocusOnMount<HTMLHeadingElement>();

  const columnName = (index: number) => table.header[index]?.trim() || `#${index + 1}`;
  const options = table.header.map((_, index) => (
    <NativeSelectOption key={index} value={String(index)}>
      {columnName(index)}
    </NativeSelectOption>
  ));
  const none = <NativeSelectOption value="-1">{text.none}</NativeSelectOption>;
  const update = (next: Partial<ColumnChoice>) => {
    setError(false);
    setChoice((current) => ({ ...current, ...next }));
  };
  const columnSelect = (key: string, label: string, value: number | null, onChange: (column: number | null) => void, optional = false) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <NativeSelect
        id={`${id}-${key}`}
        className="w-full"
        value={String(value ?? -1)}
        aria-describedby={error ? `${id}-match-error` : undefined}
        onChange={(event) => {
          const column = Number(event.target.value);
          onChange(column < 0 ? null : column);
        }}
      >
        {optional && none}
        {options}
      </NativeSelect>
    </div>
  );

  const preview = readRows({ ...table, rows: table.rows.slice(0, PREVIEW_ROWS) }, mappingOf(choice, table.header));
  const previewLines = [
    ...preview.rows.map((row) => ({ index: row.index, line: [formatDate(row.date), money(row.amountMinor, row.currency, locale), row.payee].filter(Boolean).join(' · ') })),
    ...preview.unread.map((row) => ({ index: row.index, line: `${text.unreadable}: ${row.text}` })),
  ].sort((a, b) => a.index - b.index);

  function use() {
    if (!isComplete(choice, table.header)) return setError(true);
    onUse(choice);
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {text.heading}
      </h4>
      <p className="text-sm text-muted-foreground">{remembered ? text.remembered : text.intro}</p>
      {columnSelect('date', text.date, choice.date, (column) => update({ date: column ?? 0 }))}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-order`}>{text.dateOrder}</Label>
        <NativeSelect
          id={`${id}-order`}
          className="w-full"
          value={choice.dateOrder}
          onChange={(event) => update({ dateOrder: event.target.value as ColumnChoice['dateOrder'] })}
        >
          {(['dmy', 'ymd', 'mdy'] as const).map((order) => (
            <NativeSelectOption key={order} value={order}>
              {text.orders[order]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-amount-kind`}>{text.amountKind}</Label>
        <NativeSelect
          id={`${id}-amount-kind`}
          className="w-full"
          value={choice.amount.kind}
          onChange={(event) => {
            const first = choice.amount.kind === 'one' ? choice.amount.column : choice.amount.out;
            update({
              amount: event.target.value === 'two' ? { kind: 'two', out: first, in: Math.min(first + 1, table.header.length - 1) } : { kind: 'one', column: first },
            });
          }}
        >
          <NativeSelectOption value="one">{text.amountKinds.one}</NativeSelectOption>
          <NativeSelectOption value="two">{text.amountKinds.two}</NativeSelectOption>
        </NativeSelect>
      </div>
      {choice.amount.kind === 'one' ? (
        columnSelect('amount', text.amount, choice.amount.column, (column) => update({ amount: { kind: 'one', column: column ?? 0 } }))
      ) : (
        <>
          {columnSelect('out', text.out, choice.amount.out, (column) =>
            update({ amount: { kind: 'two', out: column ?? 0, in: choice.amount.kind === 'two' ? choice.amount.in : 0 } }),
          )}
          {columnSelect('in', text.in, choice.amount.in, (column) =>
            update({ amount: { kind: 'two', out: choice.amount.kind === 'two' ? choice.amount.out : 0, in: column ?? 0 } }),
          )}
        </>
      )}
      {columnSelect('payee', text.payee, choice.payee, (column) => update({ payee: column ?? 0 }))}
      {columnSelect('purpose', text.purpose, choice.purpose, (column) => update({ purpose: column }), true)}
      {columnSelect('currency', text.currency, choice.currency, (column) => update({ currency: column }), true)}
      <div className="flex flex-col gap-1">
        <h5 className="text-sm font-semibold">{text.preview}</h5>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {previewLines.map(({ index, line }) => (
            <li key={index} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      </div>
      {error && (
        <p id={`${id}-match-error`} role="alert" className="text-sm text-destructive">
          {text.twice}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" onClick={use}>
          {text.use}
        </Button>
        <Button type="button" variant="outline" onClick={onChoose}>
          {t.importExport.import.choose}
        </Button>
      </div>
    </div>
  );
}

/** What the import did, in place of the form: what was added, the starting balances that moved, what was left out. */
function ImportSummary({
  saved,
  accounts,
  onUndo,
  onAnother,
}: {
  saved: SavedImport;
  accounts: readonly Account[];
  onUndo: () => void;
  onAnother: () => void;
}) {
  const { t, locale } = useT();
  const text = t.importExport.result;
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const transfers = saved.added.filter((entry) => entry.type === 'transfer').length;
  const byReason = new Map<SkipReason, SkippedRow[]>();
  for (const row of saved.skipped) byReason.set(row.reason, [...(byReason.get(row.reason) ?? []), row]);

  return (
    <div className="flex flex-col gap-3">
      <h4 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {text.heading}
      </h4>
      <p className="text-sm">{saved.added.length > 0 ? text.added(saved.added.length, transfers) : text.nothing}</p>
      {[...saved.openingChanges].map(([accountId, change]) => {
        const account = accounts.find((candidate) => candidate.id === accountId);
        if (account === undefined) return null;
        return (
          <p key={accountId} className="text-sm">
            {text.opening(account.name, formatMoney(change, account.currency, { locale }))}
          </p>
        );
      })}
      {saved.skipped.length > 0 && (
        <div className="flex flex-col gap-2">
          <h5 className="text-sm font-semibold">{text.skipped(saved.skipped.length)}</h5>
          {REASON_ORDER.filter((reason) => byReason.has(reason)).map((reason) => (
            <div key={reason} className="flex flex-col gap-1">
              <p className="text-sm font-medium">{text.reasons[reason]}</p>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {(byReason.get(reason) ?? []).map((row) => (
                  <li key={row.index} className="break-words">
                    {[row.date ? formatDate(row.date) : null, row.amountMinor !== null ? money(row.amountMinor, row.currency, locale) : null, row.text]
                      .filter((part) => part !== null && part !== '')
                      .join(' · ')}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {saved.added.length > 0 && (
          <Button type="button" variant="outline" onClick={onUndo}>
            {text.undo}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onAnother}>
          {text.another}
        </Button>
      </div>
    </div>
  );
}
