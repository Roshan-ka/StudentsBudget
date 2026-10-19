import { addDays, formatDate, type IsoDate } from '@/lib/dates';

export type DateChipId = 'today' | 'yesterday';

/** The quick picks next to a date field, in the order they are shown. */
export const DATE_CHIPS: readonly { id: DateChipId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
];

/** What the field shows while it holds no date. */
export const DATE_PLACEHOLDER = 'DD-MM-YYYY';

/** The date a chip stands for, given today's date. */
export function chipDate(chip: DateChipId, today: IsoDate): IsoDate {
  return chip === 'today' ? today : addDays(today, -1);
}

/** The chip that stands for `value`, or null for any other date and for an empty field. */
export function selectedChip(value: IsoDate, today: IsoDate): DateChipId | null {
  return DATE_CHIPS.find((chip) => chipDate(chip.id, today) === value)?.id ?? null;
}

/** The date as the field shows it: DD-MM-YYYY, or the format itself while the field is empty. */
export function dateText(value: IsoDate): string {
  return value === '' ? DATE_PLACEHOLDER : formatDate(value);
}
