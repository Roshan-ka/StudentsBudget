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

// French: parts joined by hyphens or spaces ("vingt-cinq", "vingt et un", "quatre-vingt-dix-neuf", "deux cents").
const FR_UNITS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
};
const FR_TEENS: Record<string, number> = {
  zero: 0, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
};
const FR_TENS: Record<string, number> = {
  vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, septante: 70, huitante: 80, octante: 80, nonante: 90,
};

/** 0–19 from word `i`: "sept", "seize", "dix-sept". */
function frBelowTwenty(words: readonly string[], i: number): Run | null {
  const word = words[i] ?? '';
  if (word === 'dix') {
    const unit = lookup(FR_UNITS, words[i + 1] ?? '');
    if (unit !== null && unit >= 7) return { value: 10 + unit, end: i + 2 };
  }
  const value = lookup(FR_TEENS, word) ?? lookup(FR_UNITS, word);
  return value === null ? null : { value, end: i + 1 };
}

/** 0–99 from word `i`: "vingt-cinq", "vingt et un", "soixante et onze", "soixante-dix-sept", "quatre-vingt-dix". */
function frBelowHundred(words: readonly string[], i: number): Run | null {
  const word = words[i] ?? '';
  if (word === 'quatre' && (words[i + 1] === 'vingt' || words[i + 1] === 'vingts')) {
    const tail = frBelowTwenty(words, i + 2);
    return tail !== null && tail.value > 0 ? { value: 80 + tail.value, end: tail.end } : { value: 80, end: i + 2 };
  }
  const tens = lookup(FR_TENS, word);
  if (tens === null) return frBelowTwenty(words, i);
  // Soixante takes 1–19 ("soixante-dix-sept" is 77); the others 1–9.
  const max = tens === 60 ? 19 : 9;
  if (words[i + 1] === 'et') {
    const after = lookup({ un: 1, une: 1, onze: 11 }, words[i + 2] ?? '');
    return after !== null && after <= max ? { value: tens + after, end: i + 3 } : { value: tens, end: i + 1 };
  }
  const tail = frBelowTwenty(words, i + 1);
  return tail !== null && tail.value >= 1 && tail.value <= max
    ? { value: tens + tail.value, end: tail.end }
    : { value: tens, end: i + 1 };
}

/** 0–999 from word `i`: "cent", "cent deux", "deux cents", "trois cent vingt". */
function frBelowThousand(words: readonly string[], i: number): Run | null {
  const word = words[i] ?? '';
  const unit = lookup(FR_UNITS, word);
  const isCent = (w: string | undefined) => w === 'cent' || w === 'cents';
  let hundreds: Run | null = null;
  if (isCent(word)) hundreds = { value: 100, end: i + 1 };
  else if (unit !== null && unit >= 2 && isCent(words[i + 1])) hundreds = { value: unit * 100, end: i + 2 };
  if (hundreds === null) return frBelowHundred(words, i);
  const rest = frBelowHundred(words, hundreds.end);
  return rest !== null && rest.value > 0 ? { value: hundreds.value + rest.value, end: rest.end } : hundreds;
}

/**
 * A thousands number from word `i`: "mille", "mille cinq cents", "deux mille", or below a thousand, read by `below`
 * with `thousand` as the word ("mille", "mil").
 */
function withThousands(
  words: readonly string[],
  i: number,
  thousand: string,
  below: (words: readonly string[], i: number) => Run | null,
): Run | null {
  const left = words[i] === thousand ? { value: 1, end: i } : below(words, i);
  if (left === null) return null;
  if (words[left.end] !== thousand || left.value < 1) return left;
  const rest = below(words, left.end + 1);
  const thousands = left.value * 1000;
  return rest !== null && rest.value > 0
    ? { value: thousands + rest.value, end: rest.end }
    : { value: thousands, end: left.end + 1 };
}

const readFrench: ReadNumber = (words, i) => withThousands(words, i, 'mille', frBelowThousand);

// Spanish: "veinticinco", "treinta y cinco", "quinientos", "ciento veinte", "dos mil".
const ES_UNITS: Record<string, number> = {
  uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
};
const ES_BELOW_THIRTY: Record<string, number> = {
  cero: 0, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29,
};
const ES_TENS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const ES_HUNDREDS: Record<string, number> = {
  ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400,
  cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700,
  setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

/** 0–99 from word `i`: "cinco", "dieciseis", "veinticinco", "treinta y cinco". */
function esBelowHundred(words: readonly string[], i: number): Run | null {
  const word = words[i] ?? '';
  const tens = lookup(ES_TENS, word);
  if (tens !== null) {
    const unit = words[i + 1] === 'y' ? lookup(ES_UNITS, words[i + 2] ?? '') : null;
    return unit !== null ? { value: tens + unit, end: i + 3 } : { value: tens, end: i + 1 };
  }
  const value = lookup(ES_BELOW_THIRTY, word) ?? lookup(ES_UNITS, word);
  return value === null ? null : { value, end: i + 1 };
}

/** 0–999 from word `i`: "cien", "ciento veinte", "quinientos", "doscientas cincuenta". */
function esBelowThousand(words: readonly string[], i: number): Run | null {
  const word = words[i] ?? '';
  if (word === 'cien') return { value: 100, end: i + 1 };
  const hundreds = lookup(ES_HUNDREDS, word);
  if (hundreds === null) return esBelowHundred(words, i);
  const rest = esBelowHundred(words, i + 1);
  return rest !== null && rest.value > 0 ? { value: hundreds + rest.value, end: rest.end } : { value: hundreds, end: i + 1 };
}

const readSpanish: ReadNumber = (words, i) => withThousands(words, i, 'mil', esBelowThousand);

/** Each language's reader; English has none here, since quick add's reader knows English number words itself. */
const READERS: Partial<Record<Language, ReadNumber>> = { de: readGerman, fr: readFrench, es: readSpanish };

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
