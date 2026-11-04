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
import { dateFormat, numberFormat } from '@/i18n/format';
import { useT } from '@/i18n/use-t';
import { todayIso, type IsoDate } from '@/lib/dates';
import { CURRENCIES, type CurrencyCode } from '@/lib/money';

// Digits with an optional ',' or '.' decimal part; rates need more decimals than money does.
const RATE_PATTERN = /^\d+(?:[.,]\d{1,6})?$/;

/** What a person types ("95", "95,12", "95.12") as a rate; null unless it is a number greater than zero. */
function parseRate(text: string): number | null {
  const trimmed = text.trim();
  if (!RATE_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** "30 Oct", "30. Okt.". */
function formatDay(date: IsoDate, locale: string): string {
  return dateFormat(locale, { day: 'numeric', month: 'short' }).format(parseISO(date));
}

function RateRow({ currency, rate }: { currency: CurrencyCode; rate: Rate | undefined }) {
  const id = useId();
  const { t, locale } = useT();
  const words = t.accounts.rates;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isManual = rate?.source === 'manual';

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const perEur = parseRate(text);
    if (perEur === null) return setError(words.invalid);
    try {
      await setManualRate(currency, perEur, todayIso());
      setText('');
      setError(null);
    } catch (saveError) {
      console.error('StudentsBudget: could not save the exchange rate', saveError);
      setError(words.saveFailed);
    }
  }

  async function onUseEcb() {
    try {
      await clearManualRate(currency);
      setError(null);
    } catch (clearError) {
      console.error('StudentsBudget: could not remove the manual exchange rate', clearError);
      setError(words.ecbFailed);
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
          ? words.rate(
              numberFormat(locale, { maximumFractionDigits: 4 }).format(rate.perEur),
              currency,
              isManual ? words.setByYou : words.ecb(formatDay(rate.rateDate, locale)),
            )
          : words.noRate(currency)}
      </p>
      <form onSubmit={onSave} noValidate className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-rate`}>{words.yourRate(currency)}</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-rate`}
            className="flex-1"
            inputMode="decimal"
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoComplete="off"
          />
          <Button type="submit" variant="outline" className="px-4">
            {words.save}
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
          <Button variant="ghost" className="px-4" onClick={() => void onUseEcb()}>
            {words.useEcb}
          </Button>
        </div>
      )}
    </li>
  );
}

export function RatesPanel() {
  const { t } = useT();
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const rates = useLiveQuery(() => loadRates(), []);

  const currencies =
    accounts === undefined
      ? []
      : CURRENCIES.filter((code) => code !== 'EUR' && accounts.some((account) => account.currency === code));

  return (
    <section aria-labelledby="rates-heading" className="flex flex-col gap-3">
      <h3 id="rates-heading" className="text-lg font-semibold">
        {t.accounts.rates.heading}
      </h3>
      {accounts !== undefined && rates !== undefined && currencies.length === 0 && (
        <p className="text-muted-foreground">{t.accounts.rates.none}</p>
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
