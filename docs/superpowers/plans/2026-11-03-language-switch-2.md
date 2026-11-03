# Language switch, plan 2: city content, Spanish, French

**Goal:** the city content (tips, discounts, swaps, the setup ranges' and semesters' sources) in every offered language, then Spanish and French, each offered as soon as its own native read is done.

**Builds on:** plan 1 (`2026-11-02-language-switch.md`). German is offered since #38 (merged 03-11-2026, before its native read: the read and its corrections come later, in a PR of their own). Plan 2 starts from main; the "Adding a language" checklist in CLAUDE.md is its recipe.

**Decided (Roshan, 2026-11-03):**
1. **tú and tu:** Spanish and French speak informally, as the German uses du.
2. **One language at a time:** Spanish fully, with its own offer step, then French. A missing reader for one never holds the other back.
3. **City content is translated, starting with German:** Roshan saw the Tips page in German with every tip in English. Plan 1 left the city content English on purpose (its point 4, "translated in a later step that keeps every source, URL and checked date"); this plan is that step.

## Design

### City content in other languages

**A translation by item, not a copy of the data.** `src/data/*` stays the one source of every item, in English: its numbers, sources, URLs, checked dates, categories and order. The MCP server keeps reading it and answers in English.

- `src/i18n/content/<code>/<file>.ts` holds, per item id, only its words: a tip's `title`, `body` and `source`; a discount's `offer`, `conditions` and `source` (its `place` and `address` are names and stay); a swap's `title`, `body`, `per`, `source` and `toSource`; a setup range's `source`; a semester period's or fee part's `label` and `source`.
- `localized(item, lang)` helpers (`tipIn`, `discountIn`, `swapIn`, …) return the item with its words in `lang`. An item without a translation keeps English and says so, so the page marks only that item `lang="en"` (`contentLang` becomes per item).
- Source names stay as they are (Studierendenwerk Niederbayern/Oberpfalz, RVV). A source text that quotes a German page may quote the original German in the German translation.

**Tests (`src/i18n/content/content.test.ts`):**
- Every translated id exists in the data (a stale translation fails).
- **Numbers are kept:** every number in an English text (amounts, times, dates, percentages) appears in its translation, so a translation can never change a fact.
- Every offered language has every item translated (from chunk 2 on, when German is complete).
- No alcohol deals or drinking tips creep in (the data rule): the translations add no item, only words.

### Spanish and French

- **Dictionaries:** `messages/es/` and `messages/fr/`, each `{ ...en, ...areas }` until offered, area by area as German was written, each with a glossary in its `index.ts` first.
- **Same-as-English allow-lists:** `messages.test.ts`'s `SAME_IN_GERMAN` becomes one allow-list per language, and the "differs from English" test loops over every language with its own dictionary.
- **Plurals:** French counts 0 as singular ("0 semaine"), so French texts with a count use `plural()` (`Intl.PluralRules`), never `n === 1 ? …`. Spanish follows English (0 is plural); it uses `plural()` too, so neither language copies the English ternaries.
- **French typography:** a narrow no-break space before `:`, `;`, `?` and `!`, and « » quotes. The 375 px tour shows whether they wrap badly.
- **Widths:** nav labels of at most 9 characters and chart short names of at most 16, both tested. The tour runs every offered language.
- **Locales:** `es-ES` and `fr-FR` are already in the registry: `6,50 €` in both.

## Chunks

Each is about an hour, with lint, typecheck and the unit tests, an "As built" note here, a commit and its own draft PR, stacked as in plan 1. Heavy runs go through the lane.

**Part A: city content in German** (after it, the deferred German read covers the whole app)

1. **The mechanism and the German tips.** `src/i18n/content/`, `tipIn`, per-item `contentLang`, the id and numbers tests, and German for the 25 tips. The Tips page shows them in German.
2. **German for the rest of the city content.** Discounts, swaps (the swap line becomes all German: "spar etwa 10 € pro Essen"), the setup ranges' and semesters' sources. The completeness test for offered languages, CLAUDE.md's city-content rule, and the language hint if it needs a word on content.

**Part B: Spanish**

3. **Spanish frame.** The per-language allow-lists, the glossary, and Spanish for shell, language, common and categories.
4. Home, entries, setup.
5. Profile, recurring, accounts, backup.
6. Sync, account, sign-in and security.
7. Check-in, charts (short names), badges, reveal, tips chrome.
8. City content in Spanish.
9. **Offer Spanish**, after its native read: `OFFERED`, drop the spread, the language e2e and the tour with `E2E_LANGUAGES=all`, `test:offline`, a try on the phone.

**Part C: French**

10–16. As 3–9, in French, with `plural()` for counts and French spacing.

## Verification

- **Every chunk:** `npm run lint`, `npm run typecheck`, `npm test` (light lane).
- **Chunks 1, 2, 8 and 15** (content on the Tips page and in setup): `tips.spec.ts`, `discounts.spec.ts`, `swaps.spec.ts` and the language tour through the lane.
- **Offer steps (9, 16):** the "Adding a language" checklist in full.

## Left out

- Translating the MCP server's answers: they stay English, as in plan 1.
- A content editor or translation service: the translations are code, reviewed in PRs like the dictionaries.
- New city content: this plan translates what exists; no item is added, changed or dropped.
