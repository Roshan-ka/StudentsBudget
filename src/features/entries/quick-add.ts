import type { Entry } from '@/db/types';
import { parseAmount, type Minor } from '@/lib/money';

const MARKERS = new Set(['€', 'eur', 'euro', 'euros']);

const UNITS = new Map([
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9],
]);
const SMALL = new Map([
  ['zero', 0], ['ten', 10], ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14], ['fifteen', 15],
  ['sixteen', 16], ['seventeen', 17], ['eighteen', 18], ['nineteen', 19],
]);
const TENS = new Map([
  ['twenty', 20], ['thirty', 30], ['forty', 40], ['fifty', 50], ['sixty', 60], ['seventy', 70], ['eighty', 80],
  ['ninety', 90],
]);

/** "twenty-five": a tens word, a hyphen and a unit word. */
const HYPHEN_COMPOUND = new RegExp(`^(${[...TENS.keys()].join('|')})-(${[...UNITS.keys()].join('|')})$`);

/** A number found in the line: tokens `start` to `end` (inclusive), in minor units. */
type Candidate = { start: number; end: number; minor: Minor; attached: boolean };

type Word = { word: string; token: number };
type Reading = { value: number; end: number };

function isMarker(token: string | undefined): boolean {
  return token !== undefined && MARKERS.has(token.toLowerCase());
}

/** "€6" and "6€" give "6" and `attached`. */
function stripEuroSign(token: string): { core: string; attached: boolean } {
  if (token.startsWith('€')) return { core: token.slice(1), attached: true };
  if (token.endsWith('€')) return { core: token.slice(0, -1), attached: true };
  return { core: token, attached: false };
}

/** Lower-cased words, one per token; a hyphen compound like "twenty-five" gives two. */
function toWords(tokens: string[]): Word[] {
  return tokens.flatMap((token, index) => {
    const lower = token.toLowerCase();
    const compound = HYPHEN_COMPOUND.exec(lower);
    return (compound ? [compound[1], compound[2]] : [lower]).map((word) => ({ word, token: index }));
  });
}

/** Zero to ninety-nine, read from word `i`. */
function readBelowHundred(words: Word[], i: number): Reading | null {
  const word = words[i]?.word ?? '';
  const small = SMALL.get(word) ?? UNITS.get(word);
  if (small !== undefined) return { value: small, end: i + 1 };

  const tens = TENS.get(word);
  if (tens === undefined) return null;
  const unit = UNITS.get(words[i + 1]?.word ?? '');
  return unit === undefined ? { value: tens, end: i + 1 } : { value: tens + unit, end: i + 2 };
}

/** A number up to 999, read from word `i`: "hundred" with an optional unit or "a" before it and a number after it. */
function readNumberWords(words: Word[], i: number): Reading | null {
  const word = words[i]?.word ?? '';
  const unitBefore = word === 'a' ? 1 : UNITS.get(word);

  let hundreds: number;
  let afterHundred: number;
  if (word === 'hundred') {
    hundreds = 1;
    afterHundred = i + 1;
  } else if (unitBefore !== undefined && words[i + 1]?.word === 'hundred') {
    hundreds = unitBefore;
    afterHundred = i + 2;
  } else {
    return readBelowHundred(words, i);
  }

  const rest = readBelowHundred(words, afterHundred);
  return rest && rest.value > 0
    ? { value: hundreds * 100 + rest.value, end: rest.end }
    : { value: hundreds * 100, end: afterHundred };
}

function findCandidates(tokens: string[]): Candidate[] {
  const candidates: Candidate[] = [];
  const words = toWords(tokens);

  let w = 0;
  while (w < words.length) {
    const index = words[w].token;
    const { core, attached } = stripEuroSign(tokens[index]);
    const minor = parseAmount(core);
    if (minor !== null) {
      candidates.push({ start: index, end: index, minor, attached });
      w += 1;
      continue;
    }

    const run = readNumberWords(words, w);
    if (run === null) {
      w += 1;
      continue;
    }
    // Zero is not an amount (same rule as parseAmount): skip its words, they stay in the note.
    if (run.value > 0) {
      candidates.push({ start: index, end: words[run.end - 1].token, minor: run.value * 100, attached: false });
    }
    w = run.end;
  }
  return candidates;
}

/**
 * Turns one typed or dictated line ("döner 6", "Döner 6 €", "döner six euros") into an amount and a note.
 *
 * The amount is a number next to a currency marker (€, eur, euro, euros), otherwise the last number. A
 * number is digits that `parseAmount` accepts, or English number words (whole euros only). The note is
 * the rest of the line as typed, without that number and its marker. Returns null when there is no amount.
 */
export function parseQuickAdd(text: string): { amountMinor: Minor; note: string } | null {
  const trimmed = text.trim();
  const tokens = trimmed === '' ? [] : trimmed.split(/\s+/);
  const candidates = findCandidates(tokens);
  if (candidates.length === 0) return null;

  const nextToMarker = (c: Candidate) => c.attached || isMarker(tokens[c.start - 1]) || isMarker(tokens[c.end + 1]);
  const marked = candidates.filter(nextToMarker);
  const chosen = marked.length > 0 ? marked[marked.length - 1] : candidates[candidates.length - 1];

  const drop = new Set<number>();
  for (let i = chosen.start; i <= chosen.end; i += 1) drop.add(i);
  if (isMarker(tokens[chosen.start - 1])) drop.add(chosen.start - 1);
  if (isMarker(tokens[chosen.end + 1])) drop.add(chosen.end + 1);

  const note = tokens.filter((_, i) => !drop.has(i)).join(' ');
  return { amountMinor: chosen.minor, note };
}

/** The first word of a note, trimmed and lower-cased, or null for a blank note. */
export function keywordOf(note: string): string | null {
  const first = note.trim().split(/\s+/)[0];
  return first ? first.toLocaleLowerCase('de-DE') : null;
}

/** The category of the most recent expense whose note starts with the same word, or null. */
export function suggestCategory(note: string, history: Entry[]): string | null {
  const keyword = keywordOf(note);
  if (keyword === null) return null;

  let latest: { categoryId: string; createdAt: string } | null = null;
  for (const entry of history) {
    if (entry.type !== 'expense' || keywordOf(entry.note) !== keyword) continue;
    // createdAt is always written with toISOString(), so comparing the strings compares the times.
    if (latest === null || entry.createdAt > latest.createdAt) latest = entry;
  }
  return latest?.categoryId ?? null;
}
