# Quick add: number words in German, French and Spanish

## Context
Quick add's local reader (no AI) understands English number words ("döner six euros", "twenty-five") but not "sechs Euro", "vingt-cinq euros" or "seis euros con cincuenta". Roshan chose to build it (18-11-2026), knowing the gain is mostly for typed lines: Chrome's dictation already writes digits (mic plan, 04-11-2026). It finishes a long-standing P1 follow-up (`2026-11-02-language-switch.md`: "a language's number words … can be added later").

Roshan approved this plan on 18-11-2026. It is built on `feat/number-words-2026-11-18`, one commit per chunk, one Draft PR.

## Approach
A pure pre-pass per phone language turns that language's number words into digits **before** the existing reader runs: "Döner sechs Euro fünfzig" → "Döner 6 Euro 50". Everything else is reused unchanged: euro markers, cents after "Euro" (`findCandidates`), the two-amount choice ("sieben vierzig" → "7 40": €7.40 or €40, as "seven forty"), refusing unread scales, and the new date reader (`lineDates` runs after the pre-pass, so "siebenundzwanzig November" → "27 November" is a date).

- `numberWordsToDigits(text: string, lang: Language): string` in a new `src/features/entries/number-words.ts`. English returns the text as it is (the parser reads English itself, on every phone).
- Called once in `localQuickAddProvider.read` (`src/features/entries/quick-add-provider.ts`), on `ctx.lang` (added in #304), before `lineDates` and `readQuickAdd`. The AI reader is untouched.
- Tokens are matched folded with the app's `fold` (`src/features/import/merchants.ts`: umlauts written out, so "fünf"/"fuenf", "dreißig"/"dreissig" both read) and accents dropped; a run of number words becomes one digit token, the rest of the line stays as typed.

## Decisions (defaults; Roshan approves with the plan)
- **Range:** whole euros 0–999 999, as English. "Millionen", "Milliarden", "million(s)", "milliard(s)", "millón/millones" become `million`, which the reader already refuses: never a silently smaller amount.
- **Cents:** after the euro word, as English: "sechs Euro fünfzig", "six euros cinquante", "seis euros (con) cincuenta" (Spanish "con" between "euros" and the cents is dropped). Cent words "Cent", "centime(s)", "céntimo(s)", "centavo(s)" become `cents`, so "fünfzig Cent" alone is refused like "fifty cents".
- **Articles alone are never numbers:** de ein/eine/einen/einem/einer, fr un/une, es un/una. "eins", "uno" and every compound are ("einundzwanzig", "vingt et un", "veintiún").
- **Not read:** decimal words ("Komma", "virgule", "coma"), ordinals ("siebenundzwanzigsten"), German numbers split by spaces ("zwei hundert").
- **The note:** count words in it become digits ("zwei Kaffee sechs Euro" → note "2 Kaffee"); English keeps its words. Accepted as the cost of one shared reader.

## Grammar per language (folded tokens; hyphens split in French)
- **German** (one token per number): null, eins/ein-(compound only), zwei … neun; zehn, elf, zwoelf, dreizehn … neunzehn (sechzehn, siebzehn); zwanzig, dreissig, vierzig … neunzig; `<unit>und<tens>`; `[1–9|ein]hundert[0–99]`; `[1–999|ein]tausend[0–999]`, parsed by splitting at "tausend", then "hundert", then "und".
- **French:** un/une (compound only), deux … neuf; dix, onze … seize; dix-sept … dix-neuf; vingt, trente, quarante, cinquante, soixante; soixante-dix … soixante-dix-neuf; quatre-vingt(s) … quatre-vingt-dix-neuf; septante, huitante/octante, nonante; "et" inside a run (vingt et un, soixante et onze); cent(s) multiplies what precedes or is 100; mille multiplies or is 1000.
- **Spanish:** uno/un-/una (un, una compound only), dos … nueve; diez, once … quince; dieciseis … diecinueve; veinte, veintiuno/veintiun/veintiuna … veintinueve; treinta … noventa with "y" + unit; cien (100), ciento + rest, doscientos/as … novecientos/as (quinientos, setecientos, novecientos); mil multiplies or is 1000.

## Chunks (~1 h each, one commit each)
1. **German** — `number-words.ts` with the shared run replacement (cents, scales, articles) and German; `number-words.test.ts`: "Döner sechs Euro fünfzig" → "Döner 6 Euro 50", "einundzwanzig", "zweihundertfünfzig", "tausendzweihundert", "dreißig"/"dreissig", "fünf"/"fuenf", "ein Döner sechs" keeps "ein", "zwei Millionen" → "2 million", "fünfzig Cent" → "50 cents", English unchanged on any phone.
2. **French and Spanish** — the two grammars and their tests: "vingt-cinq", "vingt et un", "soixante-dix-sept", "quatre-vingts", "quatre-vingt-dix-neuf", "septante", "deux cents", "mille cinq cents", "six euros cinquante", "un café trois" keeps "un"; "veinticinco", "treinta y cinco", "dieciséis", "quinientos", "ciento veinte", "dos mil", "seis euros con cincuenta" → "6 euros 50", "una cerveza" keeps "una".
3. **Quick add uses it** — the pre-pass in `localQuickAddProvider`; provider tests per language (reading, category, a choice, a date after the pre-pass, refused scales); `e2e/entries.spec.ts` gets a `test.describe('in German')` with `test.use({ locale: 'de-DE' })`: "Döner sechs Euro fünfzig" → status matching `Gespeichert: 6,50 € · Döner · Essen auswärts` (`// proof: number-words`), with a saved mutation in `e2e/mutations/entries.json` that skips the pre-pass. CLAUDE.md (Quick add) and the plan's As built.

## Review focus
1. A note word that is also a number: fr "neuf" (new), es "once", de "elf": converted on that phone ("vélo neuf 200" → "vélo 9 200", which the reader refuses as unclear). Pinned by a test so it stays known.
2. "sept" on a French phone is 7 before the date reader sees it, so "sept 4" is no longer 4 September there (the month stays readable as "septembre").
3. Two number runs side by side ("zwanzig zehn") become "20 10", read by the existing adjacent-number rules, never joined.
4. A word that only looks like a number inside another ("Hundertwasser", "Zehnerkarte") stays a word: whole tokens only.

## Verification
- No local runs (Roshan's rule since 12-11-2026): CI's quick check runs the unit tests once the PR is ready.
- Then Actions → CI → Run workflow on the branch with `specs: entries.spec.ts`, `browsers: all`, `mutations: all` for the German case and its saved mutation.
- After merge, a try on the live site with the language set to German, French and Spanish: one typed line each.

## As built

- **Chunk 1** (`bcc5032`): `numberWordsToDigits` in `src/features/entries/number-words.ts` with the shared run replacement (whole tokens, articles, `million`, `cents`) and German, one word per number; `number-words.test.ts`.
- **Chunk 2** (`68c07cc`): French (parts by hyphens or spaces, "et", 70/80/90 in both the French and the Belgian and Swiss words, "cent(s)", "mille") and Spanish ("y", the 21–29 words, irregular hundreds, "cien" and "ciento", "mil", "con" dropped after "euros"), with `withThousands` shared; tests per language.
- **Chunk 3**: `localQuickAddProvider` runs the pre-pass on `ctx.lang` before `lineDates` and `readQuickAdd`. Provider tests: an amount in each language, the "sieben vierzig" choice, a date in number words, an article, English on a German phone, a refused scale, German on an English phone. `entries.spec.ts`: "in German", "Döner sechs Euro fünfzig" saves €6.50 (`number-words`, with a saved mutation that reads English only). CLAUDE.md's Quick add.
- **Still owed:** a typed try on the live site in German, French and Spanish.
