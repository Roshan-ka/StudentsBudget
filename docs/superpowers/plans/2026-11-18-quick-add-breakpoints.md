# Quick add breakpoints: no silent wrong amounts, days or categories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quick add never saves an amount, a day or a category the student didn't mean without asking; where it can't tell, it asks or refuses.

**Architecture:**
- **The reader (chunks 1 and 3):** the fixes are pure functions in the reader, unit-tested in each language. The three files are `number-words.ts`, `quick-add-date.ts` and `quick-add.ts`; `readLineParts` joins them.
- **The field (chunks 2 and 4):** the fixes are in `quick-add-field.tsx`, proved by e2e specs with saved mutations.
- **Two small list fixes (chunk 5):** the focus after a delete moves into a pure module, `list-order.ts`.

**Tech Stack:** Next.js 16, React 19, Dexie, Vitest, Playwright with saved mutations (`e2e/mutations/<spec>.json`, `// proof: <id>`).

**Spec:** the pain-point check of 18-11-2026, "Findings" below. It covers the live site at 375 px in four languages and two code reads; each finding is reproduced unless it says "traced".

## Global Constraints

- **Checks run in CI, not here.** No local lint, typecheck or tests (Roshan, 12-11-2026): the quick check on the ready PR runs the unit tests.
- **e2e:** e2e runs through Actions → CI → Run workflow with `specs:`, which Roshan starts.
- **Each new or changed e2e test** gets a saved mutation and a `// proof: <id>` on its matcher line. A page test proves with a page matcher.
- **Texts:** every new text is in `en`, `de`, `fr` and `es` (`src/i18n/messages/<code>/entries.ts`). French puts a narrow no-break space (`NNBSP`) before `? ! : ;` and inside « ».
- **Dates and money:**
  - Dates are `IsoDate` and show through `formatDate`.
  - Amounts are integer minor units.
  - A reading dated after today is refused with `quickAdd.futureDate` (exists).
- **Pinned behaviour:** what the tests already pin stays, unless this plan changes it on purpose and says so.
  - "6 mai Döner" stays €6 with no date.
  - "lunch with jan 12" stays €12.
  - "10 haircut on 27 november 2025" stays €10 on 27.11.2025.
  - The hint's own example stays €6, Eating out, yesterday.
- **Commits:** Conventional Commits ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. One commit per chunk, on `fix/quick-add-breakpoints-2026-11-18`, one Draft PR.
- **Docs:** CLAUDE.md's Quick add bullets and this plan's As built change with the chunk that changes the behaviour.

## Findings (the spec)

| # | Typed (phone language) | Saved today | Wanted |
|---|---|---|---|
| F1 | "Kaffee ein Euro fünfzig" (de), "café un euro cinquante" (fr), "café un euro con cincuenta" (es) | €50.00 | €1.50 |
| F2 | "café dos euros y cincuenta" (es), "Döner sechs Euro und fünfzig" (de), "coffee six euros and fifty" (en) | €2 / €6, the cents in the note | €2.50 / €6.50 |
| F3 | "döner 10 november 2025", "Miete 400 November 2025" | €2,025 | no year as an amount: refused / €400 |
| F4 | "Döner 6 am 17.", "döner 6 on 17", "le 17", "el 17" | €17 | €6 on the 17th |
| F5 | "2 döner with Jan 7", "Kino mit Jan 2 Tickets 18" | €2 on 07.01.2026 / €18 on 02.01.2026 | €7 / €18, no date |
| F6 | a double tap on "€7.40" of a line with no category | filed under Food & groceries | the chips ask |
| F7 | Enter twice, or letters typed, after the chips ask (keyboard) | the first chip picked; letters lost | nothing picked; the letters start the next line |
| F8 | "döner con Domingo 15" (es) | dated Sunday 15.11. | no date |
| F9 | "next friday", "nächsten Freitag", "vendredi prochain", "el próximo viernes", "tomorrow", "morgen", "demain", "mañana" | a past day or today, the word in the note | refused as still to come |
| F10 | "Döner 30 am 5.12" (in November) | 05.12.2025 | refused as still to come (decision D1) |
| F11 | traced: the mic listening, then a chip tapped, then speech | the line saved twice | one save |
| F12 | traced: a spoken line while a typed one is read or asked | the spoken line lost | not lost |
| F13 | traced: the page left mid-sentence | the line still saves on the hidden page | nothing saves |
| F14 | traced: an edit in the first moments of an AI read (before `readAbort` is set) | the old line saves, the edit is wiped | the old line is dropped |
| F15 | deleting the first of several entries on a day | the focus and scroll jump to an unrelated row | the next row shown |
| F16 | "+50 from mom" | "Add an amount, like “döner 6”." | says quick add is for spending |
| F17 | an empty past month | "Log with quick add above." | says how to log a day in that month |

Checked and ruled out:
- A double tap on a category chip hitting Undo: it didn't happen at a human tap's pace.
- French "quatre vingt" read as 80: that is the right reading.

## Decisions (defaults; Roshan approves them with the plan)

- **D1. A date with no year** ("am 5.12", "27 nov", "am 17.") is the day of that date **nearest to today**. If that day is still to come, the line is refused like any future date. Today the rule is the most recent such day, so "am 5.12" in November saves 05.12.2025, a year back, without a word. A tie goes to the past day. Weekdays keep their rule: the most recent, today included.
- **D2. A year is never an amount next to a month name.**
  - "Miete 400 November 2025" saves €400 today, with "November 2025" in the note.
  - Numbers of a date that has a year are never the amount either: "döner 10 november 2025" has no amount and is refused, so the student adds one.
- **D3. A day and a month name with no cue word and no year is a weak date.**
  - It is not taken when the amount it would leave is a count: the line's first token, followed by a word ("2 döner with Jan 7" → €7, no date).
  - In the month-first form, a day followed by another word is a count, not a day ("Jan 2 Tickets 18" → €18, no date).
- **D4. Category chips and amount buttons ignore taps for `CHIP_ARM_MS` (500 ms)** after they appear, and again after More opens. A printable key on a chip goes to the field, so typing continues the line as `lineAfterQuestion` says. The first chip keeps the focus (accessibility, chunk 5).
- **D5. While the mic listens, Add, the chips and the amount buttons are disabled.** The mic is already disabled while a line is read.
- **Left out, each needs a look or a call first:**
  - A note when a line names one of the plan's fixed costs ("rent 400" counts twice with the schedule).
  - The first discount sitting below the fold on a phone (a mockup first, Roshan's rule).

## Review Focus

1. **An amount said with an article in a sentence:** "ein Döner fünf Euro" must stay €5. The article rule changes only before a euro word. Pinned in Task 1.
2. **A cue word in ordinary text:** "lunch on campus 6", "am Bahnhof 4", "le pain 2" and "el café 3" must keep their amount and get no date. Pinned in Task 1.
3. **Year-end:** "27 dec" typed on 5 January is last year. "3 jan" typed on 20 December is still to come and refused. Pinned in Task 3 with a fixed `today`.
4. **"morgen" meaning morning:** "Kaffee 2 am Morgen" and "Bäcker 3 heute morgen" save today, never refused. "mañana" likewise after "esta" or "la". Pinned in Task 3.
5. **A double tap on More:** the second tap must not pick the chip that takes More's place. Pinned in Task 2 (the guard re-arms when More opens).

---

### Task 1: No silent wrong amounts (F1–F4)

**Files:**
- Modify: `src/features/entries/number-words.ts` (`numberWordsToDigits`, `ARTICLES` use, the `con` drop at the end)
- Modify: `src/features/entries/quick-add.ts` (`readQuickAdd`, `findCandidates`)
- Modify: `src/features/entries/quick-add-date.ts` (`dateAt`: a cue word plus a bare day; new export)
- Modify: `src/features/entries/quick-add-provider.ts` (`readLineParts`)
- Test: `number-words.test.ts`, `quick-add.test.ts`, `quick-add-date.test.ts`, `quick-add-provider.test.ts`

**Interfaces:**
- Produces: `readQuickAdd(text: string, notAmounts?: ReadonlySet<number>): QuickAddLine | null`. `notAmounts` holds token indexes of `text.trim().split(/\s+/)` that are never an amount; they stay in the note.
- Produces: `dateNumberTokens(text: string, lang: Language): Set<number>` in `quick-add-date.ts`. It returns the indexes of a year (`YEAR`) right after a month name (a connector between them allowed), and, when that year is there, the date's day number too.
- Produces: in `dateAt`, a cue word (`CUES`) followed by a bare day (`DAY`: "17", "17.", "17th", "3rd") is a date. With D1 not built yet, it is the most recent such day of this month or the month before. Task 3 moves it to D1.

- [ ] **Step 1: Write the failing tests**
  - `number-words.test.ts`:
    - `numberWordsToDigits('Kaffee ein Euro fünfzig', 'de')` → `'Kaffee 1 Euro 50'`
    - `numberWordsToDigits('café un euro cinquante', 'fr')` → `'café 1 euro 50'`
    - `numberWordsToDigits('café un euro con cincuenta', 'es')` → `'café 1 euro 50'`
    - `numberWordsToDigits('café dos euros y cincuenta', 'es')` → `'café 2 euros 50'`
    - `numberWordsToDigits('Döner sechs Euro und fünfzig', 'de')` → `'Döner 6 Euro 50'`
    - `numberWordsToDigits('six euros et cinquante', 'fr')` → `'6 euros 50'`
    - unchanged: `'ein Döner fünf Euro'` (de) keeps "ein" → `'ein Döner 5 Euro'`; `'un café trois'` (fr) → `'un café 3'`
    - the connector stays when more words follow: `'Döner sechs Euro und zwei Cola'` (de) → `'Döner 6 Euro und 2 Cola'`
  - `quick-add.test.ts`:
    - `readQuickAdd('coffee six euros and fifty')` → amount 650, note `'coffee'`
    - `readQuickAdd('coffee 6 euros and 50')` → 650
    - unchanged: `readQuickAdd('coffee 6 euros and 2 cookies')` → 600
    - `readQuickAdd('Miete 400 November 2025', new Set([3]))` → amount 40000, note `'Miete November 2025'`
    - `readQuickAdd('döner 10 november 2025', new Set([1, 3]))` → null
  - `quick-add-date.test.ts`:
    - `lineDates('Döner 6 am 17.', '2026-11-18', 'de')[0]` → `{ date: '2026-11-17', rest: 'Döner 6' }`
    - `'döner 6 on 17'` (en) → 2026-11-17
    - `'döner 6 le 17'` (fr) → 2026-11-17
    - `'döner 6 el 17'` (es) → 2026-11-17
    - `'Miete 400 am 31.'` (de, today 2026-11-18) → 2026-10-31
    - no date: `'lunch on campus 6'`, `'am Bahnhof 4'` (de), `'le pain 2'` (fr), `'el café 3'` (es)
    - `dateNumberTokens('Miete 400 November 2025', 'de')` → `{3}`
    - `dateNumberTokens('döner 10 november 2025', 'en')` → `{1, 3}`
    - `dateNumberTokens('döner 6', 'en')` → empty
  - `quick-add-provider.test.ts`, through `localQuickAddProvider.read`:
    - "Kaffee ein Euro fünfzig" (de) → 150, eating-out
    - "café dos euros y cincuenta" (es) → 250
    - "Döner 6 am 17." (de) → 600 on '2026-11-17'
    - "Miete 400 November 2025" (de) → 40000, no date
    - "döner 10 november 2025" → null
    - unchanged: "10 haircut on 27 november 2025" → 1000 on '2025-11-27'; "6 mai Döner" (de) → 600, no date

- [ ] **Step 2: Implement**
  - **`numberWordsToDigits`:**
    - A lone article whose next token folds to a euro marker reads as 1.
    - The connector drop takes per language `{ es: ['con', 'y'], de: ['und'], fr: ['et'] }` between a euro marker and digits, only when those digits end the line (a cent word may follow).
  - **`findCandidates`:** reads the cents after one `and` that follows the marker, only when they end the line; otherwise the line reads as before.
  - **`readQuickAdd`:** skips any word whose token is in `notAmounts`.
  - **`readLineParts`:** passes `dateNumberTokens(typed, lang)` to the whole-line fallback only. The dated path's `rest` has no date tokens left.

- [ ] **Step 3: Commit**
  - The message is `fix(quick-add): no year, day or article becomes the amount`.
  - CLAUDE.md's Quick add bullets: number words (article before a euro word, und/et/y/con), and a date in the line (cue plus a bare day; a year never an amount).

### Task 2: The chips never pick for the student (F6, F7)

**Files:**
- Modify: `src/features/entries/quick-add-field.tsx` (`CategoryChips`, `AmountChoice`, their `onPick` wiring)
- Test: `e2e/entries.spec.ts`, `e2e/mutations/entries.json`

**Interfaces:**
- Produces: `const CHIP_ARM_MS = 500` in `quick-add-field.tsx`, and a hook `useArmed(key: unknown): boolean`. The hook is false until `CHIP_ARM_MS` after mount, and after `key` changes. `CategoryChips` passes `showMore`.
- Produces: `onTypeAhead(key: string)` from the field into both groups. A printable key with no Ctrl, Meta or Alt, pressed on a chip, focuses the field and applies the same change as typing that key at the end of the field. It goes through `droppedLine` and `lineAfterQuestion`.

- [ ] **Step 1: Write the failing e2e tests** in `entries.spec.ts`
  - **"a double tap on an amount never picks a category"**
    - Type "qqq 7 40", then `dblclick` "€7.40".
    - Expect the group "Category" visible: `// proof: chip-armed`.
    - Expect no status "Saved".
    - Then a click on "Other" saves "Saved €7.40 · qqq · Other".
  - **"a double tap on More never picks the chip in its place"**
    - Type "qqq 5", then `dblclick` More.
    - Expect the group still asking: `// proof: more-armed`.
  - **"typing on after the question starts the next line"**
    - Type "poster 6,50" and press Enter.
    - Then `page.keyboard.type('döner 3')`.
    - Expect the field's value `'döner 3'`: `// proof: chip-type-ahead`.
    - Expect the line "“poster 6,50” wasn't saved".
    - Press Enter: "Saved €3.00 · döner · Eating out".

- [ ] **Step 2: Saved mutations in `e2e/mutations/entries.json`**
  - `CHIP_ARM_MS = 500` becomes `0`: expects `chip-armed` and `more-armed`.
  - The `onKeyDown` type-ahead on the groups is removed: expects `chip-type-ahead`.

- [ ] **Step 3: Implement**
  - `onPick` and the amount buttons do nothing while `!armed`. Not `disabled`, so nothing flickers and the focus stays.
  - Each group's `onKeyDown` calls `onTypeAhead` and prevents the default.

- [ ] **Step 4: Commit**
  - The message is `fix(quick-add): new chips wait half a second, and typing goes to the field`.
  - CLAUDE.md's Quick add bullet: the chips' guard and the type-ahead.

### Task 3: Days that are still to come, and dates that are names (F5, F8, F9, F10)

**Files:**
- Modify: `src/features/entries/quick-add-date.ts` (`dayOf`, `numericDate`, the cue-day rule from Task 1, `dateAt`, new word lists)
- Modify: `src/features/entries/quick-add-provider.ts` (the weak-date rule D3 in `readLineParts`)
- Test: `quick-add-date.test.ts`, `quick-add-provider.test.ts`

**Interfaces:**
- Consumes: Task 1's cue-day rule and `dateNumberTokens`.
- Produces: `nearestDay(day: number, month: number | null, year: number | null, today: IsoDate): IsoDate | null` (D1).
  - With a year, that day.
  - Without one, the occurrence (last, this or next year) nearest to `today`, the past one on a tie.
  - With no month (a cue word and a bare day, "am 17."), the occurrence in last, this or next month nearest to `today`.
  - Null for a day the month doesn't have.
- Produces: `LineDate` gains `weak: boolean`. True for a day plus a month name with no cue word and no year.
- Produces: the word lists.
  - `NEXT_BEFORE`: en `next`; de `nächsten`, `nächster`, `kommenden`, `kommender`; es `proximo`.
  - `NEXT_AFTER`: fr `prochain`.
  - `TOMORROW`: en `tomorrow`, de `morgen`, fr `demain`, es `manana`.
  - `TOMORROW_NOT_AFTER`: de `am`, `heute`, `gestern`, `vorgestern`; es `esta`, `la`, `por`.

- [ ] **Step 1: Write the failing tests** (today `'2026-11-18'` unless named)
  - **D1:**
    - `lineDates('Döner 30 am 5.12', today, 'de')[0].date` → `'2026-12-05'`. The provider then reads it and the field refuses it as future.
    - `'27 dec'` with today `'2027-01-05'` → `'2026-12-27'`.
    - `'3 jan'` with today `'2026-12-20'` → `'2027-01-03'`.
    - `'15 aug'` → `'2026-08-15'`.
    - `'Döner 6 am 25.'` → `'2026-11-25'`.
  - **Next and tomorrow:**
    - "döner 6 next friday" → `'2026-11-20'`.
    - "nächsten Freitag" (de), "vendredi prochain" (fr), "el próximo viernes" (es) → `'2026-11-20'`.
    - "tomorrow", "morgen", "demain", "mañana" → `'2026-11-19'`.
  - **"morgen" and "mañana" meaning morning:**
    - "Kaffee 2 am Morgen" → no date.
    - "Bäcker 3 heute morgen" → `'2026-11-18'`.
    - "café 2 esta mañana" → no date.
  - **F8:** "döner con Domingo 15" (es) → no date; "döner 6 el domingo" (es) → `'2026-11-15'`.
  - **D3, through the provider:**
    - "2 döner with Jan 7" → 700, no date.
    - "Kino mit Jan 2 Tickets 18" (de) → 1800, no date.
    - unchanged: "lunch 6 Nov 27" → 600, dated by D1 (`'2026-11-27'`, then refused by the field); "lunch with jan 12" → 1200; "10 haircut on 27 november 2025" → 1000 on '2025-11-27'.
  - **Provider and field:** the future check in the field (exists) refuses `'2026-11-19'` and `'2026-11-20'`. One provider test asserts the reading carries that date; the refusal itself is pinned by `entries.spec.ts` "döner 4 on 3 december 2026".
  - **Changed on purpose:** the tests in `quick-add-date.test.ts` that pin "the most recent day" for a no-year date still to come move to D1's nearest day. Name each one in the commit message.

- [ ] **Step 2: Implement**
  - `dayOf`, `numericDate` and the cue day go through `nearestDay`.
  - Spanish weekdays count only after `el` or before `pasado` (es only).
  - D3 lives in `readLineParts`: a weak date is skipped when the amount left is the first token followed by a word, or when its month-first day is followed by a word.

- [ ] **Step 3: Commit**
  - The message is `fix(quick-add): a day still to come is refused, and a name is no month or weekday`.
  - CLAUDE.md's "A date in the line" bullet: the nearest day, next and tomorrow, weak dates, Spanish weekdays after "el".

### Task 4: The mic and the read in flight (F11–F14)

**Files:**
- Modify: `src/features/entries/quick-add-field.tsx` (`onMic`'s `onText`, the mic cleanup effect, `addLine`'s start, the `disabled` props)
- Test: `e2e/dictation.spec.ts`, `e2e/ai-quick-add.spec.ts`, their `e2e/mutations/*.json`

**Interfaces:**
- Produces: `askedLine` and `askingRef`, refs of the asked line and whether quick add asks. `onText` reads these instead of the state captured at the mic tap.
- Produces: the mic cleanup on leaving calls `abort()` (`speech.ts` has it), not `stop()`.
- Produces: `addLine` creates its `AbortController` and sets `readAbort.current` before its first await. It returns after each await when `controller.signal.aborted`.

- [ ] **Step 1: Write the failing e2e tests** (with `fakeSpeech`, `mockAiFunction`)
  - **`dictation.spec.ts` "the chips can't be tapped while the mic listens"**
    - "poster 6,50" asks, then the mic is tapped.
    - Expect "Shopping" disabled: `// proof: chips-off-while-listening`.
    - The fake says "döner 3".
    - Expect one "Saved €3.00 · döner · Eating out", and the poster line noted as not saved.
  - **`dictation.spec.ts` "leaving the page mid-sentence saves nothing"**
    - Tap the mic, go to Home, the fake answers after the page is hidden, then come back.
    - Expect no Saved line and no new entry: `// proof: mic-abort-on-leave`.
    - The fake must answer `abort()` with no result.
  - **`ai-quick-add.spec.ts` "an edit while the session is checked drops the line"**
    - Delay the auth refresh with `page.route`, add "döner 6", then edit to "döner 6,50" before the read starts.
    - Expect no entry of €6: `// proof: early-edit-drops`.
    - Expect the field to keep "döner 6,50".

- [ ] **Step 2: Saved mutations**
  - The `disabled` while listening goes back to `busy`: expects `chips-off-while-listening`.
  - `abort()` goes back to `stop()`: expects `mic-abort-on-leave`.
  - `readAbort.current = controller` moves back after `aiReady`: expects `early-edit-drops`.

- [ ] **Step 3: Implement** as the Interfaces say. Add, the chips and the amount buttons get `disabled={busy || listening}` (D5).

- [ ] **Step 4: Commit**
  - The message is `fix(quick-add): one save per line with the mic, and an early edit drops the old line`.
  - CLAUDE.md's mic bullet.

### Task 5: The focus after a delete, and two lines that send the student wrong (F15–F17)

**Files:**
- Create: `src/features/entries/list-order.ts`, which takes `groupByDate` from `entries-list.tsx` and adds `neighbourOf`.
- Modify: `src/features/entries/entries-list.tsx` (uses both; the empty-month hint)
- Modify: `src/features/entries/quick-add.ts` (`looksLikeIncome`), `quick-add-field.tsx` (the no-amount branch at the `noAmount` error)
- Modify: `src/i18n/messages/{en,de,fr,es}/entries.ts`
- Test: `list-order.test.ts` (new), `quick-add.test.ts`, `quick-add-provider.test.ts`, `e2e/entries.spec.ts`, `e2e/mutations/entries.json`

**Interfaces:**
- Produces: `groupByDate(entries: Entry[]): { date: IsoDate; entries: Entry[] }[]` (moved, unchanged).
- Produces: `neighbourOf(entries: Entry[], id: string): string | null`. It returns the id after `id` in the shown order (`groupByDate` flattened), else the one before, else null; the list then takes the focus.
- Produces: `looksLikeIncome(text: string): boolean`, true for a line that starts with `+` and a number ("+50 from mom", "+ 50").
- Produces: the texts.
  - `quickAdd.incomeLine`, en: 'Quick add is for spending. Add money that came in with Add entry.'
  - `list.otherMonthHint(example: string)`, en: `Name the day in quick add, like “${example}”.`
  - The example per language, built from the shown month: en `döner 6 on 3.<m>`, de `Döner 6 am 3.<m>.`, fr `döner 6 le 3/<m>`, es `döner 6 el 3/<m>`.

- [ ] **Step 1: Write the failing tests**
  - `list-order.test.ts`: three entries on one day created 10:00, 11:00 and 12:00, plus one the day before.
    - `neighbourOf(entries, <12:00 id>)` → the 11:00 id.
    - The last one shown → the one before it.
    - The only entry → null.
  - `quick-add.test.ts`:
    - `looksLikeIncome('+50 from mom')` → true.
    - `looksLikeIncome('döner 6')` → false.
    - `looksLikeIncome('bus +2')` → false.
  - `quick-add-provider.test.ts`: in every offered language, the empty-month example for August reads as 600, eating-out, dated `'2026-08-03'`. This follows the pattern of "the hint's own example".
  - `entries.spec.ts`:
    - **"deleting an entry hands the focus to the next one shown"**: three lines on one day, then delete the newest. Expect the next row shown focused: `// proof: delete-focus-shown-order`.
    - **"+50 from mom says quick add is for spending"**: `// proof: income-line`.
    - **"an empty past month says how to log a day there"**: `// proof: other-month-hint`.

- [ ] **Step 2: Saved mutations**
  - `neighbourOf` uses the unsorted list: expects `delete-focus-shown-order`.
  - The income branch is removed: expects `income-line`.
  - The past month uses `nothingYetHint`: expects `other-month-hint`.

- [ ] **Step 3: Implement** in the files above. `nothingYetHint` stays for the current month.

- [ ] **Step 4: Commit**
  - The message is `fix(entries): focus after a delete in the order shown, and two clearer lines`.
  - Then the As built section of this plan.

## Verification

- Each chunk's unit tests run in the quick check once the PR is ready.
- e2e, by hand on the branch: Actions → CI → Run workflow with `specs: entries.spec.ts dictation.spec.ts ai-quick-add.spec.ts`, `browsers: all`, `mutations: all`.
- After the merge, a guest walk on the live site repeats every finding's line in its language.

## As built

(filled in per chunk)
