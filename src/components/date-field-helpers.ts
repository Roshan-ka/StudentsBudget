import { datePlaceholder, type DateLetters } from '@/i18n/regions';
import { addDays, formatDate, type IsoDate } from '@/lib/dates';

export type DateChipId = 'today' | 'yesterday';

/** The quick picks next to a date field, in the order they are shown (named by `t.common.dateField`). */
export const DATE_CHIPS: readonly DateChipId[] = ['today', 'yesterday'];

/** The date a chip stands for, given today's date. */
export function chipDate(chip: DateChipId, today: IsoDate): IsoDate {
  return chip === 'today' ? today : addDays(today, -1);
}

/** The chip that stands for `value`, or null for any other date and for an empty field. */
export function selectedChip(value: IsoDate, today: IsoDate): DateChipId | null {
  return DATE_CHIPS.find((chip) => chipDate(chip, today) === value) ?? null;
}

/**
 * The date as the field shows it, in the region's form (04.11.2026), or that form in the language's letters while the
 * field is empty (TT.MM.JJJJ in German).
 */
export function dateText(value: IsoDate, letters: DateLetters): string {
  return value === '' ? datePlaceholder(letters) : formatDate(value);
}
