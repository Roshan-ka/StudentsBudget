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
import { fold } from './merchants';
import type { SkipReason, SkippedRow } from './plan-import';
import type { BankProfile } from './profiles';
import type { ReadRows } from './read-rows';
import { saveImport, undoImport, type SavedImport } from './save-import';
import { openStatement } from './statement';

// Settings → Import and export → Import a bank statement (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md,
// chunk 7): pick a file, see which bank it is from and how many rows it has, pick the account, import. The import saves
// straight away (Roshan, 09-11-2026); the summary that replaces the form says what was added and what was left out,
// with Undo. The file is read in this page's memory only: nothing of it is stored or sent.

type Step =
  | { kind: 'pick' }
  | { kind: 'reading' }
  | { kind: 'ready'; profile: BankProfile; read: ReadRows }
  | { kind: 'saving'; profile: BankProfile; read: ReadRows }
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
function accountFor(profile: BankProfile, accounts: readonly Account[]): Account | undefined {
  return accounts.find((account) => profile.accountHints.some((hint) => fold(account.name).includes(hint))) ?? defaultAccount(accounts);
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
      setAccountId(accountFor(statement.profile, accounts ?? [])?.id ?? '');
      return setStep({ kind: 'ready', profile: statement.profile, read: statement.read });
    }
    setStep({ kind: 'pick' });
    setProblem(
      statement.kind === 'tooBig'
        ? text.problems.tooBig
        : statement.kind === 'empty'
          ? text.problems.empty
          : statement.kind === 'unsupported'
            ? text.problems.creditCard(statement.profile.bank)
            : text.problems.unknown,
    );
  }

  async function onImport() {
    if (step.kind !== 'ready' || accountId === '') return;
    setStep({ kind: 'saving', profile: step.profile, read: step.read });
    setProblem(null);
    try {
      const saved = await saveImport({ read: step.read, accountId });
      if (saved.ok) return setStep({ kind: 'done', saved });
      setStep({ kind: 'ready', profile: step.profile, read: step.read });
      setProblem(saved.reason === 'noRate' ? text.problems.noRate(saved.currency) : text.problems.noAccount);
    } catch (saveError) {
      console.error('StudentsBudget: could not save the import', saveError);
      setStep({ kind: 'ready', profile: step.profile, read: step.read });
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
  const { read, profile } = step;
  const dates = read.rows.map((row) => row.date).sort();
  const rows = read.rows.length + read.unread.length;
  return (
    <div className="flex flex-col gap-3">
      <StatusLine className="text-sm font-medium">
        {dates.length > 0 ? text.recognised(profile.bank, rows, formatDate(dates[0]), formatDate(dates[dates.length - 1])) : text.recognised(profile.bank, rows, '–', '–')}
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
