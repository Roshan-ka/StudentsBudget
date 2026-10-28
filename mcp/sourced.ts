import { formatDate, type IsoDate } from '../src/lib/dates.ts';

/** Every catalog item carries these: where its figure comes from, and the day that page was opened. */
export type Sourced = { source: string; url: string; checked: IsoDate };

/** The catalogs write `source: 'Estimate'` where no page states the number; the URL is what it is built on. */
export function isEstimate(item: Sourced): boolean {
  return item.source === 'Estimate';
}

/** "Source: …, https://…, checked 16-10-2026", or for an estimate what it rests on. */
export function sourceLine(item: Sourced): string {
  const checked = `checked ${formatDate(item.checked)}`;
  return isEstimate(item)
    ? `Estimate: no page states this number; it is built from ${item.url}, ${checked}`
    : `Source: ${item.source}, ${item.url}, ${checked}`;
}
