// Writes the AI's city pack from the app's own Regensburg data (the AI phase, chunk 8,
// docs/superpowers/plans/2026-11-09-ai-phase-1.md). scripts/write-city-pack.mjs runs it in plain Node, so its imports
// are relative with their extension; city-pack.test.ts fails when the written file is stale.
//
// Left out: the Deutschlandticket price, which the app never shows, and the beer price: no drinking advice.

import { CATEGORIES } from '../../../data/categories.ts';
import { CITIES } from '../../../data/cities.ts';
import { DISCOUNTS } from '../../../data/discounts.ts';
import { SEMESTER_FEES, SEMESTER_PERIODS } from '../../../data/semesters.ts';
import { SWAPS } from '../../../data/swaps.ts';
import { TIPS } from '../../../data/tips.ts';
import type { PackItem } from '../../../../supabase/functions/_shared/ai/pack.ts';

/** Prices the pack never carries, by their label in cities.ts. */
export const LEFT_OUT_PRICES: readonly string[] = ['Deutschlandticket per month', 'Beer in a bar (0.5 l)'];

const UNIVERSITY = { ur: 'Universität Regensburg (UR)', oth: 'OTH Regensburg' } as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** €12 for whole euros, €3.80 otherwise. */
function eur(minor: number): string {
  return minor % 100 === 0 ? `€${minor / 100}` : `€${(minor / 100).toFixed(2)}`;
}

/** "1 October" from "10-01". */
function dayOf(monthDay: string): string {
  const [month, day] = monthDay.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

function categoryName(id: string): string {
  return CATEGORIES.find((category) => category.id === id)?.name ?? id;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** A sentence ends with a full stop, once. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

const isEstimate = (source: string) => /^Estimate\b/.test(source);

export function buildCityPack(): PackItem[] {
  const city = CITIES.regensburg;
  const items: PackItem[] = [];

  for (const range of city.ranges) {
    items.push({
      id: `range:${range.categoryId}`,
      kind: 'range',
      categoryId: range.categoryId,
      text: `${categoryName(range.categoryId)} in Regensburg: ${eur(range.minMinor)}–${eur(range.maxMinor)} a month.`,
      source: range.source,
      checked: range.checked,
      estimate: isEstimate(range.source),
    });
  }

  for (const price of city.prices.filter((p) => !LEFT_OUT_PRICES.includes(p.label))) {
    items.push({
      id: `price:${slug(price.label)}`,
      kind: 'price',
      categoryId: null,
      text: `${price.label} in Regensburg: ${eur(price.minor)}.`,
      source: price.source,
      checked: price.checked,
      estimate: isEstimate(price.source),
    });
  }

  for (const tip of TIPS) {
    items.push({
      id: `tip:${tip.id}`,
      kind: 'tip',
      categoryId: tip.categoryId,
      text: `${categoryName(tip.categoryId)} tip: ${sentence(tip.title)} ${sentence(tip.body)}`,
      source: tip.source,
      checked: tip.checked,
      estimate: false,
    });
  }

  for (const discount of DISCOUNTS) {
    items.push({
      id: `discount:${discount.id}`,
      kind: 'discount',
      categoryId: discount.categoryId,
      text: `${categoryName(discount.categoryId)} discount: ${discount.place}, ${discount.address}: ${sentence(discount.offer)} ${sentence(discount.conditions)}`,
      source: discount.source,
      checked: discount.checked,
      estimate: false,
    });
  }

  for (const swap of SWAPS) {
    const toSource = swap.toSource ? `; ${swap.toSource}` : '';
    items.push({
      id: `swap:${swap.id}`,
      kind: 'swap',
      categoryId: swap.categoryId,
      text: `${categoryName(swap.categoryId)} swap: ${sentence(swap.title)} ${sentence(swap.body)} From ${eur(swap.fromMinor)} to ${eur(swap.toMinor)} per ${swap.per}.`,
      source: `${swap.source}${toSource}`,
      checked: swap.checked,
      estimate: swap.estimate === true,
    });
  }

  for (const period of SEMESTER_PERIODS) {
    items.push({
      id: `semester:${period.university}:${period.term}`,
      kind: 'semester',
      categoryId: null,
      text: `${UNIVERSITY[period.university]}, ${period.term} semester: ${dayOf(period.starts)} to ${dayOf(period.ends)}.`,
      source: period.source,
      checked: period.checked,
      estimate: false,
    });
  }

  for (const fee of SEMESTER_FEES) {
    const parts = fee.parts ?? [];
    const sourced = [...parts, ...(fee.reRegistration ? [fee.reRegistration] : [])];
    if (sourced.length === 0) continue;
    const total = parts.reduce((sum, part) => sum + part.minor, 0);
    const feeText =
      parts.length > 0
        ? ` The semester fee is ${eur(total)}: ${parts.map((part) => `${part.label} ${eur(part.minor)}`).join(', ')}.`
        : '';
    const opens = fee.reRegistration ? ` Re-registration (the fee is paid with it) opens in ${fee.reRegistration.month}.` : '';
    items.push({
      id: `fee:${fee.university}:${fee.starts}`,
      kind: 'fee',
      categoryId: null,
      text: `${UNIVERSITY[fee.university]}, semester starting ${fee.starts}:${feeText}${opens}`,
      source: [...new Set(sourced.map((part) => part.source))].join('; '),
      checked: sourced.map((part) => part.checked).sort().at(-1) ?? '',
      estimate: false,
    });
  }

  return items;
}

/**
 * The module the written file imports its type from, next to it. Built, not written out, so CI's import scanner
 * (scripts/ci-affected.mjs) doesn't take the written file's import for one of this file's.
 */
const PACK_MODULE = ['.', 'pack.ts'].join('/');

/** The text of supabase/functions/_shared/ai/city-pack.ts for these items. */
export function cityPackFile(items: readonly PackItem[]): string {
  return [
    '// The Regensburg data the AI may quote, written from src/data by scripts/write-city-pack.mjs: do not edit by hand.',
    '// Run `node scripts/write-city-pack.mjs` after changing src/data; src/features/ai/server/city-pack.test.ts fails',
    '// while this file is stale.',
    '',
    `import type { PackItem } from '${PACK_MODULE}';`,
    '',
    `export const CITY_PACK: readonly PackItem[] = ${JSON.stringify(items, null, 2)};`,
    '',
  ].join('\n');
}
