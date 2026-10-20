import { RangeSource } from '@/features/setup/steps/range-source';
import { formatMoney } from '@/lib/money';
import { monthLabel, type SemesterFeeOffer } from './profile';

/**
 * Where the offered semester fee's numbers come from: each sourced part of the amount, and the re-registration month
 * it is due in, each with its source collapsed. Without a stated fee it says the amount is the person's to fill in.
 */
export function SemesterFeeSource({ offer }: { offer: SemesterFeeOffer }) {
  const { row, parts, reRegistration } = offer;
  const amount =
    parts.length > 0
      ? `${parts.map((p) => `${formatMoney(p.minor, 'EUR')} ${p.label}`).join(' + ')}.`
      : "No page states this semester's fee yet, so the amount is yours to fill in.";
  const due = reRegistration
    ? `Due in ${monthLabel(row.dueMonth)}, when re-registration opens.`
    : `Due in ${monthLabel(row.dueMonth)}, the month before the semester starts.`;

  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <p className="break-words">{amount}</p>
      {parts.map((part) => (
        <RangeSource key={part.label} range={part} label={`Source: ${part.label}`} />
      ))}
      <p>{due}</p>
      {reRegistration && <RangeSource range={reRegistration} label="Source: re-registration" />}
    </div>
  );
}
