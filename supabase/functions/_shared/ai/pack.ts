// The Regensburg data the AI may quote (the AI phase, chunk 8, docs/superpowers/plans/2026-11-09-ai-phase-1.md): the
// items of the city pack, and how they read in the model's rules. The items themselves are in city-pack.ts, written
// from the app's own data (src/data) by scripts/write-city-pack.mjs, since the function can't import src/.
//
// Every item has an id the model cites and the app looks up again in its own data, so a source, a link or a checked
// date never comes from the model. No item carries a link: the app adds those.
//
// Each item also carries its words (the Groq switch, chunk 3, docs/superpowers/plans/2026-11-13-groq-free-plan.md):
// folded by `foldWords` from its text, its titles in the app's other languages, its category's names and a few topic
// words, so `selectPack` (pack-select.ts) can send Ask only the items a question is about. The words never reach the
// model.

export type PackKind = 'range' | 'price' | 'tip' | 'discount' | 'swap' | 'semester' | 'fee' | 'checklist';

export type PackItem = {
  /** `kind:key`: `tip:<id>`, `discount:<id>`, `swap:<id>`, `range:<category id>`, `price:<label as a slug>`,
   * `semester:<university>:<term>`, `fee:<university>:<first day>`, `checklist:<item id>`. */
  id: string;
  kind: PackKind;
  /** The app category it is about, or null (semester dates, fees and checklist items). */
  categoryId: string | null;
  /** What the item says, in English, with its amounts written as €12 or €3.80. */
  text: string;
  source: string;
  /** The day its source was last opened, YYYY-MM-DD. */
  checked: string;
  /** Nothing states the figure: it is the app's own estimate. */
  estimate: boolean;
  /** What a question about it may say, as `foldWords` writes words, joined by spaces. Never sent to the model. */
  words: string;
};

/**
 * Each kind's id, from the app's own data. The pack's writer and the Ask page (which shows a cited item's source from
 * the app's data again, `src/features/ask/sources.ts`) both build ids here, so the two never drift apart.
 */
export const packId = {
  range: (categoryId: string) => `range:${categoryId}`,
  price: (label: string) =>
    `price:${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`,
  tip: (id: string) => `tip:${id}`,
  discount: (id: string) => `discount:${id}`,
  swap: (id: string) => `swap:${id}`,
  semester: (university: string, term: string) => `semester:${university}:${term}`,
  fee: (university: string, starts: string) => `fee:${university}:${starts}`,
  checklist: (id: string) => `checklist:${id}`,
};

/** An app category as the AI's rules name it, in English (src/data/categories.ts), written into city-pack.ts too. */
export type PackCategory = { id: string; name: string; kind: 'flexible' | 'fixed' | 'oneoff' | 'income' };

/** The pack as the model reads it: one item per line, its id first. */
export function renderPack(items: readonly PackItem[]): string {
  return items
    .map((item) => {
      const estimate = item.estimate ? ' (estimate)' : '';
      return `[${item.id}] ${item.text}${estimate} Source: ${item.source}; checked ${item.checked}.`;
    })
    .join('\n');
}

/**
 * The pack as Ask sends it on Groq's free plan: one item per line, its id first, without its source and checked day.
 * The app shows a cited item's source from its own data, so the model needs only what the item says.
 */
export function renderPackBrief(items: readonly PackItem[]): string {
  return items.map((item) => `[${item.id}] ${item.text}${item.estimate ? ' (estimate)' : ''}`).join('\n');
}

/** Words that say nothing about which item a question is after, in the app's four languages (folded when used). */
const STOP_LIST = `
  the and for you your are with can could how what where when which who why this that these those there here have has
  had from get got does did not but all any some its out per more less than then them they their our was were will
  would should about into also only just like very much many most each every other same such one two lot lots
  der die das den dem des und oder aber ist sind war bin bist hat habe haben hast ein eine einen einem einer eines
  ich mir mich mein meine meinen meinem meiner dir dich dein deine sie ihr ihre wir uns unser euch man wie was wer wem
  wen woher wohin wann warum welche welcher welches für mit ohne auf aus bei beim von vom zum zur ins fürs nach vor über unter durch
  gegen bis auch noch nur schon sehr viel viele mehr weniger kann kannst können muss musst müssen soll sollte gibt
  nicht kein keine keinen dann denn wenn als dass diese dieser dieses etwas hier dort jetzt immer alle allen
  les des une pour avec dans est sont sur que qui quoi quel quelle quels quelles comment combien pourquoi quand mon mes
  ton tes son ses notre votre nos vos leur leurs par pas plus moins aux ces cette cet être avoir peux peut puis faire
  fait tout tous toute toutes très aussi bien mais donc elle ils elles nous vous moi toi lui eux suis avez avons ont ici
  los las una uno unos unas para con por qué como cómo cuánto cuánta cuántos cuántas donde dónde cuando cuándo mis tus
  sus del más menos puedo puede pueden hay este esta esto estos estas ese esa eso muy también pero sin sobre entre
  hasta desde mucho mucha muchos muchas soy eres estoy está tengo tiene tienen hacer algo alguna alguno todo toda todos
  todas aquí cuál ser
  regensburg euro euros eur
`;

/** Lower case, with accents and umlauts dropped and ß as ss, so "Günstig" and "gunstig" are one word. */
function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
}

const STOP_WORDS: ReadonlySet<string> = new Set(fold(STOP_LIST).split(/\s+/).filter(Boolean));

/** Endings `foldWords` takes off a word, the first that fits: plurals and a few inflections. */
const ENDINGS = ['en', 'er', 'es', 'e', 's', 'n'];

/**
 * A word without its ending when at least 4 letters stay, so "Rabatte" and "Rabatt", or "prices" and "price", meet,
 * while a short word ("essen", "comer") keeps its own.
 */
function stem(word: string): string {
  const ending = ENDINGS.find((end) => word.endsWith(end) && word.length - end.length >= 4);
  return ending === undefined ? word : word.slice(0, -ending.length);
}

/**
 * The words of a text as the pack compares them: folded, at least 3 letters, no number on its own, no stop word, each
 * without its ending, each once, in the order they come. The same for an item's words and a question's.
 */
export function foldWords(text: string): string[] {
  const words = fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !/^\p{N}+$/u.test(word) && !STOP_WORDS.has(word))
    .map(stem);
  return [...new Set(words)];
}
