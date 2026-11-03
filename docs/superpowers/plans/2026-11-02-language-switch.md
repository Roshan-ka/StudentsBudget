# StudentsBudget: language switch, plan 1 (German)

> **For agentic workers:** chunks of about 1 hour, done one at a time. Each ends with lint, typecheck, unit tests (its e2e through the heavy-lane lock where it applies), a commit and a report to Roshan, who says when the next one starts.

**Goal:** the app in German as well as English, chosen per phone under Settings → Language, through a mechanism that takes more languages later (Spanish and French come in plan 2).

**Status (2026-11-02): approved; chunk 1 in progress** on `feat/i18n-chunk-1`.

## Context

Roshan wants StudentsBudget available in **German, English, Spanish and French**. He put it on hold until a plan fits it; P2.2 is now done in code, and the CI already has a `languages` option waiting.

Today every user-facing string is inline English:
- about 80 feature files;
- sentence builders in `.ts` files;
- `'en-IE'` hard-coded 24 times;
- `<html lang="en">`;
- no i18n scaffolding.

Pages are static and precached by `public/sw.js`, and there are no server routes, so the language mechanism must keep that.

**Decided with Roshan (2026-11-02):**
1. **Phone setting**, not URL prefixes. The choice is stored on the phone, the first visit follows the phone's language, and pages, links, the service worker and all existing e2e stay as they are. We accept a brief English flash of server-rendered headings on a cold start.
2. **Money and word dates follow the language:**
   - German shows `6,50 €` and "Mittwoch, 30. September";
   - English stays `€6.50`;
   - `formatDate` (DD-MM-YYYY) stays in every language.
3. **This plan delivers German.** It covers the scaffold, English moved into the new system, then German offered and tried for real. Spanish and French come in a second plan, once German has been tried.
4. **City content stays English for now.** That means tips, discounts, swaps, semester and city texts. They are marked `lang="en"` inside other languages and translated in a later step that keeps every source, URL and checked date.

The outcome:
- In Settings → Language a person picks Deutsch, and the app's own text, money and word dates switch to German. The choice is remembered on that phone.
- English behaviour and every existing test stay the same.

**First step after approval:**
- copy this plan to `docs/superpowers/plans/2026-11-02-language-switch.md` (the project's plan home);
- work on a new branch from `main`;
- run each chunk as ~1 hour, with a commit and a report.

## Design

### Built for more languages later (Roshan, 2026-11-02)

The four languages are the first users of a mechanism that takes more languages without rework. Nothing may hard-code "these four".

**One registry is the single source, `src/i18n/languages.ts`.**
```ts
export const LANGUAGES = {
  en: { locale: 'en-IE', name: 'English', dir: 'ltr' },
  de: { locale: 'de-DE', name: 'Deutsch', dir: 'ltr' },
  es: { locale: 'es-ES', name: 'Español', dir: 'ltr' },
  fr: { locale: 'fr-FR', name: 'Français', dir: 'ltr' },
} as const satisfies Record<string, LanguageInfo>;
export type Language = keyof typeof LANGUAGES;
```
Everything is derived from it:
- the `Language` type;
- the picker's options, each named in its own language;
- the head script;
- `pickLanguage`;
- the formatter locales;
- the unit-test loops;
- the e2e language loop (`E2E_LANGUAGES=all` runs every offered language).

**`OFFERED`** is a separate list of what people can pick. A language can be in the registry and be drafted before it's offered.

**The dictionaries map is `Record<Language, Messages>`.** Adding a code to the registry fails typecheck until its dictionary exists. A language still being drafted may be `{ ...en, ...partial }` while it isn't offered; offering it requires the complete form.

**Room for languages unlike these four:**
- **Plurals:** `plural()` takes every CLDR form (`zero`, `one`, `two`, `few`, `many`, `other`), with `other` as the fallback. Polish or Arabic need no new code.
- **Direction:** the registry's `dir` is set on `<html>` by the head script and the store, together with `lang`. A right-to-left language then needs layout work only, not plumbing. From this plan on, new and touched code uses logical Tailwind classes (`ms-`/`me-`, `ps-`/`pe-`, `start`/`end`). There's no app-wide refactor now.
- **Scripts:** the registry can carry a font-subset need (Geist's `latin` covers all four today). A Cyrillic or Greek language adds its subset in `layout.tsx` from the registry.
- **Typing in other languages:** quick add keeps reading through `QuickAddProvider`. A language's number words and category keywords can be added later as a per-language provider, without changing the field.
- **Width:** the nav label length test and the 375 px e2e tour loop over every offered language. A new language with long words fails there first.

**Adding a language is a checklist.** It goes into CLAUDE.md in chunk 15, and plan 2 (Spanish, French) is its first use:
1. Add a registry entry.
2. Add `messages/<code>/*`, starting as `{ ...en, ...partial }`, and translate area by area.
3. Write nav labels that pass the length test.
4. Have a native speaker read it.
5. Add the code to `OFFERED`, which drops the spread.
6. Run the language e2e with `E2E_LANGUAGES=all` and the 375 px tour.
7. Do a real try on the phone.

### Modules (new `src/i18n/`)

**`languages.ts`**
- The registry above, plus `OFFERED`: `['en']` until chunk 15, then `['en','de']`.
- `pickLanguage(stored, navigatorLanguages)`: the stored choice if offered, else the first browser language whose primary subtag is offered, else `en`.

**`store.ts`**
- A `useSyncExternalStore` store with server snapshot `'en'`, modelled on `src/lib/use-today.ts` and `src/features/account/sync-status.tsx` (`useNow`, `useOnline`).
- `setLanguage` writes localStorage key `studentsbudget-language`, notifies subscribers and sets `document.documentElement.lang`.
- The choice is per phone: not synced, not in backups.

**`use-t.ts`**
- `useLanguage()`.
- `useT()` returns `{ t, lang, locale, fmt }`.
- No context provider: every hook subscribes to the store.

**`plural.ts`**
- `plural(locale, n, { other, zero?, one?, two?, few?, many? })` uses `Intl.PluralRules`.
- A missing form falls back to `other`, so it works for any language.

**`format.ts`**
- One `Intl` instance per locale, replacing the 24 hard-coded `'en-IE'` uses.
- `fmt.list` uses `Intl.ListFormat`.

**`head-script.ts`**
- A tiny inline script in the root layout's `<head>` that sets `<html lang>` and `dir` before paint, generated from the registry and `OFFERED`.
- `suppressHydrationWarning` goes on `<html>` only.
- Check `next/script` / `beforeInteractive` in `node_modules/next/dist/docs` first. There's no CSP, so inline is allowed.

**`messages/en/<area>.ts`** and **`messages/de/<area>.ts`**
- `type Messages = typeof en`.
- A German area file is typed `Messages['area']`: a missing key fails typecheck, and an extra one fails the excess-property check.
- Interpolation is a function (`heldBack: (n) => …`), so placeholders can't be dropped.
- Dictionaries are **imported statically**: the service worker precaches only the files a page's HTML names, so a lazy `import()` would be missing offline.

### Builders and formatters

**Sentence builders in `.ts` files gain a last parameter `lang: Language = 'en'`.** Existing callers, unit tests and the MCP server stay unchanged. Examples:
- `src/sync/engine.ts`: `syncStatusText`, `syncResultText`, `heldBackText`, `syncErrorMessage`, `accountSyncStatus`;
- `src/sync/link.ts`;
- `src/features/account/auth-errors.ts`;
- `src/features/setup/draft.ts`;
- `src/features/badges/badges.ts`;
- `src/features/reveal/reveal-text.ts`;
- `src/features/check-in/week-line.ts`;
- the recurring `lines.ts` and `schedule.ts`.

**`src/lib/money.ts`**
- `formatMoney(m, c, { whole, locale = 'en-IE' })`, with the formatter cache keyed `locale:currency:whole`.
- `formatRange` places the euro sign by locale, via `formatToParts`.
- `money.ts` imports nothing from `src/i18n`, because of the MCP import rule.

**Word dates**
- English keeps its exact current labels; the `weekLabel` builder stays byte-identical.
- Other languages use whole-format options.
- `schedule.ts`'s `WEEKDAYS` becomes `Intl` weekday names.

**Plurals and lists**
- `src/sync/summary.ts` `count()` and `listed()`, plus the ~11 inline `=== 1 ?` plurals, move to `plural()` and `fmt.list`.

### English already stored in data

- **Recurring entry notes** (`post-due.ts:83` writes `categoryName`): the poster keeps writing English. When displayed, a note equal to the English name of its category shows the translated name (`entries-list.tsx`, `check-in-view.tsx`).
- **Prefilled account names** ("Local bank"…): filled in the setup-time language. Once saved, they are the person's own names.
- **Semester fee:** the offered one-off uses `t.profile.semesterFee`, and `isFee` matches the name in any language. `SEMESTER_FEE_NAME` stays English for the MCP and tests.
- **Sync problem:** `SyncState.problem` stores a code (`held:3`, `update-needed`, `failed`, …) instead of an English sentence. The field isn't indexed, so there's no `db.version(5)`. `problemText(code, lang)` shows it; an old stored sentence shows as it is until the next sync.
- **`'Estimate'`:** stays the data flag (`source === 'Estimate'`). Wherever a source is shown, the UI shows `t.common.estimate`.
- **The Dexie `categories` table:** untouched. Translating the constant would make `ensureSeeded` rewrite rows; names come from `messages/*/categories.ts` instead. A unit test checks that `en.categories` equals `CATEGORIES`' names.

### Bottom navigation at 375 px

- `t.nav` holds short labels of at most 9 characters, enforced by a unit test. German: Start · Einträge · Grafiken · Tipps · Optionen; the wording is checked in review.
- The links get `min-w-0 text-center leading-tight`, and `main` gets `hyphens-auto`, which works because of the right `lang`.

### What stays English in plan 1

- The MCP server.
- Quick-add number and category words: the parser stays as it is.
- City content, marked `lang="en"`.
- Metadata, the manifest and `public/weekly-check-in.ics`.

## Chunks (~1 h each; heavy steps through `lane.mjs`)

Every extraction chunk keeps English **byte-identical**, so unit tests and e2e stay unchanged unless the chunk says so.

1. **Scaffold (no visible change).**
   - What: `src/i18n/*` with the language registry, the head script in `src/app/layout.tsx`, and a client `page-heading.tsx` used by the `page.tsx` headings. `src/components/bottom-nav.tsx` reads `t.nav`.
   - Pin Playwright's `locale: 'en-GB'` in `playwright.config.ts` and `playwright.offline.config.ts`. Otherwise a German machine would run the English suite in German once detection exists.
   - Add the i18n rules to CLAUDE.md.
   - Tests:
     - unit tests for `pickLanguage`, the head script and `plural`;
     - a registry test: every language has a valid locale (`Intl.getCanonicalLocales`), a name and a `dir`, and every dictionary key set matches English's;
     - one full e2e run under the lock, because the root layout changes.
2. **Formatters take a locale.**
   - Files: `money.ts`, `format.ts`, `summary.ts`, `week-label.ts`, `profile.ts`, and the other `'en-IE'` / `ListFormat` sites.
   - Tests: existing tests unchanged, plus `de-DE` cases.
   - **As built (2026-11-02), narrowed to the shared core:**
     - `formatMoney`/`formatRange` (the euro sign where the locale puts it), `weekLabel`, `listed` and the cached `src/i18n/format.ts`.
     - The ~20 component and builder sites with their own `Intl` instances (charts, check-in, entries, Home, setup envelopes, rates, badges, profile, reveal) move to `format.ts` with the chunk that extracts their area, which touches them anyway.
     - English `weekLabel` and `listed` stay hand-built, so they read the same in every browser engine (the e2e checks them word for word); other locales use Intl.
3. **Extract Home, entries and categories**, plus the note display rule.
   - From this chunk on, each area joins a `react/jsx-no-literals` override in `eslint.config.mjs`.
   - **As built (2026-11-02), in two commits (3a Home and categories, 3b entries):**
     - Dictionary areas `categories`, `home`, `entries` and `common` (the date field, shared by every form that has one). `categoryNameIn(t, id)` names a category; a test keeps `en.categories` equal to `CATEGORIES`.
     - The note rule is `entryTitle` (`src/features/entries/entry-title.ts`), used by Entries and the check-in's entry rows.
     - `buildEntry` takes `lang` last; `buildTransfer`'s errors stay English until chunk 5.
     - The lint guard (`noStrings`, props not checked, `·` allowed) covers Home, entries, `src/app/entries` and `DateField`. The `.ts` files of the areas were grepped for sentences.
     - Still English inside these areas until their own chunks: setup's `rangeLine` and `budgetLine` in the suggested budget, `AmountField` and `RangeSource` (4), the transfer form (5), the swap line (9), and check-in's own rows (8).
4. **Extract setup and `draft.ts`**: validation, prefilled names, the estimate label, the semester fee.
   - **As built (2026-11-02):**
     - Dictionary areas `setup` and `profile` (only `semesterFee` so far; chunk 5 adds the rest), and `common.amountField`, `common.source` and `common.estimate` for the amount field and the source line, which other areas share.
     - `draft.ts`'s `validateStep`, `initialDraft`, `accountOptions`, `envelopesFooter`, `budgetLine` and `rangeLine` take `lang` last, with money in its locale.
     - Sentences that named a category in lowercase ("What do you think you spend on eating out…", "Eating out, going out and transport are estimates.") use `topicOf`, a per-language topic for each of the six guess categories, since German doesn't lowercase nouns.
     - `semesterFeeOffer` names its row in `lang` and treats a row named in any language as the fee. `SEMESTER_FEE_NAME` stays English, and `monthLabel` takes a locale.
     - The prefilled account names are in the language the wizard opens in.
     - Still English: `DraftScheduleFields` and `SemesterFeeSource` (chunk 5), the account link and restore section on the setup page (chunk 6), and the source text itself (city content).
5. **Extract profile, edit plan, recurring, accounts, transfer and rates.**
   - **As built (2026-11-03), in two commits (5a profile and recurring, 5b accounts, transfer and rates):**
     - Dictionary areas `profile`, `recurring` and `accounts`; `common.source.of` ("Source: …") and `common.accountOption` ("Wise (INR)") are shared.
     - `profileProblems`, `termName`, `describeTiming`, `firstAddedLine`, `describeLine`, `overBudgetLine` and `buildTransfer` take `lang` last, and `buildEntry` passes it to `buildTransfer`. `periodLabel` takes a locale.
     - Weekday names come from Intl (`weekdayName`), and `WEEKDAYS` is the days 1–7.
     - "No income yet." and "No fixed costs yet." are their own texts instead of a lowercased heading.
     - The university "Other" is named in the phone's language; `UNIVERSITIES` stays as the data and the MCP server have it. A fee part's label is sourced content and stays.
     - The rate and its ECB day use the phone's locale. Edit plan itself is the setup wizard, done in chunk 4.
6. **Extract backup and restore, `summary`, and sync** (`engine.ts`, `link.ts`, `sync-status.tsx`, `account-view.tsx`, `account-link.tsx`).
   - Problem codes are introduced here. `engine.test.ts` and `link.test.ts` change on purpose.
   - **As built (2026-11-03), in two commits (6a backup and restore, 6b sync and linking):**
     - `backup.ts`: `findProblem` returns a key, which `backup.problems` words. `checkBackupData`, `parseBackup` and `backupSummary` take `lang` last. The word typed to delete everything is the dictionary's.
     - `syncState.problem` stores a code (`update-needed`, `signed-out`, `failed`, `held:N`; `src/sync/problem.ts`), and `problemText(code, lang)` words it. A sentence an earlier version stored shows as it is until the next sync. There is no Dexie version, because the field isn't indexed.
     - Link outcomes carry data: a note (`uploaded`, or `loaded` with its `Contents`), a problem (`unfinished`, `unreadable`), and each side's holdings as `Contents` counts. `account-link.tsx` words them, along with its own `failed` and `offline`.
     - `syncStatusText`, `accountSyncStatus`, `syncResultText`, `staleSummary` and `contentsText` take `lang`. Messages that are only logged (row checks, `checkBackupData` in a download) stay English.
     - The account card in Settings and the setup page's account line are in the `account` area.
     - `account-view.tsx` (the sign-in form, the code step and the signed-in panel) moves to chunk 7: its errors come from `credentials.ts` and `auth-errors.ts`.
7. **Extract `auth-errors.ts`, two-step and passkeys**, plus `account-view.tsx`, `credentials.ts` and `security.tsx` (moved from chunk 6).
   - **As built (2026-11-03):**
     - Dictionary area `auth`.
     - `auth-errors.ts` maps each account-server code to a meaning (`BY_CODE` → `auth.errors` key), and the general fallback is found by its key, not by comparing sentences. `authErrorMessage`, `passkeysUnavailable`, `passkeySignInMessage`, `passkeySettingsMessage`, `checkCredentials` and `checkAuthenticatorCode` take `lang` last.
     - `OFFLINE_MESSAGE` is gone: the sign-in form and the passkey sign-in use `auth.offline`.
     - Sentences with the email in bold are a `before` and `after` around it.
     - The two effects that word a load error (two-step, passkeys) re-run when the language changes.
     - The lint guard covers all of `src/features/account`.
8. **Extract charts and check-in.** The MCP tests prove its output stays English.
   - **As built (2026-11-03), in two commits (8a check-in, 8b charts):**
     - Dictionary areas `checkIn` and `charts`.
     - `weekLine`, `weekTotalLine` and `notCountedNote` take `lang` last. The MCP server calls them without it, so its check-in stays English.
     - An entry's day ("Fri 16") is built from its parts in English, as `weekLabel` is, and is the locale's own short day elsewhere.
     - Charts: `amountText` and `signedAmountText` take a locale, and the month formatters are functions of the locale. `CHART_CONFIG` became `useChartConfig()`, its theme colours unchanged, so the legend's series names are translated.
     - `chartLabel(id, t)` uses `charts.shortNames` and `charts.bucket`. A test checks that every category's chart label is at most 16 characters in every language, so a long translation needs a short name.
     - The screen-reader summaries and table captions are dictionary functions; a missing note is left out of the sentence. The "<1%" of a tiny slice uses the locale's percent.
     - The lint guard covers check-in and charts, and allows the `‹`/`›` arrows.
9. **Extract badges, `reveal-text` and the tips/discounts/swaps UI chrome**, plus a helper that marks content `lang="en"`.
   - **As built (2026-11-03), in two commits (9a badges and the reveal, 9b tips, discounts and swaps):**
     - Dictionary areas `badges`, `reveal` and `tips` (tips, discounts and the swap line).
     - `badgesFrom` and `recapLine` take `lang` last; badge names and progress lines come from the dictionary. `formatDay` takes a locale.
     - `swapLineText` and `tipTag` take `lang`. `amountText` and `savingText` take an optional locale, so the MCP server stays English.
     - `contentLang(lang)` (`src/i18n/content.ts`) is `'en'` in any other language and nothing in English, so the English DOM is unchanged. It marks the tip, discount, swap and related-tip texts and a source's own text. The swap line mixes the app's words with the swap's, so it is not marked.
     - The lint guard covers badges, the reveal, tips, discounts and swaps.
10. **Language picker and German shell.**
    - What: a Language section at the top of Settings and a compact picker on setup, each option written in its own language. Dev builds also list languages not yet offered. The nav width fix.
    - Tests:
      - `e2e/language.spec.ts`: switch to Deutsch; check `html[lang=de]`, a German heading, that it survives a reload, and switching back.
      - An entry in `e2e/affected-map.json`.
      - A new `e2e/helpers/layout.ts` for the horizontal-scroll check.
    - **As built (2026-11-03):**
      - `SELECTABLE` (`selectableIn(process.env.NODE_ENV)`) is what the picker lists: `OFFERED` in production, every registry language in any other build. `pickLanguage` and `languageHeadScript` take it besides `OFFERED`: a stored choice counts when it is selectable, but the phone's own languages pick only an offered one, so a developer with a German browser is not switched to a half-translated draft.
      - `LanguagePicker` and `LanguageSection` (`src/components/language-picker.tsx`) list each language by its own name, with `lang` on each option, and mark a draft. They render nothing while only one language can be picked, so production shows nothing new until German is offered (chunk 15).
      - The German draft dictionary is `de = { ...en, shell, language }`. Its nav labels are Start, Einträge, Grafiken, Tipps and Optionen; the length test now covers every registry language.
      - Nav width: the items are `min-w-0`, centred, with a tight second line; `main` has `hyphens-auto`.
      - `e2e/language.spec.ts` covers Settings (switch, reload, back, no sideways scroll at 375 px) and setup (the options, their `lang`, the switch). It is listed under `allOnly`.
      - `account.spec.ts` and `profile.spec.ts` now skip the Language section when checking which section comes first.
11. **German, part 1:** shell, Home, entries, categories, setup.
    - **As built (2026-11-03):**
      - German for `common` (date and amount fields, sources, counts, "Schätzung"), the categories, Home, entries and setup; the frame and the picker were written in chunk 10.
      - The glossary is in `src/i18n/messages/de/index.ts`: du throughout, Umschlag, Alltagsbudget, einmalige Kosten, Umbuchung, Anfangsstand, "Automatisch hinzufügen", and calm "12 € zu viel".
      - `messages.test.ts` checks that every written German area differs from English, text by text, with functions called with sample values. A short allow-list holds what is the same in both (Name, Bank, BAföG, Plan, a bare "label: range" format, "Wise (INR)"), and a stale entry fails the test.
      - Category names respect the 16-character chart label ("Andere Einnahmen", not "Sonstige Einnahmen"). The charts area is still English, so in German its short names (Health, Transport pass, Utilities) are English until chunk 14 writes German ones.
      - Still English in German: everything from chunks 5–9 that chunks 12–14 translate, and city content.
12. **German, part 2:** profile, plan, recurring, accounts, rates, backup.
    - **As built (2026-11-03):**
      - German for `profile` (with the semester-fee hint), `recurring` (Settings → Fixkosten und Einnahmen, the setup schedule fields, the repeat fields and the line descriptions), `accounts` (with moving money and the rates) and `backup` (export, restore, delete everything, and the file problems). Edit plan lives in `setup`, so chunk 11 already wrote it.
      - Weekday names in a line's timing come from the language's locale (`weekdayName`), so "Wöchentlich am Montag" needs nothing more; a monthly line reads "Monatlich am 5.".
      - The word to type before deleting everything is LÖSCHEN in German. The e2e runs in English, so it still types DELETE.
      - The allow-list gains four that are the same in both: Name, Bank, Backup and the bare rate format "1 € = … · …".
      - Still English in German: sync, account, sign-in (chunk 13), and charts, check-in, badges, reveal, tips chrome (chunk 14).
13. **German, part 3:** sync, account, sign-in and security.
    - **As built (2026-11-03):**
      - German for `sync` (the problem codes, the status line under Sync now, what a screen reader hears after it, and linking), `account` (the Your account card and the setup line) and `auth` (the server's errors, the sign-in form, the code step, Sign-in and security, two-step sign-in and passkeys).
      - The glossary gains the sign-in words: Konto for the sign-in account too, as English uses "account" for both; anmelden and abmelden; zweistufige Anmeldung; Passkey; Authenticator-App; synchronisieren, with Synchronisierung as the heading and "Jetzt synchronisieren" as the button; verknüpfen.
      - "2 min ago" is written out ("vor 2 Minuten"), because the status line ends with a full stop and "Min.." would double it.
      - The allow-list gains three that are the same in both: "Passkeys", "Passkey" and the full stop after the bold email.
      - Still English in German: charts, check-in, badges, reveal and the tips chrome (chunk 14).
14. **German, part 4:** charts, check-in, badges, reveal, content chrome.
    - **As built (2026-11-03):**
      - German for `charts`, `checkIn`, `badges`, `reveal` and `tips` (the tips and discounts chrome and the swap line's words). Every area of `de` is now written; the `...en` spread stays until chunk 15, as planned.
      - The charts' German short names: Nebenkosten, ÖPNV-Ticket and Gesundheit (16 characters at most, `colors.test.ts`).
      - German needs "im Oktober" but "in diesen 3 Monaten", so the "nothing yet" lines say "Für Oktober …" and "Für diese 3 Monate …", and the captions put the period after a comma.
      - Badge names: Unter-Budget-Woche, Eintragsserie, Ramen-Majestät and Latte-Survivor, for the native-speaker read in chunk 15 to confirm. The check-in's away hint and the badges' intro name them too.
      - The swap line keeps the swap's own unit ("pro meal"): a swap's title and unit are city content, which stays English (chunk 9b).
      - The allow-list gains Bronze and Gold.
    - Chunks 11–14 build up `de` as `{...en, ...done}`, with a glossary (plan, envelope, check-in, one-off).
    - A unit test checks that German strings differ from English, apart from an allow-list.
15. **Offer German.**
    - What: add `de` to `OFFERED`, and drop the `...en` spread so typecheck enforces completeness. Update the CLAUDE.md "Text and layout" section (UI in English and German, formats per language) and the `scripts/ci-affected.mjs` comment. Write the "Adding a language" checklist into CLAUDE.md.
    - e2e:
      - a detection spec with `test.use({ locale: 'de-DE' })`;
      - `e2e/helpers/languages.ts` reads `E2E_LANGUAGES`: `default` runs the German switch, `all` runs a 375 px tour of every page in German;
      - an offline open in German (heavy).
    - A native-speaker read of the German before it's offered; Roshan decides who.
    - Real try on Roshan's phone via `npm run start:https`.

## Verification

- **Every chunk:**
  - `npm run lint`, `npm run typecheck`, `npm test` (light lane);
  - the affected routes' e2e through `node C:/Users/JoKu_CRITEX/.claude/lanes/lane.mjs run … -- 'npx playwright test …'` (heavy lane, prio 2).
- **Chunks 1 and 15:** the full e2e suite and `npm run test:offline` through the lock.
- **Byte-identical English:** the existing unit tests (engine, link, money, badges, draft, week-label, MCP) pass unchanged in chunks 2–9, except where a chunk says otherwise.
- **German:**
  - the language spec in Chromium and WebKit;
  - the 375 px tour (no horizontal scroll, including the nav);
  - an offline open in German;
  - a real try on the phone: switch, reload, install, offline.
- **CI:** a PR marked ready runs the quick check. A by-hand `changed` run, with `languages=all` once German is offered, covers e2e.

## Deliberately left out of plan 1

- Spanish and French. They get plan 2, the first run of the "Adding a language" checklist: the dictionaries, the nav labels and an offer step, reusing everything here. Any later language follows the same checklist.
- Right-to-left layout work. The plumbing (`dir`) is in place; the layout pass comes with the first right-to-left language.
- Translated city content; that's a later step.
- URL-based languages.
- Syncing the choice or putting it in backups.
- An "automatic" option in the picker.
- Quick-add parsing in other languages.
- MCP output in other languages.
- Translated metadata, manifest and `.ics`.
- Any date format other than DD-MM-YYYY.

## Risks

- **The English flash on a cold start:** measure it in the real try. A hide-until-hydrated rule is the follow-up if it bothers.
- **Bundle size:** all dictionaries ship in the main bundle, as offline requires.
- **German overflow outside the nav:** the 375 px tour catches it.
- **Translation tone:** calm wording applies in German too; review before offering.
- **Lint gaps:** the lint guard doesn't see `.ts` template strings, so grep each area once it's done.
