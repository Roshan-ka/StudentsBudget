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
   - **As built (2026-11-03):**
     - The translations live in `src/i18n/city/` (`content.ts` already names `contentLang`): `CITY_WORDS` per language, `de/tips.ts` by tip id, and `tipIn(tip, lang)`, which returns the tip with its words and a `textLang` (`'en'` only where it falls back to English).
     - `RangeSource` takes a `textLang` with the item and marks the source text by it; a range without one (setup's city ranges, swaps) is still marked by `contentLang`.
     - The Tips page and a swap's related tip use `tipIn`; the swap's own words stay English until chunk 2.
     - `city.test.ts`: only existing ids; every number of the English title, body and source in the translation ("€1,000" and "1.000 €" count as the same); `Estimate` kept; titles and bodies in their own words; every tip in every offered language.
     - `tips.spec.ts`: a phone set to German sees every tip in German with its German source, and none marked English.
     - CLAUDE.md's city-content rule says how it works now.
2. **German for the rest of the city content.** Discounts, swaps (the swap line becomes all German: "spar etwa 10 € pro Essen"), the setup ranges' and semesters' sources. The completeness test for offered languages, CLAUDE.md's city-content rule, and the language hint if it needs a word on content.
   - **As built (2026-11-03):**
     - `discountIn` (offer, conditions, source; a place keeps its name unless it holds a common word: "Sportpark Ost pool" is "Hallenbad Sportpark Ost"), `swapIn` (title, body, `per`, source, `toSource`), `rangeIn` (by category; the three Estimate ranges stay `Estimate`).
     - Semester texts have no id and are partly built from templates, so `semesters` keys them by their exact English text: `periodIn`, `feePartIn` (label and source together, or both English) and `reRegistrationIn`. A changed English text makes its translation stale, and the test fails.
     - Wired: the Discounts tab, the swap line and its panel (`swapLineText` too), setup's rent and envelope ranges, Home's suggested budget, the profile's semester period and the semester fee's parts and re-registration.
     - `city.test.ts` covers every kind, the semester texts and completeness for offered languages; a broken German price was tried and fails it. `suggest.test.ts` reads the Mensa swap line all in German; `discounts.spec.ts` reads the Discounts tab on a phone set to German.
     - The language hint needed no change.

**Part B: Spanish**

3. **Spanish frame.** The per-language allow-lists, the glossary, and Spanish for shell, language, common and categories.
   - **As built (2026-11-03):**
     - `messages.test.ts`: `SAME_AS_ENGLISH` holds one allow-list per language (Spanish: the bare account option and BAföG), and the "own text" test runs for every language with a dictionary of its own, skipping a draft's unwritten areas. A test pins Spanish counting (0 is plural).
     - `messages/es/`: the glossary in `index.ts` (tú; sobre, registro, cuenta, estimación, revisión semanal, insignia; Regensburg stays Regensburg), `byCount` in `count.ts` for every count, and Spanish for shell, language, common and categories. Nav labels: Inicio, Registros, Gráficos, Consejos, Ajustes.
     - Category names fit the 16-character chart label (Alimentación, Salud y farmacia, Estudios, Deporte, Cuenta bloqueada); the three with short names use the English charts area until chunk 7.
     - `MESSAGES.es` is the Spanish draft. It shows only in dev builds, where the picker lists it as a draft.
4. Home, entries, setup.
   - **As built (2026-11-03):** Spanish for `home`, `entries` and `setup`, following the glossary: Disponible este mes, Sobres, Añadir rápido, Añadir automáticamente, calm "de más". Counts (missing rates, the envelope estimates) go through `byCount`. The allow-list gains the bare range format and the Plan heading, as German's did.
5. Profile, recurring, accounts, backup.
   - **As built (2026-11-03):** Spanish for `profile` (Cuota semestral, rematriculación), `recurring` (Gastos fijos e ingresos, Añadir automáticamente; weekday names come from the locale: "Cada semana, el lunes"), `accounts` (with moving money and the rates: Tipos de cambio, BCE) and `backup` (Copia de seguridad; the word to type before deleting everything is BORRAR). The allow-list gains Total, the bare rate format and the "?" after the file name in the restore question.
6. Sync, account, sign-in and security.
   - **As built (2026-11-03):** Spanish for `sync` (Sincronizar ahora, vincular; "hace 2 min" without a full stop, since "min" is a symbol), `account` (Tu cuenta) and `auth` (iniciar / cerrar sesión, verificación en dos pasos, llave de acceso, app de autenticación). Counts go through `byCount`. The allow-list gains the two bare full stops after the bold email.
7. Check-in, charts (short names), badges, reveal, tips chrome.
   - **As built (2026-11-03):** Spanish for `charts` (short names Suministros, Abono transporte, Salud; a period follows a comma, and "nothing spent" puts a range after a colon), `checkIn` (Revisión semanal), `badges` (Semana bajo presupuesto, Racha de registros, Realeza del ramen, Superviviente del latte, for the native read), `reveal` and the `tips` chrome. Every Spanish area is now written; the swap line still shows the swap's English title and unit until chunk 8.
8. City content in Spanish.
   - **As built (2026-11-03):** `src/i18n/city/es/` with the 25 tips, 17 discounts ("Sportpark Ost pool" is "Piscina Sportpark Ost"), 3 swaps (units: comida, entrada, mes), the city ranges and the semester texts (keyed by their English text, as in German; "(en alemán)" stays, since the pages are German). Registered in `CITY_WORDS`; `city.test.ts` checks it as it does German, numbers included. Based on main, not on chunk 7: it needs only the city mechanism.
9. **Offer Spanish**, after its native read: `OFFERED`, drop the spread, the language e2e and the tour with `E2E_LANGUAGES=all`, `test:offline`, a try on the phone.
   - **Waits for the read (Roshan, 03-11-2026):** unlike German, Spanish is offered only after a native speaker has read it, dictionary and city content alike. Until then it shows only in dev builds; French (Part C) goes ahead meanwhile.

**Part C: French**

10–16. As 3–9, in French, with `plural()` for counts and French spacing.

10. **French frame.**
    - **As built (2026-11-03):**
      - `messages/fr/`: the glossary in `index.ts` (tu; enveloppe, saisie, compte, estimation, bilan hebdomadaire, badge, Réglages; Regensburg stays Regensburg), `byCount` and `NNBSP` in `count.ts`, and French for shell, language, common and categories. Nav labels: Accueil, Saisies, Graphes, Conseils, Réglages.
      - Category names fit the 16-character chart label where no short name covers them (Repas dehors, Soins personnels, Télécoms, Frais ponctuels, Compte bloqué).
      - `messages.test.ts`: French's allow-list (Date, Source, Parents, Badges, BAföG, the bare account option); French counting pinned ("0 compte"); and every French text has a narrow no-break space before : ; ? ! and inside « » (a plain space was tried and fails it).
11. **French Home, entries, setup.**
    - **As built (2026-11-03):** French for `home` (Reste à dépenser ce mois-ci, Enveloppes, calm "de trop"), `entries` (Saisies, Ajout rapide, « döner 6 » with its spaces) and `setup` (Configure ton plan, Ajouter automatiquement). Problems that name an unnamed account or cost read "du compte 2" rather than splicing a name in. The allow-list gains Note, Type and the Plan heading.

## Verification

- **Every chunk:** `npm run lint`, `npm run typecheck`, `npm test` (light lane).
- **Chunks 1, 2, 8 and 15** (content on the Tips page and in setup): `tips.spec.ts`, `discounts.spec.ts`, `swaps.spec.ts` and the language tour through the lane.
- **Offer steps (9, 16):** the "Adding a language" checklist in full.

## Left out

- Translating the MCP server's answers: they stay English, as in plan 1.
- A content editor or translation service: the translations are code, reviewed in PRs like the dictionaries.
- New city content: this plan translates what exists; no item is added, changed or dropped.
