'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/db/db';
import { clearManualRate, loadRates, refreshRates, setManualRate } from '@/db/rates';
import type { Rate } from '@/db/types';
import { todayIso, type IsoDate } from '@/lib/dates';
import { CURRENCIES, type CurrencyCode } from '@/lib/money';

const rateFormatter = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 4 });
const dayFormatter = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'short' });

// Digits with an optional ',' or '.' decimal part; rates need more decimals than money does.
const RATE_PATTERN = /^\d+(?:[.,]\d{1,6})?$/;

/** What a person types ("95", "95,12", "95.12") as a rate; null unless it is a number greater than zero. */
function parseRate(text: string): number | null {
  const trimmed = text.trim();
  if (!RATE_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatDay(date: IsoDate): string {
  return dayFormatter.format(parseISO(date));
}

function RateRow({ currency, rate }: { currency: CurrencyCode; rate: Rate | undefined }) {
  const id = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isManual = rate?.source === 'manual';

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const perEur = parseRate(text);
    if (perEur === null) return setError('Enter a rate greater than zero, like 95.12.');
    try {
      await setManualRate(currency, perEur, todayIso());
      setText('');
      setError(null);
    } catch (saveError) {
      console.error('StudentsBudget: could not save the exchange rate', saveError);
      setError('Could not save the rate.');
    }
  }

  async function onUseEcb() {
    try {
      await clearManualRate(currency);
      setError(null);
    } catch (clearError) {
      console.error('StudentsBudget: could not remove the manual exchange rate', clearError);
      setError('Could not switch back to the ECB rate.');
      return;
    }
    // The ECB row is normally stored already. If it never arrived (offline when the account was added), fetch it now.
    try {
      await refreshRates(todayIso());
    } catch (refreshError) {
      console.error('StudentsBudget: could not refresh the exchange rates', refreshError);
    }
  }

  return (
    <li className="flex flex-col gap-2 border-b py-3 last:border-b-0">
      <p className="font-medium">
        {rate
          ? `1 € = ${rateFormatter.format(rate.perEur)} ${currency} · ${isManual ? 'set by you' : `ECB, ${formatDay(rate.rateDate)}`}`
          : `No rate yet. Enter one to log ${currency} spending.`}
      </p>
      <form onSubmit={onSave} noValidate className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-rate`}>Your rate for {currency} per €1</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-rate`}
            className="h-10 flex-1"
            inputMode="decimal"
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoComplete="off"
          />
          <Button type="submit" variant="outline" className="h-10 px-4">
            Save rate
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {isManual && (
        <div>
          <Button variant="ghost" className="h-10 px-4" onClick={() => void onUseEcb()}>
            Use ECB rate again
          </Button>
        </div>
      )}
    </li>
  );
}

export function RatesPanel() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const rates = useLiveQuery(() => loadRates(), []);

  const currencies =
    accounts === undefined
      ? []
      : CURRENCIES.filter((code) => code !== 'EUR' && accounts.some((account) => account.currency === code));

  return (
    <section aria-labelledby="rates-heading" className="flex flex-col gap-3">
      <h3 id="rates-heading" className="text-lg font-semibold">
        Exchange rates
      </h3>
      {accounts !== undefined && rates !== undefined && currencies.length === 0 && (
        <p className="text-muted-foreground">Rates show up here once you add an account in another currency.</p>
      )}
      {rates !== undefined && currencies.length > 0 && (
        <ul className="flex flex-col">
          {currencies.map((code) => (
            <RateRow key={code} currency={code} rate={rates[code]} />
          ))}
        </ul>
      )}
    </section>
  );
}
