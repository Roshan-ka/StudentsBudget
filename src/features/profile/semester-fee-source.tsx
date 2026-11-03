'use client';

import { RangeSource } from '@/features/setup/steps/range-source';
import { useT } from '@/i18n/use-t';
import { formatMoney } from '@/lib/money';
import { monthLabel, type SemesterFeeOffer } from './profile';

/**
 * Where the offered semester fee's numbers come from: each sourced part of the amount, and the re-registration month
 * it is due in, each with its source collapsed. Without a stated fee it says the amount is the person's to fill in.
 * A part's label is sourced content and stays as the data has it.
 */
export function SemesterFeeSource({ offer }: { offer: SemesterFeeOffer }) {
  const { t, locale } = useT();
  const text = t.profile.fee;
  const { row, parts, reRegistration } = offer;
  const amount =
    parts.length > 0
      ? `${parts.map((p) => `${formatMoney(p.minor, 'EUR', { locale })} ${p.label}`).join(' + ')}.`
      : text.noFee;
  const month = monthLabel(row.dueMonth, locale);
  const due = reRegistration ? text.dueReRegistration(month) : text.dueBeforeSemester(month);

  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <p className="break-words">{amount}</p>
      {parts.map((part) => (
        <RangeSource key={part.label} range={part} label={t.common.source.of(part.label)} />
      ))}
      <p>{due}</p>
      {reRegistration && <RangeSource range={reRegistration} label={t.common.source.of(text.reRegistration)} />}
    </div>
  );
}
