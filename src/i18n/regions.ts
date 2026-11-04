// The app's regions (redesign, chunk 0: docs/superpowers/plans/2026-11-04-redesign.md). A region decides how a full
// date is shown, apart from the language: someone reading English in Germany still sees 04.11.2026, as on every
// German document they meet. This registry is the single source; nothing else hard-codes a region. Money and numbers
// still follow the language (`LANGUAGES[…].locale`).

/** A part of a full date. */
export type DatePart = 'day' | 'month' | 'year';

/** What the app needs to know about a region. */
export type RegionInfo = {
  /** Its name in its own language. */
  name: string;
  /** The order a full date's parts are written in. */
  dateOrder: readonly [DatePart, DatePart, DatePart];
  /** What stands between them. */
  dateSeparator: string;
};

export const REGIONS = {
  de: { name: 'Deutschland', dateOrder: ['day', 'month', 'year'], dateSeparator: '.' },
} as const satisfies Record<string, RegionInfo>;

export type Region = keyof typeof REGIONS;

/** The region every phone is in while it is the only one; a second region brings a choice in Settings. */
export const DEFAULT_REGION: Region = 'de';

/** Letters that stand for a date's parts in a language: "T", "M", "J" in German. */
export type DateLetters = Record<DatePart, string>;

/** A full date's parts in the region's order and with its separator: "2026-11-04" gives "04.11.2026" in Germany. */
export function regionDate(parts: Record<DatePart, string>, region: Region = DEFAULT_REGION): string {
  const { dateOrder, dateSeparator } = REGIONS[region];
  return dateOrder.map((part) => parts[part]).join(dateSeparator);
}

/** A regular expression's source for a full date as `regionDate` writes it in digits: "04.11.2026" in Germany. */
export function fullDatePattern(region: Region = DEFAULT_REGION): string {
  const { dateOrder, dateSeparator } = REGIONS[region];
  const separator = dateSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return dateOrder.map((part) => (part === 'year' ? '\\d{4}' : '\\d{2}')).join(separator);
}

/** The form a date field shows while it is empty, in the language's letters: "TT.MM.JJJJ" in German. */
export function datePlaceholder(letters: DateLetters, region: Region = DEFAULT_REGION): string {
  return regionDate({ day: letters.day.repeat(2), month: letters.month.repeat(2), year: letters.year.repeat(4) }, region);
}
