'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { db } from '@/db/db';
import { loadRates, refreshRates } from '@/db/rates';
import { AccountHasScheduleError, AccountInUseError, accountUse, deleteAccount } from '@/db/repo';
import type { Account } from '@/db/types';
import { RowTile } from '@/features/home/row-card';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { useT } from '@/i18n/use-t';
import { todayIso } from '@/lib/dates';
import { describedBy } from '@/lib/described-by';
import { CURRENCIES, amountInputText, formatMoney, type CurrencyCode } from '@/lib/money';
import { newId } from '@/lib/new-id';
import { cn } from '@/lib/utils';
import { accountBalance, defaultAccount, sortAccounts, totalInEur } from './balances';
import { currencyFixed } from './currency-lock';
import { KIND_TILE } from './kind-tile';
import { isOverdrawn, parseSignedAmount, tickOverdrawn, typeOpening } from './opening-balance';
import { setDefaultAccount } from './set-default-account';
import { focusFirstControl, focusOnMount, useFocusAfter } from '@/lib/focus';

async function refreshExchangeRates() {
  try {
    await refreshRates(todayIso());
  } catch (error) {
    console.error('StudentsBudget: could not refresh the exchange rates', error);
  }
}

/** A message under the account form, and the field it is about (none when saving failed). */
type FormError = { text: string; field: 'name' | 'opening' | null };

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
  const { t, locale } = useT();
  const text = t.accounts;
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<Account['kind']>(account?.kind ?? 'bank');
  const [currency, setCurrency] = useState<CurrencyCode>(account?.currency ?? 'EUR');
  // An overdrawn balance is a minus sign in the text, so a typed "-250" and the checkbox say the same thing.
  const [opening, setOpening] = useState(account ? amountInputText(account.openingMinor, locale) : '');
  // Overdrawn ticked while the field was empty: the first thing typed takes the minus sign.
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState(false);
  // A newly chosen currency other than the euro waits for the note on the exchange rates (`PrivacyNote`).
  const [ratesNote, setRatesNote] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  /** Saves the account; `noteAccepted` comes from the note's Continue, so blocked storage can't loop the note. */
  async function submit(noteAccepted = false) {
    const trimmedName = name.trim();
    if (trimmedName === '') return setError({ text: text.errors.name, field: 'name' });
    const openingMinor = parseSignedAmount(opening);
    if (openingMinor === null) return setError({ text: text.errors.opening, field: 'opening' });
    if (currency !== 'EUR' && currency !== account?.currency && !noteAccepted && !noteSeen('rates')) {
      setError(null);
      return setRatesNote(true);
    }
    setRatesNote(false);

    setSaving(true);
    setError(null);
    try {
      // The field is locked while something uses the account (`currencyFixed`); this asks again, since another tab may
      // have booked on it or planned a line on it since the form opened.
      if (account && currency !== account.currency && (await accountUse(account.id)) !== null) {
        setError({ text: text.currencyLocked, field: null });
        setSaving(false);
        return;
      }
      await db.accounts.put({
        // The spread keeps what the form does not edit, such as the default mark.
        ...account,
        id: account?.id ?? newId(),
        name: trimmedName,
        kind,
        currency,
        openingMinor,
        createdAt: account?.createdAt ?? new Date().toISOString(),
      });
    } catch (saveError) {
      console.error('StudentsBudget: could not save the account', saveError);
      setError({ text: text.errors.saveFailed, field: null });
      setSaving(false);
      return;
    }
    onDone();
    // Not awaited: the rate appears through the live query once it arrives, and a slow network must not hold the form.
    if (currency !== 'EUR') void refreshExchangeRates();
  }

  // The field the message is about says so, and reads the message with its name (accessibility, chunk 6).
  const errorId = `${id}-error`;
  const invalid = (field: FormError['field']) => (error !== null && error.field === field) || undefined;
  const errorFor = (field: FormError['field']) => invalid(field) && errorId;

  return (
    // It opens on its first field (accessibility, chunk 4). The card it opens in is its frame: the account's own, or the
    // add form's.
    <form ref={focusFirstControl} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-name`}>{text.name}</Label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          aria-invalid={invalid('name')}
          aria-describedby={describedBy(errorFor('name'))}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-kind`}>{text.type}</Label>
        <NativeSelect
          id={`${id}-kind`}
          className="w-full"
          value={kind}
          onChange={(event) => setKind(event.target.value as Account['kind'])}
        >
          <NativeSelectOption value="bank">{text.kinds.bank}</NativeSelectOption>
          <NativeSelectOption value="cash">{text.kinds.cash}</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-currency`}>{text.currency}</Label>
        <NativeSelect
          id={`${id}-currency`}
          className="w-full"
          value={currency}
          disabled={currencyLocked}
          onChange={(event) => {
            setCurrency(event.target.value as CurrencyCode);
            setRatesNote(false);
          }}
        >
          {CURRENCIES.map((code) => (
            <NativeSelectOption key={code} value={code}>
              {code}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {currencyLocked && (
          <p className="text-sm text-muted-foreground">{text.currencyLocked}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-opening`}>{text.opening}</Label>
        <Input
          id={`${id}-opening`}
          inputMode="decimal"
          value={opening}
          onChange={(event) => {
            const typed = typeOpening(event.target.value, waiting);
            setWaiting(typed.waiting);
            setOpening(typed.text);
          }}
          autoComplete="off"
          aria-invalid={invalid('opening')}
          aria-describedby={describedBy(`${id}-opening-currency`, errorFor('opening'))}
        />
        {/* The currency, read with the field: the select above shows it to the eye. */}
        <span id={`${id}-opening-currency`} hidden>
          {currency}
        </span>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={isOverdrawn(opening, waiting)}
            onChange={(event) => {
              const ticked = tickOverdrawn(opening, event.target.checked);
              setWaiting(ticked.waiting);
              setOpening(ticked.text);
            }}
          />
          {t.common.amountField.overdrawn}
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error.text}
        </p>
      )}
      {ratesNote ? (
        <PrivacyNote
          id="rates"
          label={t.common.privacy.label}
          text={t.common.privacy.rates}
          continueLabel={t.common.privacy.continue}
          cancelLabel={t.common.privacy.cancel}
          onContinue={() => void submit(true)}
          onCancel={() => setRatesNote(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="px-4" disabled={saving}>
            {text.save}
          </Button>
          <Button type="button" variant="outline" className="px-4" onClick={onDone}>
            {text.cancel}
          </Button>
        </div>
      )}
    </form>
  );
}

/** Focus keys of the panel: an account's Edit and Delete, the Add button, and the heading. */
const editKey = (id: string) => `edit:${id}`;
const deleteKey = (id: string) => `delete:${id}`;
const ADD_KEY = 'add';
const HEADING_KEY = 'heading';

/** A small tag beside an account's name: its currency, and the default mark. */
const TAG =
  'inline-flex w-fit max-w-full items-center gap-1 rounded-full border-[1.5px] border-outline px-2.5 py-0.5 text-xs font-semibold';

export function AccountsPanel() {
  const { t, locale } = useT();
  const text = t.accounts;
  const accounts = useLiveQuery(async () => sortAccounts(await db.accounts.toArray()), []);
  const entries = useLiveQuery(() => db.entries.toArray(), []);
  // A fixed cost or income line posting to an account fixes its currency too (`currencyFixed`).
  const plan = useLiveQuery(() => db.plan.get('current'), []);
  const rates = useLiveQuery(() => loadRates(), []);
  // 'new' is the add form; an account id is that account's edit form.
  const [editing, setEditing] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  // Each row's Edit button, so focus has somewhere to go when "Make default" disappears under it.
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  // What a screen reader hears after "Make default"; it is spoken once, and only while that account is the default.
  const [defaultNotice, setDefaultNotice] = useState<{ id: string; message: string } | null>(null);
  // The account whose delete question is open, and where the focus goes as forms close and questions go.
  const [confirming, setConfirming] = useState<string | null>(null);
  const focus = useFocusAfter();

  async function remove(account: Account, neighbour: string) {
    setRowError(null);
    setConfirming(null);
    try {
      // Marked first: the row goes as soon as the database answers.
      focus.mark(neighbour);
      await deleteAccount(account.id);
    } catch (error) {
      // Still there, and the reason under it: the focus goes back to its Delete.
      focus.mark(deleteKey(account.id));
      if (error instanceof AccountInUseError) {
        setRowError({ id: account.id, message: text.errors.inUse });
      } else if (error instanceof AccountHasScheduleError) {
        setRowError({ id: account.id, message: text.errors.hasSchedule });
      } else {
        console.error('StudentsBudget: could not delete the account', error);
        setRowError({ id: account.id, message: text.errors.deleteFailed });
      }
    }
  }

  async function makeDefault(account: Account) {
    setRowError(null);
    try {
      await setDefaultAccount(account.id);
    } catch (error) {
      console.error('StudentsBudget: could not change the default account', error);
      setRowError({ id: account.id, message: text.errors.defaultFailed });
      return;
    }
    // The button that was tapped is replaced by the mark, and focus would fall to the page: the row's Edit takes it.
    editButtons.current.get(account.id)?.focus();
    setDefaultNotice({ id: account.id, message: text.nowDefault(account.name) });
  }

  const loaded = accounts !== undefined && entries !== undefined && rates !== undefined;
  // The marked account, or the one the rule picks while none is marked (or the marked one was deleted).
  const defaultId = loaded ? defaultAccount(accounts)?.id : undefined;
  const notice = defaultNotice !== null && defaultNotice.id === defaultId ? defaultNotice.message : '';
  const total = loaded && accounts.length > 0 ? totalInEur(accounts, entries, rates) : null;
  // Without a rate for any account's currency nothing was converted, and a total of €0.00 would read as real.
  const nothingConverted = loaded && total !== null && accounts.every((a) => total.missingRates.includes(a.currency));

  return (
    <>
      {/* The one number the page leads with, in the accent card with the bank's tile (Roshan's mockups, 16-11-2026). */}
      {total && (
        <section aria-labelledby="accounts-total-heading" className={cn(cardVariants({ variant: 'accent' }), 'gap-2')}>
          <div className="flex items-center gap-3">
            <RowTile icon={KIND_TILE.bank.icon} tint={KIND_TILE.bank.tint} />
            <h3 id="accounts-total-heading" className="min-w-0 font-sans text-sm font-semibold tracking-normal">
              {text.total}
            </h3>
          </div>
          {/* The card's whole width for the amount, so the cents fit at 320 px. */}
          <p className="font-heading text-4xl leading-tight font-extrabold tracking-tight tabular-nums break-words">
            {nothingConverted ? '—' : formatMoney(total.totalMinor, 'EUR', { locale })}
          </p>
          {total.missingRates.length > 0 && (
            <p className="text-sm">{text.withoutRates(total.missingRates.join(', '))}</p>
          )}
        </section>
      )}

      <section aria-labelledby="accounts-heading" className="flex flex-col gap-3">
        {/* Add account at the end of the heading's line, an outlined button with a plus (16-11-2026). */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h3
            ref={focus.refFor(HEADING_KEY)}
            id="accounts-heading"
            tabIndex={-1}
            className="text-xl leading-tight font-extrabold outline-none"
          >
            {text.heading}
          </h3>
          {editing !== 'new' && (
            <Button
              ref={focus.refFor(ADD_KEY)}
              variant="outline"
              onClick={() => {
                setRowError(null);
                setEditing('new');
              }}
            >
              <PlusIcon aria-hidden="true" />
              {text.add}
            </Button>
          )}
        </div>

        {/* Always rendered, so a screen reader is already listening when the text appears. A polite live region rather
            than role="status": Settings has other status lines that tests find by that role on the page. */}
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {notice}
        </p>

        {editing === 'new' && (
          <div className={cardVariants()}>
            <AccountForm
              currencyLocked={false}
              onDone={() => {
                focus.mark(ADD_KEY);
                setEditing(null);
              }}
            />
          </div>
        )}

        {loaded && accounts.length === 0 && editing !== 'new' && (
          <p className="text-muted-foreground">{text.none}</p>
        )}

        {loaded && accounts.length > 0 && (
          <ul aria-labelledby="accounts-heading" className="flex flex-col gap-3">
            {accounts.map((account, index) => (
              // Each account its own card (16-11-2026): its kind's tile, the name with its tags, the balance, then its
              // buttons. The edit form opens inside it.
              <li key={account.id} className={cardVariants()}>
                {editing === account.id ? (
                  <AccountForm
                    account={account}
                    currencyLocked={currencyFixed(account.id, entries ?? [], plan)}
                    onDone={() => {
                      focus.mark(editKey(account.id));
                      setEditing(null);
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      {/* The tile is the only place the kind shows, so a screen reader hears it: "Bank", "Cash". */}
                      <RowTile
                        icon={KIND_TILE[account.kind].icon}
                        tint={KIND_TILE[account.kind].tint}
                        label={text.kinds[account.kind]}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {/* The balance at the end of the name's line; where both don't fit (320 px, large text) it
                            moves under the name, still at the end, instead of squeezing the name to nothing. */}
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <p className="min-w-[min(7rem,100%)] flex-1 basis-0 font-semibold break-words">
                            {account.name}
                          </p>
                          <p className="ms-auto font-semibold tabular-nums">
                            {formatMoney(accountBalance(account, entries), account.currency, { locale })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={TAG}>{account.currency}</span>
                          {/* With one account there is nothing to choose between. */}
                          {accounts.length > 1 && account.id === defaultId && (
                            <span className={cn(TAG, 'bg-muted')}>
                              <StarIcon aria-hidden="true" className="size-3.5 shrink-0" />
                              {text.defaultMark}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Outlined, each with its icon (16-11-2026), and allowed to wrap rather than stick out at 200 %. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        ref={(node: HTMLButtonElement | null) => {
                          if (node) editButtons.current.set(account.id, node);
                          else editButtons.current.delete(account.id);
                          focus.refFor(editKey(account.id))(node);
                        }}
                        variant="outline"
                        className="max-w-full"
                        aria-label={text.editAccount(account.name)}
                        onClick={() => {
                          setRowError(null);
                          setEditing(account.id);
                        }}
                      >
                        <PencilIcon aria-hidden="true" />
                        {text.edit}
                      </Button>
                      {accounts.length > 1 && account.id !== defaultId && (
                        <Button
                          variant="outline"
                          className="max-w-full"
                          aria-label={text.makeDefaultOf(account.name)}
                          onClick={() => void makeDefault(account)}
                        >
                          <StarIcon aria-hidden="true" />
                          {text.makeDefault}
                        </Button>
                      )}
                      <Button
                        ref={focus.refFor(deleteKey(account.id))}
                        variant="outline"
                        className="max-w-full"
                        aria-label={text.deleteAccount(account.name)}
                        onClick={() => {
                          setRowError(null);
                          setConfirming(account.id);
                        }}
                      >
                        <Trash2Icon aria-hidden="true" />
                        {text.delete}
                      </Button>
                    </div>
                    {/* Asks first, as deleting an entry or a fixed cost does: the question takes the focus. */}
                    {confirming === account.id && (
                      <div
                        role="group"
                        aria-label={text.deleteQuestion(account.name)}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <p ref={focusOnMount} tabIndex={-1} className="me-auto font-semibold outline-none">
                          {text.deleteQuestion(account.name)}
                        </p>
                        <Button
                          variant="destructive"
                          className="px-4"
                          onClick={() => {
                            const next = accounts[index + 1] ?? accounts[index - 1];
                            void remove(account, next ? editKey(next.id) : HEADING_KEY);
                          }}
                        >
                          {text.delete}
                        </Button>
                        <Button
                          variant="outline"
                          className="px-4"
                          onClick={() => {
                            focus.mark(deleteKey(account.id));
                            setConfirming(null);
                          }}
                        >
                          {text.cancel}
                        </Button>
                      </div>
                    )}
                    {rowError?.id === account.id && (
                      <p role="alert" className="text-sm text-destructive">
                        {rowError.message}
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
