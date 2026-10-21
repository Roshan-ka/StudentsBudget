import type { Entry } from '@/db/types';
import { parseAmount, type Minor } from '@/lib/money';

const MARKERS = new Set(['€', 'eur', 'euro', 'euros']);

/**
 * Words that change the size of the number before them. The parser reads "hundred" and "thousand"
 * inside a number-word run; everywhere else they, "cent(s)", "million" and "billion" mean the line has
 * no amount the parser can trust, so the whole parse is null instead of a smaller amount.
 */
const UNREAD_SCALES = new Set(['hundred', 'thousand', 'million', 'billion', 'cent', 'cents']);
const CENT_WORDS = new Set(['cent', 'cents']);

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

/** A marker written onto a number: "€6", "6€", "6eur", "eur6". */
const MARKER_PREFIX = /^(?:€|euros?|eur)/i;
const MARKER_SUFFIX = /(?:€|euros?|eur)$/i;

/** Starts like a number or a price: a digit, or a currency sign such as $, £ or €. */
const NUMBER_LIKE = new RegExp('^[\\p{Nd}\\p{Sc}]', 'u');
const WHOLE_NUMBER = /^\d+$/;
const ZERO = /^0+(?:[.,]0+)?$/;

/** What dictation puts at the end of a phrase: "Döner 6 €." (full stop, !, ?, … and runs of them). */
const SENTENCE_END = /[.!?…]+$/;
/** What dictation puts after a word inside a phrase: "Coffee, 6 €". */
const WORD_SEPARATOR_END = /[,;:]+$/;

/** A number found in the line: tokens `start` to `end` (inclusive), in minor units. */
type Candidate = {
  start: number;
  end: number;
  minor: Minor;
  /** A currency marker is written onto the number, or it is a "6 euro 50" amount. */
  marked: boolean;
  /** The marker is written onto the end of the number: "40€", "40eur". */
  markedAfter: boolean;
  /** Whole euros: digits with no marker or decimals, or number words. */
  integer: boolean;
  /** The value when it could be a cents part: 0 to 99, at most two digits. */
  cents: number | null;
};

/** What a line parsed to: one amount and the note. */
export type QuickAddAmount = { amountMinor: Minor; note: string };

/** Two readings of "coffee 7 40 euros" to choose from: euros and cents (€7.40), or the second number alone (€40). */
export type QuickAddChoice = { kind: 'choice'; note: string; options: [Minor, Minor] };

type Word = { word: string; token: number };
type Span = { value: number; end: number };
type Invalid = 'invalid';

/** A number read from the words at one position; `end` is the index of the word after it. */
type Amount = {
  minor: Minor;
  end: number;
  /** The currency marker is written onto the number. */
  marked: boolean;
  /** The marker is written onto the end of the number: "40€". */
  markedAfter: boolean;
  /** Digits only (no marker, no decimals) or number words. */
  integer: boolean;
  /** The value when it could be a cents part: 0 to 99, at most two digits, with no marker in front of it. */
  cents: number | null;
};

function isMarker(token: string | undefined): boolean {
  return token !== undefined && MARKERS.has(token.toLowerCase());
}

/** The token without a marker written onto it; `after` when the marker was at its end ("6€"), not its front ("€6"). */
function stripMarker(token: string): { core: string; attached: boolean; after: boolean } {
  const prefix = MARKER_PREFIX.exec(token);
  if (prefix) return { core: token.slice(prefix[0].length), attached: true, after: false };
  const suffix = MARKER_SUFFIX.exec(token);
  if (suffix) return { core: token.slice(0, suffix.index), attached: true, after: true };
  return { core: token, attached: false, after: false };
}

/** The token without a comma, semicolon or colon after a word. A number keeps them: "6,50" is a decimal. */
function withoutSeparator(token: string): string {
  const stripped = token.replace(WORD_SEPARATOR_END, '');
  if (isMarker(stripped)) return stripped;
  const looksLikeNumber = NUMBER_LIKE.test(token) || NUMBER_LIKE.test(stripMarker(token).core);
  return looksLikeNumber ? token : stripped;
}

/** Lower-cased words, one per token; a hyphen compound like "twenty-five" gives two. */
function toWords(tokens: string[]): Word[] {
  return tokens.flatMap((token, index) => {
    const lower = token.toLowerCase();
    const compound = HYPHEN_COMPOUND.exec(lower);
    return (compound ? [compound[1], compound[2]] : [lower]).map((word) => ({ word, token: index }));
  });
}

function wordAt(words: Word[], i: number): string {
  return words[i]?.word ?? '';
}

/** Zero to ninety-nine, read from word `i`. */
function readBelowHundred(words: Word[], i: number): Span | null {
  const word = wordAt(words, i);
  const small = SMALL.get(word) ?? UNITS.get(word);
  if (small !== undefined) return { value: small, end: i + 1 };

  const tens = TENS.get(word);
  if (tens === undefined) return null;
  const unit = UNITS.get(wordAt(words, i + 1));
  return unit === undefined ? { value: tens, end: i + 1 } : { value: tens + unit, end: i + 2 };
}

type ReadCount = (i: number) => Span | Invalid | null;

/** "<count> <scale>", "a <scale>" or a bare "<scale>", read from word `i`. `end` is after the scale word. */
function readScaled(words: Word[], i: number, scale: string, readCount: ReadCount): Span | Invalid | null {
  const word = wordAt(words, i);
  if (word === scale) return { value: 1, end: i + 1 };
  if (word === 'a') return wordAt(words, i + 1) === scale ? { value: 1, end: i + 2 } : null;

  const count = readCount(i);
  if (count === null || count === 'invalid') return count;
  return count.value > 0 && wordAt(words, count.end) === scale ? { value: count.value, end: count.end + 1 } : null;
}

/** What may follow a scale word: an optional "and", then a number above zero. "and" without one is invalid. */
function readRest(words: Word[], i: number, readCount: ReadCount): Span | Invalid | null {
  const hasAnd = wordAt(words, i) === 'and';
  const rest = readCount(hasAnd ? i + 1 : i);
  if (rest === 'invalid') return rest;
  if (rest === null || rest.value === 0) return hasAnd ? 'invalid' : null;
  return rest;
}

/** "<1-99> hundred [and] [1-99]": "one hundred and five", "twenty five hundred", "a hundred", "hundred". */
function readHundreds(words: Word[], i: number): Span | Invalid | null {
  const readBelow: ReadCount = (j) => readBelowHundred(words, j);
  const hundreds = readScaled(words, i, 'hundred', readBelow);
  if (hundreds === null || hundreds === 'invalid') return hundreds;

  const rest = readRest(words, hundreds.end, readBelow);
  if (rest === 'invalid') return rest;
  return rest === null
    ? { value: hundreds.value * 100, end: hundreds.end }
    : { value: hundreds.value * 100 + rest.value, end: rest.end };
}

/** Zero to 999 and more: below a hundred, or hundreds. */
function readGroup(words: Word[], i: number): Span | Invalid | null {
  return readHundreds(words, i) ?? readBelowHundred(words, i);
}

/**
 * A run of English number words read from word `i`: "<group> thousand [and] [group]" or a group. Returns
 * 'invalid' for a run that goes wrong: "and" with no number after it, or "and" right after the run.
 */
function readNumber(words: Word[], i: number): Span | Invalid | null {
  const readGroupAt: ReadCount = (j) => readGroup(words, j);
  const thousands = readScaled(words, i, 'thousand', readGroupAt);
  if (thousands === 'invalid') return thousands;

  let span: Span | Invalid | null;
  if (thousands === null) {
    span = readGroup(words, i);
  } else {
    const rest = readRest(words, thousands.end, readGroupAt);
    if (rest === 'invalid') return rest;
    span = rest === null
      ? { value: thousands.value * 1000, end: thousands.end }
      : { value: thousands.value * 1000 + rest.value, end: rest.end };
  }
  if (span === null || span === 'invalid') return span;
  return wordAt(words, span.end) === 'and' ? 'invalid' : span;
}

/**
 * The number that starts at word `w`: digits (with a marker written onto them or not) or number words.
 * Null when there is none. 'invalid' when the token looks like a number or a price but is not an amount
 * ("6,505", "$7", "3pm"), or when number words go wrong.
 */
function readAmount(tokens: string[], words: Word[], w: number): Amount | Invalid | null {
  if (w >= words.length) return null;
  const token = tokens[words[w].token];
  if (isMarker(token)) return null;

  const { core, attached, after } = stripMarker(token);
  if (NUMBER_LIKE.test(token) || NUMBER_LIKE.test(core)) {
    // Zero is a number but not an amount (same rule as parseAmount): it can still be a cents part.
    const minor = parseAmount(core) ?? (ZERO.test(core) ? 0 : null);
    if (minor === null) return 'invalid';
    const whole = WHOLE_NUMBER.test(core);
    const integer = !attached && whole;
    // A marker at the end ("40€") leaves a number that could still be cents; one in front ("€40") does not.
    const cents = whole && (!attached || after) && core.length <= 2 ? Number(core) : null;
    return { minor, end: w + 1, marked: attached, markedAfter: after, integer, cents };
  }

  const run = readNumber(words, w);
  if (run === null || run === 'invalid') return run;
  const cents = run.value < 100 ? run.value : null;
  return { minor: run.value * 100, end: run.end, marked: false, markedAfter: false, integer: true, cents };
}

/** Every amount in the line, or null when something that looks like an amount cannot be read. */
function findCandidates(tokens: string[]): Candidate[] | null {
  const words = toWords(tokens);
  const candidates: Candidate[] = [];

  let w = 0;
  while (w < words.length) {
    const amount = readAmount(tokens, words, w);
    if (amount === 'invalid') return null;
    if (amount === null) {
      w += 1;
      continue;
    }

    let { minor, end, marked, markedAfter, integer, cents: centsPart } = amount;

    // "6 Euro 50": euros, a marker of its own, then cents ("cent" or "cents" may follow) and the end of
    // the line. Any other number straight after the marker would be a second amount, and a word after
    // the cents would make them a quantity ("6 euros 2 coffees"), so either way the line has no clear amount.
    const cents = isMarker(wordAt(words, end)) ? readAmount(tokens, words, end + 1) : null;
    if (cents === 'invalid') return null;
    if (cents !== null) {
      const afterCents = CENT_WORDS.has(wordAt(words, cents.end)) ? cents.end + 1 : cents.end;
      // The cents part is bare: "3 euros 5€" is not 3.05.
      if (!amount.integer || !cents.integer || cents.cents === null || afterCents < words.length) return null;
      minor += cents.cents;
      marked = true;
      markedAfter = false;
      integer = false;
      centsPart = null;
      end = afterCents;
    }

    if (UNREAD_SCALES.has(wordAt(words, end))) return null;
    if (minor > 0) {
      const [start, last] = [words[w].token, words[end - 1].token];
      candidates.push({ start, end: last, minor, marked, markedAfter, integer, cents: centsPart });
    }
    w = end;
  }
  return candidates;
}

/**
 * Turns one typed or dictated line ("döner 6", "Döner 6 €", "döner six euros") into an amount and a note.
 *
 * The amount is a number next to a currency marker (€, eur, euro, euros), otherwise the last number.
 * A number is digits that `parseAmount` accepts, or English number words (whole euros only); "6 euro 50"
 * (and "6 euro 50 cents") at the end of the line is 6 euros and 50 cents. The note is the rest of the line as typed, without that number and its marker.
 * Returns null when there is no amount, and also when the line has something that looks like an amount
 * but cannot be read ("$7", "6,505", "fifty cents", "one million"): a silently wrong amount is worse.
 *
 * A whole number straight before the chosen one ("coffee 7 40", "coffee seven forty euros") could be the euros
 * of "7,40" said in two parts, or a count. When the chosen number could be cents (1 to 99) and has no marker or only
 * one after it ("40 euros", "40 €", "40€"), the result is a choice of both readings (€7.40 or €40) instead of an
 * amount; when it cannot ("coffee 7 140"), and nothing marks it, the result is null. A marker in front ("7 €40")
 * makes it one amount.
 *
 * Dictation punctuation does not count: a full stop, !, ? or … at the end of the line is dropped, and so is
 * a comma, semicolon or colon after a word ("Coffee, 6 €.") but not after a number ("6,50" is a decimal).
 */
export function parseQuickAdd(text: string): QuickAddAmount | QuickAddChoice | null {
  const trimmed = text.trim().replace(SENTENCE_END, '').trimEnd();
  // `tokens` is the line as typed, for the note; `read` has the same tokens without a word's separator.
  const tokens = trimmed === '' ? [] : trimmed.split(/\s+/);
  const read = tokens.map(withoutSeparator);
  const candidates = findCandidates(read);
  if (candidates === null || candidates.length === 0) return null;

  const nextToMarker = (c: Candidate) => c.marked || isMarker(read[c.start - 1]) || isMarker(read[c.end + 1]);
  const marked = candidates.filter(nextToMarker);
  const chosen = marked.length > 0 ? marked[marked.length - 1] : candidates[candidates.length - 1];

  // A bare whole number right before the chosen one ("coffee 7 40", "coffee seven forty euros", "coffee 7 40€") may
  // be the euros of "7,40" said in two parts. A marker in front of the chosen number ("€40") says the amount plainly.
  const before = candidates[candidates.indexOf(chosen) - 1];
  const adjacent = before !== undefined && before.end + 1 === chosen.start;
  // The chosen number's only marker comes after it: "40 euros", "40 €" or "40€".
  const onlyMarkerAfter =
    !isMarker(read[chosen.start - 1]) && (chosen.marked ? chosen.markedAfter : isMarker(read[chosen.end + 1]));
  const options: [Minor, Minor] | null =
    adjacent && (marked.length === 0 || onlyMarkerAfter) && !nextToMarker(before) && before.integer && chosen.cents !== null
      ? [before.minor + chosen.cents, chosen.minor]
      : null;
  if (marked.length === 0 && adjacent && options === null) return null;

  const drop = new Set<number>();
  for (let i = chosen.start; i <= chosen.end; i += 1) drop.add(i);
  if (isMarker(read[chosen.start - 1])) drop.add(chosen.start - 1);
  if (isMarker(read[chosen.end + 1])) drop.add(chosen.end + 1);
  if (options !== null) for (let i = before.start; i <= before.end; i += 1) drop.add(i);

  // A separator left dangling at the end ("Coffee," from "Coffee, 6 €") is not part of the note.
  const note = tokens
    .filter((_, i) => !drop.has(i))
    .join(' ')
    .replace(/[\s,;:]+$/, '');
  return options === null ? { amountMinor: chosen.minor, note } : { kind: 'choice', note, options };
}

/** Words that carry no meaning of their own ("lunch at mensa"): they never choose a category. */
const STOP_WORDS = new Set(['a', 'an', 'the', 'at', 'for', 'with', 'and', 'of', 'in', 'on', 'to', 'from', 'my']);
/** Number words ("two coffees") are numbers like "2 coffees": a quantity says nothing about the category. */
const NUMBER_WORDS = new Set([...UNITS.keys(), ...SMALL.keys(), ...TENS.keys()]);
/** A word's own punctuation at either end: "Coffee.", "mensa,". */
const EDGE_PUNCTUATION = /^[.,;:]+|[.,;:]+$/g;

/**
 * The words of a note that can choose a category, in order, lower-cased and without a full stop, comma, semicolon or
 * colon at either end. Numbers ("6", "7,40", "€", "two"), currency markers and the stop words are left out.
 */
export function keywordsOf(note: string): string[] {
  const words: string[] = [];
  for (const token of note.split(/\s+/)) {
    const word = token.replace(EDGE_PUNCTUATION, '').toLocaleLowerCase('de-DE');
    const skipped =
      word === '' ||
      NUMBER_LIKE.test(word) ||
      MARKERS.has(word) ||
      NUMBER_WORDS.has(word) ||
      HYPHEN_COMPOUND.test(word) ||
      STOP_WORDS.has(word);
    if (!skipped) words.push(word);
  }
  return words;
}

/**
 * The category of the most recent expense that shares a word with the note, or null. The note's words are tried in
 * order, and the first one that an earlier expense has, as a whole word, decides: "lunch at mensa" finds "mensa 4"
 * through "mensa", and "döner" does not find "dönerbox". Entries a schedule posted do not count: their note is the
 * category name ("Phone & internet"), not something the person typed.
 *
 * Known limit: the first word with any history wins, not the best one. "big rewe shop" takes an earlier "big pizza"'s
 * category, though "rewe" has a history of its own. The AI phase replaces this reading, so it stays simple.
 */
export function suggestCategory(note: string, history: Entry[]): string | null {
  const keywords = keywordsOf(note);
  if (keywords.length === 0) return null;

  // Each expense the person typed, with the words of its note, read once for all the keywords tried.
  const typed: { categoryId: string; createdAt: string; words: Set<string> }[] = [];
  for (const entry of history) {
    if (entry.type !== 'expense' || entry.recurring !== undefined) continue;
    typed.push({ categoryId: entry.categoryId, createdAt: entry.createdAt, words: new Set(keywordsOf(entry.note)) });
  }

  for (const keyword of keywords) {
    let latest: { categoryId: string; createdAt: string } | null = null;
    for (const entry of typed) {
      if (!entry.words.has(keyword)) continue;
      // createdAt is always written with toISOString(), so comparing the strings compares the times.
      if (latest === null || entry.createdAt > latest.createdAt) latest = entry;
    }
    if (latest !== null) return latest.categoryId;
  }
  return null;
}
