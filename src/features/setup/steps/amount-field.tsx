'use client';

import { useId, useState, type ReactNode, type Ref } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  isOverdrawn,
  parseOptionalAmount,
  parseSignedAmount,
  tickOverdrawn,
  typeOpening,
} from '@/features/accounts/opening-balance';
import { parseAmount, type Minor } from '@/lib/money';

/** What an empty field means: 0 (income, costs, envelopes), or no answer yet (guesses). */
type Blank = 'zero' | 'unset';

/** What the text may be: 0 or more, above 0, or below 0 too (an opening balance). */
type Range = 'optional' | 'positive' | 'signed';

/** `NaN` marks text that is not an amount; see `SetupDraft`. */
function parseField(text: string, blank: Blank, range: Range): Minor | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return blank === 'unset' ? undefined : 0;
  const parse = range === 'positive' ? parseAmount : range === 'signed' ? parseSignedAmount : parseOptionalAmount;
  return parse(trimmed) ?? Number.NaN;
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
 *
 * With `signed` the amount may be below zero, as an account's opening balance is: an "Overdrawn (below zero)"
 * checkbox sits under the field and puts a minus sign in its text, and a typed "-250" is accepted too.
 */
export function AmountField({
  label,
  hint,
  value,
  onChange,
  blank = 'zero',
  positive = false,
  signed = false,
  unit = '€',
  inputRef,
}: {
  label: string;
  hint?: ReactNode;
  value: Minor | undefined;
  onChange: (minor: Minor | undefined) => void;
  blank?: Blank;
  /** Zero is not allowed (the amount of a schedule in another currency). */
  positive?: boolean;
  /** Below zero is allowed, and the Overdrawn checkbox shows. */
  signed?: boolean;
  unit?: string;
  /** The input itself, for a caller that moves the focus to it. */
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  const range: Range = signed ? 'signed' : positive ? 'positive' : 'optional';
  const [text, setText] = useState(() => toText(value, blank));
  // Overdrawn ticked while the field was empty: the first thing typed takes the minus sign.
  const [waiting, setWaiting] = useState(false);
  const [touched, setTouched] = useState(false);
  const shown = sameAmount(parseField(text, blank, range), value) ? text : toText(value, blank);
  const showError = touched && value !== undefined && Number.isNaN(value);
  const describedBy = [hint ? `${id}-hint` : null, showError ? `${id}-error` : null].filter(Boolean).join(' ');

  function edit(next: string) {
    setText(next);
    onChange(parseField(next, blank, range));
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="leading-snug">
        {label}
      </Label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
        >
          {unit}
        </span>
        <Input
          id={id}
          ref={inputRef}
          className={unit.length > 1 ? 'h-10 pl-12' : 'h-10 pl-7'}
          inputMode="decimal"
          placeholder="0"
          autoComplete="off"
          value={shown}
          aria-invalid={showError || undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => {
            if (!signed) return edit(event.target.value);
            const typed = typeOpening(event.target.value, waiting);
            setWaiting(typed.waiting);
            edit(typed.text);
          }}
          onBlur={() => setTouched(true)}
        />
      </div>
      {signed && (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={isOverdrawn(shown, waiting)}
            onChange={(event) => {
              const ticked = tickOverdrawn(shown, event.target.checked);
              setWaiting(ticked.waiting);
              edit(ticked.text);
            }}
          />
          Overdrawn (below zero)
        </label>
      )}
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
