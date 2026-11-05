# Pain points: a calmer Home, Settings in pages, charts that always show

## Context

Roshan finds Home annoying: whenever he opens it, the suggested budget is open, and it is long. Two read-only audits on 05-11-2026 found the cause and more of the same kind.

**The suggested budget:**
- It opens by itself on days 1–7 and whenever the envelopes add up to more than is available (`suggestionIsProminent`, `src/features/home/suggest-budget.ts:179`).
- "Not now" lives only in React state (`suggested-budget.tsx:95`), so it comes back on every reload or cold start.
- The open form is 12 rows of inputs, about three phone screens.

**Elsewhere:**
- Settings is one page of 10 sections, 5–6 screens long, and the account balances start about 2,400 px down.
- Charts show only "Nothing logged in October yet" until something is logged.
- The entry form forgets category and account.
- Edit plan makes you walk all 5 steps to save.
- Charts styles and the Tips tab reset on a cold start.
- Home's check-in, badges and guesses cards repeat the same lines on every visit.

**Roshan's decisions (05-11-2026):**
- The suggested budget is hidden until clicked.
- Settings becomes a short page of categories, each opening its own page ("very cluttered and confusing").
- Charts show even when nothing is logged.
- One round of mockups comes first.
- All the pain points go into this plan, in chunks of about an hour.
- The phone tries (redesign, mic, P2.2 sync, account deletion) are left out for now, with a reminder.

## How every chunk works

- **Per phone, one helper:** a small `src/lib/phone-pref.ts` (get and set in try/catch, plus a `useSyncExternalStore` hook) follows `src/theme/store.ts` and `src/features/entries/mic-note.ts`.
  - Its keys live in localStorage, per phone: not synced, not backed up. CLAUDE.md lists them.
  - Storage that can't be read falls back to today's default.
- **New words** go into en, de, fr and es. Designed and checked in German first, then English. Calm wording.
- **Each chunk is its own PR from `main`:** lint, typecheck, the touched unit tests, the specs it changes, and an As-built note. A ready PR runs its quick check; Roshan starts any e2e run in CI. Claude names the options to use.
- **A new route** gets its entry in `e2e/affected-map.json`, and joins `PAGES` in `e2e/helpers/pages.ts`, so `reflow`, `theme` and `language-tour` visit it.

## Settings as pages

`/settings` becomes a hub. The language picker stays first, since CLAUDE.md wants someone who can't read the current language to find theirs there. Under it, one row per category: an outlined card row with an icon, the name, a one-line summary of what is set, and a chevron.

| Row | Page | Holds | Summary line |
|---|---|---|---|
| Accounts | `/settings/accounts` | the accounts list and Add, Transfer, and exchange rates (only when an account isn't in euros) | "3 accounts · €1,240" |
| Plan | `/settings/plan` | Edit plan (to setup in edit mode), fixed costs and income | "Rent €350 · 2 incomes" |
| Profile | `/settings/profile` | the profile form | "Jo · UR · WiSe 2026/27" |
| Appearance | `/settings/appearance` | Light, Dark, Same as phone | "Light" |
| Your account | `/settings/account` (exists) | sign-in, security, delete | "Signed in as …" or "Not signed in" |
| Backup and data | `/settings/backup` | Export (open); Restore and Delete everything folded | "Last export: never" or the date |

- **Each sub-page:**
  - a back link "‹ Settings";
  - its own page heading (h2), the bottom nav's Settings item active (`aria-current`).
  - The sections move as they are; no feature changes.
- **CLAUDE.md:** the Settings → Appearance and Settings → Your account wording follows the new pages.

## Chunks

0. **Mockups (one round, 375 px, light).** Roshan approves before chunk 1.
   - Home on day 3, mid-month and on a Sunday.
   - The Settings hub and the Accounts and Plan pages.
   - Charts for a month with nothing logged.
   - The entry form with "Save and add another".
1. **Suggested budget hidden until clicked.**
   - `SuggestedBudget` starts closed every time: `expanded` defaults to false, and `suggestionIsProminent` no longer opens it. Whatever else uses it stays.
   - The "See a suggested budget" link stays below the envelopes; its tap opens the form.
   - In the open form, rows at €0 sit behind "More categories", like the More chip in quick add.
   - `home.spec.ts`'s prominence tests become "opens only on tap".
   - **As built (2026-11-05):**
     - `shown` starts false on every mount. `suggestionIsProminent` and its tests are gone, since nothing else used them.
     - Opening it again on a new day, after a reload, or in a new month (Home keys it by month) still shows only the link.
     - A row folds when the suggestion puts it at €0 and it hasn't been typed into. The fold happens only while another row has an amount, so with nothing available every row stays out.
     - The fold's chip is "More categories" ("Weitere Kategorien", "Plus de catégories", "Más categorías"), with the chevron Tips' More chip has.
     - `home.spec.ts`: five tests follow, one of them now reopening the same day to prove it stays put away.
2. **Home's quieter cards.**
   - **Check-in:** a single compact line Monday to Saturday; Sunday keeps the yellow card (`check-in-card.tsx`).
   - **Badges:** one row, e.g. "Badges · 2 of 4 · Next: …" (`badges-card.tsx`).
   - **Guesses:** only from the unlock day until `/reveal` has been opened, remembered per phone.
   - **Swap lines:** at most one "Try this" on Home, for the envelope furthest over (`envelope-list.tsx`).
   - **As built (2026-11-05):**
     - **Check-in:** a plain link row on weekdays (icon, "Weekly check-in", the Sunday line, chevron). Sunday keeps the accent card. Words and link name are unchanged.
     - **Badges:** one row: the h2 inline, "2 of 4 earned · Next: …", and "See all badges". The next badge's progress line moved off Home; the Badges page has it.
     - **Guesses: changed from the plan.** It stays as one quiet line, before and after the unlock, instead of hiding after the first visit. It is the only way to `/reveal`, and the reveal also holds the month-by-month recaps (from the first finished month, even before the unlock). Hiding it would have locked people out. No per-phone flag was needed, so `phone-pref` waits for chunk 6.
     - **Swap lines:** `furthestOver(suggestions, rows)` (`src/features/swaps/suggest.ts`, with tests) picks the row furthest over its plan, the first on a tie. The check-in still lists every swap.
     - The three lines sit in one group under the suggested budget's link (`home.tsx`).
3. **Settings hub, Accounts and Backup pages.**
   - **The hub:** `src/app/settings/page.tsx` with the rows, each summary built by a pure helper with tests.
   - **Accounts page:** `AccountsPanel`, `TransferForm` and `RatesPanel`, the last only with a foreign-currency account.
   - **Backup page:** `BackupPanel`, with Restore and Delete everything in collapsed sections.
   - **Specs:** those that open these sections on `/settings` go to the new pages (`accounts`, `backup`, `overdrawn`, `rates`, `demo-backup`, …), plus the map and `PAGES`.
   - **As built (2026-11-05):**
     - **Names:** the pages are "Accounts and transfers" and "Backup and data" ("Konten und Umbuchungen", "Backup und Daten"). The panels keep their own h3 ("Accounts", "Backup"), so no heading shares a name.
     - **The list:** `SettingsLinks` sits under the language picker, a card of link rows (icon, name, summary, chevron). The Accounts summary is `accountsSummary`: "2 accounts · €1,220", "No accounts yet", or a dash when nothing converts, as Home. Until chunk 4 the other sections stay on `/settings` below the list.
     - **Changed from the plan:**
       - Backup's summary is a fixed line ("Export, restore or delete the data on this phone"): nothing records when a backup was last exported, and adding that is new data.
       - Restore and Delete everything stay open. On their own page the three parts read fine, and folds would only add taps.
     - **Rates** render nothing while every account is in euros. Its empty-state text is gone from the four dictionaries.
     - **`BackToSettings`** is "Back to Settings", not "Settings", so it never shares a link name with the bottom nav.
     - **Specs:**
       - `accounts`, `overdrawn`, `home`, `entries` and `insecure-origin` open `/settings/accounts`; `backup` opens `/settings/backup`; `profile` goes there to export.
       - The map lists both routes; `overdrawn` and `insecure-origin` leave `allOnly`.
       - `PAGES` has both, so `reflow`, `theme` and `language-tour` visit them.
4. **Plan, Profile and Appearance pages, and the Your account row.**
   - Edit plan and the fixed costs editor on `/settings/plan`, and `ProfileSection` and `AppearanceSection` on their own pages.
   - The account card on the hub becomes its row.
   - **Specs:** `recurring`, `profile`, `account`, `theme`, `setup` (Edit plan) and the rest that open them follow. `account.spec.ts` and `profile.spec.ts`'s order checks become checks of the hub's rows.
   - **As built (2026-11-05, stacked on chunk 3):**
     - **`/settings`** is now only the language picker and the list: Accounts and transfers, Plan, Profile, Appearance, Your account, Backup and data.
     - **Plan:** the row and `/settings/plan` show once a plan exists, with a fixed line ("Income, fixed costs and envelopes"). Edit plan's text no longer says "Accounts are below", in all four languages.
     - **No repeated headings:** `PageHeading` takes an `htmlId`, and the Plan, Profile and Appearance sections lost their own h3 and are named by the page's heading. Their regions keep the same names, so specs that look up `region 'Appearance'` or `region 'Profile'` still work.
     - **Profile's summary:** `profileSummary` gives the name and the university, or "Not filled in yet". Appearance's summary is the chosen theme, with its icon.
     - **Your account:** the card became the row, carrying the sign-in status and, while linked, the sync status. `account-section.tsx` is gone; `/settings/account` gained Back to Settings.
     - **Specs:**
       - `account`, `linking` and `two-step` use the Your account row.
       - `profile`, `linking` and `two-step` go to `/settings/profile`.
       - `recurring` and `setup` reach the Plan page (by its row or URL), and `theme` goes to `/settings/appearance`.
       - The map has the three routes; `recurring` leaves `allOnly`. `PAGES` has them.
5. **Charts always shown.**
   - With nothing logged, the period still shows every section (`charts-view.tsx:126-139`), with "Nothing logged in October yet" as a line above them.
   - **Spending:** bars and table list each planned envelope at €0 spent. The donut draws its empty ring with "€0 of €X planned".
   - **Income:** sources at €0, or its line "No income logged".
   - **Savings and over time:** their months at €0.
   - Nothing is invented: €0 is what was logged.
   - `charts.spec.ts` changes from "nothing" to "the charts at €0".
6. **The entry form remembers.**
   - Last category and account per type, per phone (`entry-form.tsx:56,68,71`).
   - The category select in groups (flexible, fixed, one-off), as `recurring-editor.tsx:144-161` does.
   - "Save and add another" keeps the form open with the date, category and account.
   - After Save, back to where the person came from (`?back=/check-in`, else Entries): `src/app/entries/new/page.tsx` and the check-in's "add an earlier one".
   - **As built (2026-11-05):**
     - **`phone-pref.ts`** has `readPref` and `writePref` in try/catch, with tests. No hook: the form reads it while rendering, after the accounts have loaded, so never during the prerender.
     - **`last-choice.ts`:** `lastChoiceIn` and `withLastChoice` (tested) keep `{ categoryId, accountId }` per type under `studentsbudget-entry-form`. Saving a new expense or income remembers it; editing an entry doesn't. A deleted account or an unknown category falls back to the default.
     - **Groups:** the expense list has three optgroups, Envelopes, Fixed costs and One-off costs ("Umschläge", "Fixkosten", "Einmalige Kosten"). Income stays one list.
     - **"Save and add another":** a second submit button (`value="another"`, read from the submitter) clears the amount and note, keeps the date, category and account, says "Saved. Add the next one." and puts the cursor back in Amount. It doesn't show when editing.
     - **Back:** `/entries/new?from=check-in` returns to `/check-in`; anything else goes to the entries of the entry's month. Only that one value is read, so the query can't send the person anywhere else. The page reads search params, so it renders inside `Suspense`.
     - **Specs:** `check-in.spec.ts` follows the check-in's link and lands back on `/check-in`. The `entries` specs pass as they are: each test starts with fresh storage, and none checks a default after a save.
7. **Edit plan saves from any step.**
   - In edit mode, Save shows on every step. `save()` already checks every step and jumps to the one with a problem (`setup-wizard.tsx:99-105`).
   - `?step=envelopes` opens that step, and Reveal's Adjust goes there (`reveal-view.tsx:87`).
   - In edit mode, each envelope's range and source fold into one "Where these come from" (`envelopes.tsx:133-157`).
8. **Remembered choices, check-in and badges.**
   - **Remembered per phone:** the charts' period and each chart's style (`charts-view.tsx:87-89`, `sections.tsx`), and the Tips/Discounts tab (`tips-view.tsx:30`).
   - **Check-in:** "Add what you forgot" moves up, under the envelope summary (`check-in-view.tsx:247-269`).
   - **Badges:** the intro and each badge's rule go into one collapsed "How badges work" (`badges-view.tsx:74,96`).

## Verification

- **Unit tests:** `phone-pref` (default when storage throws, stored value, unknown value), the hub's summary helpers, the one swap line chosen, and the charts' €0 rows.
- **e2e, per chunk:** the specs for its pages are updated and named in the PR. Hidden pages stay mounted, so specs use `getByRole` with exact names.
- **Each chunk:** its quick check; screens at 375 px in German and English shown to Roshan in the session.
- **At the end:** Roshan's full run (scope `full`, browsers `all`, languages `all`); `reflow`, `theme` and `language-tour` cover every new page at 200 % text, in dark and in every language.
- **Done when:**
  - Home opens to the number, quick add and the envelopes, with nothing opening by itself.
  - Settings fits on one screen, and every category is one tap away.
  - A month with nothing logged still shows its charts.
  - A second spend in the entry form needs no re-picking.
