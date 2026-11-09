// Amounts of money in a text, as the model or the city pack writes them (the AI phase, chunk 8,
// docs/superpowers/plans/2026-11-09-ai-phase-1.md): in English (€12.50, €1,250), German and Spanish (12,50 €,
// 1.250 €), French (1 006,50 €, with any space), or with EUR or "euro". Ask uses it to find an amount in an answer
// that nothing the model was given backs.

/** A number as people write money: groups of three apart by a point, comma or space, and up to two decimals. */
const NUMBER = String.raw`\d{1,3}(?:[.,   ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const BEFORE = new RegExp(String.raw`(?:€|\bEUR)[   ]?(${NUMBER})`, 'g');
const AFTER = new RegExp(String.raw`(${NUMBER})[   ]?(?:€|EUR\b|[Ee]uros?\b)`, 'g');

export type Mention = { written: string; cents: number; at: number };

/** The number in cents: the last point or comma followed by one or two digits is the decimal mark, the rest group. */
function centsOf(number: string): number {
  const compact = number.replace(/[   ]/g, '');
  const decimal = /[.,](\d{1,2})$/.exec(compact);
  const whole = (decimal ? compact.slice(0, decimal.index) : compact).replace(/[.,]/g, '');
  const fraction = decimal ? decimal[1].padEnd(2, '0') : '00';
  return Number(whole) * 100 + Number(fraction);
}

/** Every amount of money the text names, in the order written. */
export function moneyIn(text: string): Mention[] {
  const found: Mention[] = [];
  const taken: [number, number][] = [];
  for (const pattern of [BEFORE, AFTER]) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (taken.some(([from, to]) => start < to && end > from)) continue;
      taken.push([start, end]);
      found.push({ written: match[0].trim(), cents: centsOf(match[1]), at: start });
    }
  }
  return found.sort((a, b) => a.at - b.at);
}
