'use client';

import { useId, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseOpeningBalance } from '@/features/accounts/opening-balance';
import { parseAmount, type Minor } from '@/lib/money';

/** What an empty field means: 0 (income, costs, envelopes), or no answer yet (guesses). */
type Blank = 'zero' | 'unset';

/** `NaN` marks text that is not an amount; see `SetupDraft`. */
function parseField(text: string, blank: Blank, positive: boolean): Minor | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return blank === 'unset' ? undefined : 0;
  return (positive ? parseAmount(trimmed) : parseOpeningBalance(trimmed)) ?? Number.NaN;
}

const sameAmount = (a: Minor | undefined, b: Minor | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && Number.isNaN(a) && Number.isNaN(b));

function toText(value: Minor | undefined, blank: Blank): string {
  if (value === undefined || Number.isNaN(value)) return '';
  if (value === 0 && blank === 'zero') return '';
  return value % 100 === 0 ? String(value / 100) : (value / 100).toFixed(2);
}

/**
 * A money field. The text lives here so half-typed input survives; the parsed amount goes up through
 * `onChange`. Text that is not an amount is reported as `NaN` and shown as an error once the field
 * loses focus. When `value` no longer matches the text (a row above was removed, say), the field shows
 * `value`. `hint` sits under the input.
 */
export function AmountField({
  label,
  hint,
  value,
  onChange,
  blank = 'zero',
  positive = false,
  unit = '€',
}: {
  label: string;
  hint?: ReactNode;
  value: Minor | undefined;
  onChange: (minor: Minor | undefined) => void;
  blank?: Blank;
  /** Zero is not allowed (a one-off cost). */
  positive?: boolean;
  unit?: string;
}) {
  const id = useId();
  const [text, setText] = useState(() => toText(value, blank));
  const [touched, setTouched] = useState(false);
  const shown = sameAmount(parseField(text, blank, positive), value) ? text : toText(value, blank);
  const showError = touched && value !== undefined && Number.isNaN(value);
  const describedBy = [hint ? `${id}-hint` : null, showError ? `${id}-error` : null].filter(Boolean).join(' ');

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
        >
          {unit}
        </span>
        <Input
          id={id}
          className={unit.length > 1 ? 'h-10 pl-12' : 'h-10 pl-7'}
          inputMode="decimal"
          placeholder="0"
          autoComplete="off"
          value={shown}
          aria-invalid={showError || undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => {
            setText(event.target.value);
            onChange(parseField(event.target.value, blank, positive));
          }}
          onBlur={() => setTouched(true)}
        />
      </div>
      {hint && (
        <div id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </div>
      )}
      {showError && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {positive ? 'Enter an amount above 0, like 250 or 12.50.' : 'Enter a number, like 250 or 12.50.'}
        </p>
      )}
    </div>
  );
}
