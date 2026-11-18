// Number words in the phone's language, as digits (docs/superpowers/plans/2026-11-18-number-words.md, Roshan,
// 18-11-2026): "Döner sechs Euro fünfzig" reads as "Döner 6 Euro 50" before quick add's reader, which knows English
// number words itself. Pure, so each language's grammar is tested on its own.
import { fold } from '@/features/import/merchants';
import type { Language } from '@/i18n/languages';

/** A number read from word `start`: its value and the word after it. */
type Run = { value: number; end: number };

/** Reads the longest number that starts at word `i`, or null. Words are folded (`key`). */
type ReadNumber = (words: readonly string[], i: number) => Run | null;

/** A word as the grammars read it: lower case, umlauts written out ("fuenf"), other accents gone, end marks dropped. */
function key(token: string): string {
  return fold(token)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[.,;:!?]+$/, '');
}

const lookup = (table: Record<string, number>, word: string): number | null =>
  Object.hasOwn(table, word) ? table[word] : null;

// German: one token per number ("einundzwanzig", "zweihundertfünfzig"), so it reads a single word.
const DE_UNITS: Record<string, number> = {
  eins: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9,
};
const DE_TEENS: Record<string, number> = {
  null: 0, zehn: 10, elf: 11, zwoelf: 12, dreizehn: 13, vierzehn: 14, fuenfzehn: 15, sechzehn: 16, siebzehn: 17,
  achtzehn: 18, neunzehn: 19,
};
const DE_TENS: Record<string, number> = {
  zwanzig: 20, dreissig: 30, vierzig: 40, fuenfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90,
};
/** A unit in front of "und", "hundert" or "tausend": "ein" there, never "eins". */
const DE_PREFIX_UNITS: Record<string, number> = {
  ein: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9,
};

/** 0–99 as one German word: "sechs", "zwoelf", "dreissig", "einundzwanzig". */
function deBelowHundred(word: string): number | null {
  const direct = lookup(DE_UNITS, word) ?? lookup(DE_TEENS, word) ?? lookup(DE_TENS, word);
  if (direct !== null) return direct;
  const compound = /^([a-z]+)und([a-z]+)$/.exec(word);
  if (compound === null) return null;
  const unit = lookup(DE_PREFIX_UNITS, compound[1]);
  const tens = lookup(DE_TENS, compound[2]);
  return unit === null || tens === null ? null : tens + unit;
}

/** "<1–9|ein|nothing><scale>[und]<rest>", with `readLeft` and `readRest` for the parts. */
function deScaled(
  word: string,
  scale: 'hundert' | 'tausend',
  readLeft: (part: string) => number | null,
  readRest: (part: string) => number | null,
): number | null {
  const at = word.indexOf(scale);
  if (at === -1) return null;
  const leftPart = word.slice(0, at);
  const left = leftPart === '' || leftPart === 'ein' ? 1 : readLeft(leftPart);
  if (left === null || left < 1) return null;
  const restPart = word.slice(at + scale.length).replace(/^und/, '');
  const rest = restPart === '' ? 0 : readRest(restPart);
  if (rest === null) return null;
  return left * (scale === 'hundert' ? 100 : 1000) + rest;
}

/** 0–999 as one German word. */
function deBelowThousand(word: string): number | null {
  return deScaled(word, 'hundert', (part) => lookup(DE_PREFIX_UNITS, part), deBelowHundred) ?? deBelowHundred(word);
}

/** 0–999 999 as one German word: "tausendzweihundert", "eintausendneunhundertneunundneunzig". */
const readGerman: ReadNumber = (words, i) => {
  const word = words[i] ?? '';
  const value = deScaled(word, 'tausend', deBelowThousand, deBelowThousand) ?? deBelowThousand(word);
  return value === null ? null : { value, end: i + 1 };
};

/** Each language's reader; English has none here, since quick add's reader knows English number words itself. */
const READERS: Partial<Record<Language, ReadNumber>> = { de: readGerman };

/** Words that are never a number on their own: the articles ("ein Döner", "un café", "una cerveza"). */
const ARTICLES: Record<Language, readonly string[]> = {
  en: [],
  de: ['ein', 'eine', 'einen', 'einem', 'einer'],
  fr: ['un', 'une'],
  es: ['un', 'una'],
};

/** Scales the reader doesn't read: written as "million", so the line is refused, never read as a smaller amount. */
const UNREAD_SCALES: Record<Language, readonly string[]> = {
  en: [],
  de: ['million', 'millionen', 'milliarde', 'milliarden'],
  fr: ['million', 'millions', 'milliard', 'milliards'],
  es: ['millon', 'millones', 'millardo', 'millardos'],
};

/** Cent words, written as "cents" for the reader, which reads cents only after the euro word. */
const CENT_WORDS: Record<Language, readonly string[]> = {
  en: [],
  de: ['cent', 'cents'],
  fr: ['centime', 'centimes'],
  es: ['centimo', 'centimos', 'centavo', 'centavos'],
};

const EURO_MARKERS = new Set(['€', 'eur', 'euro', 'euros']);

/**
 * The line with the phone language's number words as digits: each run of number words, in whole tokens, becomes one
 * number ("sechs" → "6", "vingt-cinq" → "25", "treinta y cinco" → "35"), and the rest stays as typed. Cent words become
 * "cents" and unread scales "million", as the reader knows them in English; Spanish "con" between "euros" and the
 * cents goes ("seis euros con cincuenta" → "6 euros 50"). An article on its own is never a number. English, and a line
 * with nothing to change, come back as they are.
 */
export function numberWordsToDigits(text: string, lang: Language): string {
  const read = READERS[lang];
  if (read === undefined) return text;
  const tokens = text.trim() === '' ? [] : text.trim().split(/\s+/);
  // French joins a number's parts with hyphens ("quatre-vingt-dix"): each part is a word, and a run takes whole tokens.
  const words: string[] = [];
  const tokenOf: number[] = [];
  tokens.forEach((token, t) => {
    for (const part of lang === 'fr' ? key(token).split('-') : [key(token)]) {
      words.push(part);
      tokenOf.push(t);
    }
  });

  const out: string[] = [];
  let changed = false;
  let w = 0;
  while (w < words.length) {
    const t = tokenOf[w];
    const startsToken = w === 0 || tokenOf[w - 1] !== t;
    const run = startsToken ? read(words, w) : null;
    const endsToken = run !== null && (run.end === words.length || tokenOf[run.end] !== tokenOf[run.end - 1]);
    const lone = run !== null && run.end === w + 1 && ARTICLES[lang].includes(words[w]);
    if (run !== null && endsToken && !lone) {
      out.push(String(run.value));
      changed = true;
      w = run.end;
      continue;
    }
    const word = words[w];
    if (UNREAD_SCALES[lang].includes(word)) {
      out.push('million');
      changed = true;
    } else if (CENT_WORDS[lang].includes(word)) {
      out.push('cents');
      changed = true;
    } else {
      out.push(tokens[t]);
    }
    // The rest of this token's words go with it.
    w += 1;
    while (w < words.length && tokenOf[w] === t) w += 1;
  }

  // "seis euros con cincuenta": the cents follow the euro word straight away, as the reader wants them.
  const joined = out.filter((token, i) => {
    const drop = lang === 'es' && key(token) === 'con' && EURO_MARKERS.has(key(out[i - 1] ?? '')) && /^\d+$/.test(out[i + 1] ?? '');
    if (drop) changed = true;
    return !drop;
  });
  return changed ? joined.join(' ') : text;
}
