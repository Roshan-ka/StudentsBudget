// The Regensburg data the AI may quote (the AI phase, chunk 8, docs/superpowers/plans/2026-11-09-ai-phase-1.md): the
// items of the city pack, and how they read in the model's rules. The items themselves are in city-pack.ts, written
// from the app's own data (src/data) by scripts/write-city-pack.mjs, since the function can't import src/.
//
// Every item has an id the model cites and the app looks up again in its own data, so a source, a link or a checked
// date never comes from the model. No item carries a link: the app adds those.

export type PackKind = 'range' | 'price' | 'tip' | 'discount' | 'swap' | 'semester' | 'fee';

export type PackItem = {
  /** `kind:key`: `tip:<id>`, `discount:<id>`, `swap:<id>`, `range:<category id>`, `price:<label as a slug>`,
   * `semester:<university>:<term>`, `fee:<university>:<first day>`. */
  id: string;
  kind: PackKind;
  /** The app category it is about, or null (semester dates and fees). */
  categoryId: string | null;
  /** What the item says, in English, with its amounts written as €12 or €3.80. */
  text: string;
  source: string;
  /** The day its source was last opened, YYYY-MM-DD. */
  checked: string;
  /** Nothing states the figure: it is the app's own estimate. */
  estimate: boolean;
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
