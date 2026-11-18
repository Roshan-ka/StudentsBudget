# Quick add: a date in the line, read on the phone

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** quick add's local reader, with no AI, takes a date written in the line ("10 haircut on 27 november 2025", "döner 6 gestern", "am 27.11.") and saves the entry on that day.

**Architecture:** a pure reader, `readLineDate` in `src/features/entries/quick-add-date.ts`, takes the date out of the line before `readQuickAdd` reads the amount and the note from the rest. `localQuickAddProvider` puts the date on the reading, which already carries one (the AI reader fills it); `checkReading`, the Saved line ("· 27.11.2025") and `save()` already use it. Quick add refuses a reading dated after today, from either reader.

**Tech stack:** TypeScript, `Intl.DateTimeFormat` for the month names, `readTypedDate` (`src/components/date-input.ts`) for numbers, Vitest, Playwright.

**Spec:** Roshan's request and the defaults he accepted, 18-11-2026 (this file, Decisions).

## Decisions (Roshan, 18-11-2026: "Yes, plan and build" on these defaults)

- **Month names** in the phone's language and in English, full or cut to at least three letters ("nov", "Dez.", "sept."), day first or month first, with or without a four-digit year: "27 november 2025", "27 Nov", "Nov 27, 2025", "27. November", "27th of november", "27 novembre", "1er décembre", "27 de noviembre de 2025".
- **Whole numeric dates:** "27.11.2025", "27/11/25", "2025-11-27".
- **A day and month in numbers** only after "on", "am", "le" or "el" ("on 27.11", "am 27.11."). A bare "27.11" stays €27.11, as today.
- **Today, yesterday and the day before** in the phone's language and English: today, yesterday, (the) day before yesterday; heute, gestern, vorgestern; aujourd'hui, hier, avant-hier; hoy, ayer, anteayer. Only the phone's language and English, so German "hier" (here) is never French "yesterday".
- **No year:** the most recent such day, today included ("27 Nov" in January is last November).
- **A day after today** is not saved: quick add says so under the field ("That day is still to come…").
- **The amount comes first:** when taking the date out leaves no amount ("6 mai döner"), the line is read as before, with no date.
- **Weekday names** (chunk 3, Roshan's "start next chunk", 18-11-2026): full names only, in the phone's language and English ("sun", "sat", "wed" are words too). A name alone is the most recent such day, today included; "last" or "letzten" in front, "dernier" or "pasado" after, make it the one before today.
- **Later, not now:** a two-digit year after a month name ("27 nov 25" reads 25 as the amount).

## Global constraints

- Money in integer minor units; dates as local `IsoDate`; a full date is shown with `formatDate`.
- Every text in en, de, fr and es; French with its narrow no-break spaces (`messages.test.ts`).
- A new or changed e2e test gets a saved mutation in `e2e/mutations/<spec>.json` and a `// proof:` comment.
- No local test runs (CI checks the PR); commits are Conventional Commits with the Co-Authored-By line.

## Review focus

1. "haircut 10 november 27": a day number after the month, with no year, is that month's day, so the number before stays the amount (€10 on 27 November; "10 Nov 27, 2025" likewise). Pinned by a unit test so it stays deliberate.
2. A note word that is a month cut short ("Jan", "mai", "mars") next to a number: read as a date only when an amount is left. Unit tests: "lunch with jan 12" stays €12, "Mars 2" stays €2.
3. A date that doesn't exist ("31 february", "29.02.2027") is no date: the line is read as before.
4. A future date from the AI reader is refused the same way as from the local one (the check sits in the field, after `checkReading`).
5. A choice line with a date ("coffee 7 40 euros yesterday"): the amount tapped keeps the date (`chosenAmount`).

---

### Chunk 1: the date reader

**Files:**
- Create: `src/features/entries/quick-add-date.ts`, `src/features/entries/quick-add-date.test.ts`

**Interfaces:**
- Produces: `lineDates(text: string, today: IsoDate, lang: Language): LineDate[]` (`LineDate = { date: IsoDate; rest: string }`): every date in the line, in the order it starts, each with its cue word ("on", "am", "le", "el"; "on the") and connectors ("of", "de") out of `rest`; `readLineDate` gives the first or null.

- [ ] **Step 1: unit tests** (today `2026-11-18`): every form under Decisions in its language, each with its `rest`; English on a German phone ("gestern" and "yesterday"); no date for "haircut 27.11", "lunch on campus 6", "döner hier 6" on a German phone, "31 february", "november 2025" (no day); "haircut 10 november 27" gives 10 November; "27 Nov" with no year gives `2025-11-27`, "3 nov" gives `2026-11-03`; "on 27 december 2026" gives `2026-12-27` (the field refuses it).
- [ ] **Step 2: `readLineDate`.** Tokens split on spaces, matched case-folded with accents and a trailing `.,;:` dropped. Month names from `Intl.DateTimeFormat(locale, { month: 'long' })` for the phone's language and English; a token of three letters or more matches a month when it starts that month's name, and only one month's.
- [ ] **Step 3: commit** `feat(quick-add): read a date from a line, in four languages`.

### Chunk 2: quick add uses it

**Files:**
- Modify: `src/features/entries/quick-add-provider.ts` (`QuickAddContext.lang`, the date on both reading kinds, `checkReading`, `chosenAmount`), `src/features/entries/quick-add-field.tsx` (`loadContext(lang)`, the future-day check in `addLine`), `src/i18n/messages/{en,de,fr,es}/entries.ts` (`quickAdd.futureDate`)
- Test: `src/features/entries/quick-add-provider.test.ts`, `e2e/entries.spec.ts`, `e2e/mutations/entries.json`

**Interfaces:**
- Consumes: `readLineDate` (chunk 1).
- Produces: `QuickAddContext = { today; accounts; history; lang?: Language }` (no `lang` reads English dates only); `QuickAddChoiceReading.date?: IsoDate`.

- [ ] **Step 1: provider tests:** "10 haircut on 27 november 2025" → €10, note "haircut", date `2025-11-27`; "6 mai döner" on a German phone → €6, note "mai döner", no date; "coffee 7 40 euros yesterday" → a choice dated yesterday, and `chosenAmount` keeps it; `checkReading` keeps a choice's date.
- [ ] **Step 2: the provider and the field.** The field refuses a reading dated after `ctx.today` with `quickAdd.futureDate` (en: "That day is still to come. Quick add saves what you’ve already spent.").
- [ ] **Step 3: e2e** (`SETUP_DAY`, 16.10.2026): "döner 6 yesterday" → "Saved €6.00 · döner · Eating out · 15.10.2026" (`// proof: line-date`), and "döner 6 on 3 december 2026" → the futureDate alert and nothing saved. Saved mutation: the provider leaves the date out.
- [ ] **Step 4: CLAUDE.md** (Quick add, Plans table) and this plan's As built; commit `feat(quick-add): save on the day the line names`.

### Chunk 3: weekday names

**Files:**
- Modify: `src/features/entries/quick-add-date.ts` (`LAST_BEFORE`, `LAST_AFTER`, `weekdayOfToken`, `lastWeekday`)
- Test: `quick-add-date.test.ts`, `quick-add-provider.test.ts`, `e2e/entries.spec.ts`, `e2e/mutations/entries.json`

- [ ] **Step 1: unit tests** (18.11.2026, a Wednesday): "friday", "on Monday", "wednesday" (today), "last wednesday" (a week back), "am Freitag", "Sonntag", "letzten Mittwoch", "vendredi", "mercredi dernier", "el viernes", "sábado", "el miércoles pasado", English on a German phone; no weekday in "sun cream 5", "coffee 3 sat", or a German name on an English phone.
- [ ] **Step 2: the reader.** Weekday names from `Intl.DateTimeFormat(locale, { weekday: 'long' })`, folded, whole tokens only.
- [ ] **Step 3: e2e:** on the setup day, a Friday, "döner 3 last friday" saves on 09.10.2026 (`line-weekday`, with a saved mutation that stops reading "last").
- [ ] **Step 4: commit** `feat(quick-add): read a weekday from a line`.

## As built

- **Chunk 1** (`a94a811`): `lineDates` and `readLineDate` in `src/features/entries/quick-add-date.ts`, month names from `Intl.DateTimeFormat` per language (cached), `readTypedDate` for the numbers; unit tests in `quick-add-date.test.ts` for every form in each language, the no-date lines, the most recent day, and the order rule. "haircut 10 november 2025" reads as 10 November 2025 with "haircut" left, which quick add then passes over for want of an amount.
- **Chunk 2**: `localQuickAddProvider` takes the first date that leaves an amount and puts it on both reading kinds; `checkReading` and `chosenAmount` keep a choice's date; `QuickAddContext.lang` (the field's `loadContext(lang)`). The field refuses a reading dated after today with `quickAdd.futureDate`, in all four languages, for the AI's readings too. Provider tests: the dated lines, English on a German phone, the amount kept ("6 mai Döner", "lunch with jan 12"), a dated choice; the whole-list test now covers the parser lines with no date (two of its lines hold "today"). `entries.spec.ts`: "döner 6 yesterday" saves on 15.10.2026 (`line-date`, with a saved mutation that drops the date) and "döner 4 on 3 december 2026" is refused. The hint is unchanged.
- **Chunk 3**: weekday names in `quick-add-date.ts`, from the platform's calendar, whole words only; "last", "letzten", "letzter", "vergangenen", "vergangener" in front and "dernier", "pasado" after make the one before today. Unit tests in the four languages and for short forms; a provider test ("coffee 3 last friday"); `entries.spec.ts` adds "döner 3 last friday" on the setup day (`line-weekday`, with a saved mutation).
- **Fix, 18-11-2026 (on #307's branch):** signed in with the AI on, a dated line saved today: the AI reader never asked the local date reader, the function drops a day more than 60 days back (`QUICK_ADD_DAYS_BACK`), and the model may miss one. `readLineParts` (`quick-add-provider.ts`) is now the local reader's number words and date step, and `readingFrom` (`ai-quick-add.ts`) takes its day first, the model's only when it finds none; an AI choice keeps its day. Unit tests in `ai-quick-add.test.ts`; `ai-quick-add.spec.ts` "the day a line names is read on the phone, even one the function drops" (`ai-line-date`, with the spec's first saved mutation).
- **Live try, 18-11-2026:** as a guest in German, French and Spanish, every form tried saved on its day: a month name with a year ("am 27. November 2025", "le 27 novembre 2025", "el 27 de noviembre de 2025"), a short date ("am 12.11", "le 12/11", "el 12/11"), a weekday ("letzten Montag", "lundi dernier", "el lunes pasado") and the hints' "gestern", "hier" and "ayer". The lines are in the number-words plan's As built; English was tried in the morning's guest walk. Still owed: a dated line signed in with the AI on (Roshan).
- **Left for later:** a two-digit year after a month name.
