# CSV statement import and CSV export (09-11-2026)

## Context

The Concept puts CSV statement import first among the later features. Roshan wants it now, together with a CSV export.

- **Import, the why:**
  - A new user catches up the month without typing every expense.
  - A regular user replaces daily logging by importing a statement every week or two, so repeat imports are normal.
  - Looking back at months before setup is not a goal: those months have no plan.
- **Export, the why:** the entries in a spreadsheet (Excel or Sheets). The JSON backup stays the full copy for moving to another phone.

## Decided

**By Roshan (09-11-2026):**
- **Banks recognised on their own:** Sparkasse, N26, DKB and Revolut.
  - Their layouts are built from the banks' public docs, with no sample files.
  - Any other CSV gets a step where the student matches the columns by hand.
- **Save straight away.** There is no review screen before saving.
  - Each row gets a category from a built-in list of big chains plus the student's own earlier choices, which win when they differ. Unclear rows go to Other.
  - After saving, a summary shows what was imported and what was skipped, with Undo for the whole import.
- **Overlap:** a row that matches an entry already in the app is skipped and listed. This covers entries typed by hand and fixed costs the app posted itself.
  - A match is the same account and amount within 3 days, in the same direction (see "Overlap goes by direction" below).
  - The same rule makes importing a file twice harmless.
- **Transfers:** a row that names another of the student's accounts in the app, or is a top-up, becomes a transfer between the two accounts.
  - Balances and spending stay right.
  - When the other account's statement is imported, its half matches that transfer and is skipped.
- **Export for spreadsheets:** entries with date, type, category, account, amount, currency, € amount and note.
- **Badges:** imported expenses count as logged, like typed ones, so an import-only student still earns Under-Budget Week, Logging Streak and Latte Survivor. Week records already saved stay as they are.
- **Balance:** a row dated before the day its account was added is imported, and the account's starting balance (`openingMinor`) moves by those rows' net in the same transaction, so today's balance stays right.
  - The summary says so.
  - Undo reverses it.

**My calls (open to objection):**
- **Overlap goes by direction, not type:**
  - money out matches an expense on the account or a transfer out of it;
  - money in matches an income or a transfer in;
  - each existing entry covers one row only, closest date first.

  So an ATM 50 € typed by hand as a transfer to Cash isn't imported again as an expense. Two real 3,50 € Mensa rows next to one typed entry import one.
- **A cash withdrawal** (Bargeldauszahlung, GAA, ATM) becomes a transfer to the student's euro cash account, as a top-up does.
- **A refund** (money in from a shop on the chain list) is saved as Other income. Balances stay right; spending isn't reduced.
- **Its own page:** Settings → Import and export (`/settings/import`), rather than more on Backup and data, which already holds Delete everything.
- **One draft PR per chunk,** as for the weekly reminder. CLAUDE.md still says one per day.
- **One statement, one account,** which the student picks.
  - It is preselected by the bank's name, else `defaultAccount`.
  - Rows in another currency than the account's are skipped and listed.
- **Read on the phone only.** The file is never uploaded or kept (the Concept: statement files are deleted after reading).
  - No data-protection note is needed, since nothing goes to a third party.
  - A linked phone syncs the new entries as usual.
  - Account numbers, IBANs and card numbers never reach a note.
- **Imported entries carry a marker,** used for Undo and for learning categories.
- **The export file follows the region's format** (Germany):
  - semicolons, a decimal comma and DD.MM.YYYY;
  - UTF-8 with a BOM, so Excel shows umlauts;
  - headers and category names in the phone's language;
  - every entry;
  - the same share or download path as the backup.

## Design

### The data model

`Entry`'s shared base in `src/db/types.ts`, so transfers have it too:

```ts
/** Set on an entry an imported statement row made; it stays when the entry is edited. */
imported?: { batchId: string; merchant: string; guess?: string };
```

- **`batchId`** identifies the import, for Undo.
- **`merchant`** is the shop name the import normalised. Learning still works after the note is edited.
- **`guess`** is the category the import gave the row. Once `categoryId` differs from it, the student chose the category, and that choice wins next time. An unchanged guess is never learned from.

What else the field needs:
- **Zod:** `imported` in `entryBase` (`src/db/schemas.ts`). It is required: `backup.ts`'s `Identical` check fails typecheck without it.
- **Kept on edit:** `buildEntry` (where it keeps `recurring`) and `buildTransfer` keep it.
- **Needs nothing else:**
  - no backup version (an optional field, like `isDefault`);
  - no Supabase migration (entries are `data jsonb`, and `ROW_CHECKS` reuses `entryRow`);
  - no Dexie version (not indexed).
- **An older phone** drops the unknown key (`z.object` isn't strict), so its copy of the entry just reads as typed.
- **Badges:** `loggedExpenseTest` (`src/features/badges/records.ts`) needs no change: an imported expense has no `recurring`, so it already counts.

### Pure modules (`src/features/import/`, each with a `.test.ts`)

- **`decode.ts`:** strips a BOM, then reads UTF-8 with `fatal: true`, falling back to windows-1252 (older Sparkasse exports).
- **`csv.ts`:**
  - RFC 4180 rows: quotes, `""`, line breaks inside quotes, CRLF;
  - the separator, guessed from the header line;
  - `findHeader()`, which looks through the first 20 lines, since DKB puts account lines above the table.
- **`amounts.ts`:** `parseStatementAmount(text, decimal)` reads `-1.234,56`, `1,234.56`, `−` and a currency mark into a signed `Minor` (a safe integer, at most 2 decimals), or null. `parseAmount` refuses all of these.
- **`dates.ts`:** `parseStatementDate(text, format)` for `DD.MM.YY`, `DD.MM.YYYY`, `YYYY-MM-DD` and `YYYY-MM-DD HH:mm:ss`, returning an `IsoDate`.
- **`profiles.ts`:** the four banks' layouts as data (below), recognised by their header names. The column matching by hand produces the same `Mapping`:

  ```ts
  type Mapping = {
    date: { column; format };
    amount: { column } | { debit; credit };
    decimal: ',' | '.';
    fee?; currency?;
    payee: string[]; purpose: string[];
    state?: { column; booked: string[] };
    kind?: { column; topUp: string[] };
  };
  type BankProfile = Mapping & { id; name; header: string[]; accountHints: string[] };
  ```

- **`read-rows.ts`:** a table and a mapping give `StatementRow`s (line, date, signed amount, currency, payee, purpose, state, top-up), or the rows it couldn't read.
- **`merchants.ts`:** the chain list, pattern → category; each target category must exist (tested).
  - Food: REWE, Lidl, Aldi, Edeka, Netto, Penny, Kaufland, Norma.
  - Personal care: dm, Rossmann, Müller.
  - Transport: RVV, DB.
  - Eating out: Mensa, Studierendenwerk, Lieferando.
  - Rent: Miete, Wohnheim (checked before Studierendenwerk).
  - Subscriptions: Spotify, Netflix.
  - Shopping: Amazon.
  - Utilities: Beitragsservice.
  - Phone: Telekom, Vodafone, O2.
  - Income: BAföG, Gehalt/Lohn, Expatrio/Fintiba, Stipendium.

  The exact category ids come from `categories.ts` when it is written.
- **`categorize.ts`:** `categorize(row, history)` tries, in order:
  1. the student's own choice: the latest imported entry with the same `merchant` whose `categoryId` differs from its `guess`, else the latest typed entry of that type whose first keyword matches (`keywordsOf`, `quick-add.ts`);
  2. the chain list;
  3. Other, or other income.
- **`transfers.ts`:** another account is meant when its name (at least 3 letters) appears as a whole word in the payee or purpose, ignoring case.
  - A top-up or cash withdrawal goes to the account it names, else to the only other euro account of the right kind.
  - A transfer to an account in another currency is skipped and listed.
- **`overlap.ts`:** the overlap rule above: by direction, one to one, within `OVERLAP_DAYS = 3`, against every entry on the account.
- **`plan-import.ts`:** `planImport({ rows, account, accounts, entries, plan, today })` returns the drafts to add, the `openingMinor` change, and the skipped rows with their reason:
  - `unreadable`;
  - `pending` (also declined or reverted);
  - `zero`;
  - `currency`;
  - `beforePlan` (before the setup month);
  - `future`;
  - `duplicate` ("already in the app");
  - `otherCurrencyTransfer`;
  - `noTransferAccount`.

  Notes are cut to 200 characters, and an IBAN, card number or mandate reference is removed from them.
- **`save-import.ts`:** one `db.transaction('rw', …)` over entries, accounts, plan and rates.
  - It reads everything again and plans again inside the transaction, so a double tap or a second tab can't save twice.
  - It converts with `toEurMinor` and `loadRates`; with a rate missing, nothing is written and the existing `noRate` text shows.
  - It runs `bulkAdd` and the `openingMinor` change.
  - The outbox middleware records it when the phone is linked.
  - `undoImport` deletes the batch (tombstones sync as usual) and reverses the opening change. It is offered in the summary right after the import.
- **`fixtures.ts`:** each bank's layout, an unknown layout and windows-1252 bytes, as TypeScript. The unit tests and `e2e/import.spec.ts` share it, because a `.csv` file matches no rule in `ci-affected.mjs` and would run every spec.

### The export (`src/features/export/entries-csv.ts`)

`entriesCsv(data, t, region)`:
- **The format:**
  - a BOM and CRLF line ends;
  - the separator and decimal mark from the region (`csv: { separator: ';', decimal: ',' }` on `REGIONS.de` in `src/i18n/regions.ts`);
  - dates through `formatDate`.
- **The columns:**
  - headers, types and category names in the phone's language;
  - amounts unsigned in the account's currency, with no thousands separator, plus the € amount from `eurMinor`;
  - for a transfer, "to Cash" in the category cell.
- **The rows:** sorted by date. A text cell starting with `= + - @` or a tab gets a `'` first, since bank text can carry a formula.
- **The file:** `studentsbudget-entries-YYYY-MM-DD.csv`.
- **Sharing it:** `src/lib/share-file.ts` takes the share and download code out of `backup-panel.tsx`, which keeps reading its snapshot before the tap (iOS).

### The page: Settings → Import and export (`/settings/import`)

1. **Pick a file:** a labelled file input taking `.csv`, up to 2 MB or 5,000 rows. A `StatusLine` says it is reading. The bytes stay in the page's memory only.
2. **The bank, or the columns:**
   - A recognised bank gets a status line: "Sparkasse: 42 rows, 01.11.2026–08.11.2026".
   - Any other file gets the column matching: `NativeSelect`s for the date, the amount (or debit and credit), the text and an optional currency, the date format, and a 3-row preview.
   - The last mapping is remembered for each header row (`studentsbudget-import-columns`, through `writePref`).
3. **The account:** preselected by the bank's name among the account names, else `defaultAccount(sortAccounts(…))`.
4. **Import:** an `lg` button.
5. **The summary** replaces the form and gets the focus on its heading (`useFocusOnMount`). It shows:
   - the entries and transfers imported;
   - the change to the starting balance;
   - the rows skipped, grouped by reason, each with its date, amount and text.
6. **Undo this import:** a `StatusLine` confirms it, and the focus returns to the file input (`useFocusAfter`).

Also on the page:
- **Export entries.**
- **Without a plan,** the page points to setup.

What the new page costs:
- a `shell.headings` entry and a row in `settings-links.tsx`;
- `PAGES`, the affected map and `public/sw.js`'s precache list;
- a new text area, `import-export.ts`, in all four languages.

The only other link is a quiet "Import a bank statement" on `/entries`, not on Home, which reaches every spec.

### The banks' layouts

None of the four banks publishes a column specification. The layouts below come from open-source parsers and their test files, plus forum posts quoting real exports, all read on 09.11.2026. The sources go into `profiles.ts` as comments.
- Columns are found by header name, never by position: N26, DKB and Revolut have each changed their layout at least once.
- The separator is sniffed from the header line.
- Any IBAN or card number left in the text is masked before a note is written.

| Bank | Recognised by | Separator, encoding | Date | Amount | Payee / text | Skipped as pending | Confidence |
|---|---|---|---|---|---|---|---|
| **Sparkasse**, CSV-CAMT V2 and CSV-MT940 | line 1 starts `"Auftragskonto";"Buchungstag";"Valutadatum"` (`Kontonummer/IBAN` = CAMT, `BLZ` = MT940) | `;`, all fields quoted, Windows-1252 | `Buchungstag` (`Valutadatum` if empty), `DD.MM.YY` or `.YYYY` | `Betrag`, signed, decimal comma; `Waehrung` | `Beguenstigter/Zahlungspflichtiger`; `Verwendungszweck` (MT940: the text after `SVWZ+`) | `Info` = `Umsatz vorgemerkt` | high (V2), medium (MT940) |
| **DKB**, since late 2023 | a header with `Zahlungspflichtige*r` and `Zahlungsempfänger*in`, after about 4 account lines | `;`, or `,` since about 09-2024; UTF-8, maybe a BOM | `Buchungsdatum`, `DD.MM.YY` | `Betrag (€)`, signed, `-10,22 €` (strip € and `.`) | `Umsatztyp` Ausgang → `Zahlungsempfänger*in`, Eingang → `Zahlungspflichtige*r`; `Verwendungszweck` (strip the card's `Debitk.` number) | `Status` other than `Gebucht` (probably `Vorgemerkt`, unconfirmed) | high (header) |
| **DKB**, before 2023 (archived files) | line 1 starts `"Kontonummer:"`; header `"Buchungstag";…;"Betrag (EUR)";` with a trailing `;` | `;`, ISO-8859-1 | `Buchungstag`, `DD.MM.YYYY` | `Betrag (EUR)`, decimal comma | `Auftraggeber / Begünstigter`; `Verwendungszweck` | (skip `Abschluss` rows) | medium |
| **N26** | `Booking Date`, `Partner Iban`, `Amount (EUR)` (older: `Date`, `Payee`, `Transaction type`, also in German) | `,`, quoting uneven; UTF-8 | `Booking Date`, `YYYY-MM-DD` | `Amount (EUR)`, signed, decimal dot | `Partner Name`; `Payment Reference` | (not documented) | high (header), low (Spaces) |
| **Revolut**, personal | line 1 is `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance` | `,`, UTF-8, maybe a BOM | `Completed Date` (`YYYY-MM-DD HH:MM:SS`) | `Amount` − `Fee`, signed, decimal dot; `Currency` per row | `Description` | `State` not `COMPLETED` (pending, reverted, declined) | high (header), medium (fee sign) |

Rules these layouts add to the design:
- **Never stored:**
  - Sparkasse: `Auftragskonto`, `Kontonummer/IBAN`, `Kontonummer`, `BIC`, `BLZ`, `Glaeubiger ID`, `Mandatsreferenz` and the reference columns;
  - DKB: `IBAN`, `Gläubiger-ID`, `Mandatsreferenz`, `Kundenreferenz`, and the IBAN in its account lines;
  - N26: `Partner Iban` (older: `Account number`).

  `read-rows` never reads them.
- **Top-ups:**
  - Revolut's `Type` (normalised to upper case, spaces to `_`) is `TOPUP` for a top-up and `ATM` for a cash withdrawal. `EXCHANGE`, and pocket or vault moves (`Product` `Deposit`, "To pocket …"), are skipped as moves inside Revolut.
  - At the other banks, the row's text decides ("Revolut", "Bargeldauszahlung", "GAA", an account's name).
- **Not supported:** the DKB Visa card and Revolut Business files are recognised and refused with a clear line ("This export isn't supported yet"). Any other CSV goes to the column matching.
- **No transaction ids** in any of the four: the overlap rule is what makes a file imported twice harmless.

## Chunks (about 1 h each, a draft PR each, CI on Roshan's OK, Roshan merges)

| # | Work | Tests | CI if run by hand |
|---|---|---|---|
| 1 | This plan into `docs/superpowers/plans/2026-11-09-csv-import-export.md`; CLAUDE.md (the plan's link, a "CSV import and export" rule); `imported` in types and schemas, kept by `buildEntry` and `buildTransfer`; a comment in `backup.ts` | schema keeps and older-style drops; backup round trip; build-entry and transfer keep the marker | every spec (types reach the layout) |
| 2 | `decode`, `csv`, `amounts`, `dates`, `profiles`, `read-rows`, `fixtures` | unit | checks only |
| 3 | `merchants`, `categorize` | unit: a learned choice wins, an unchanged guess is ignored | checks only |
| 4 | `overlap`, `transfers`, `plan-import` (with the opening change) | unit: a file imported again skips every row; top-up; cash withdrawal; pending; other currency; before plan; before the account | checks only |
| 5 | `save-import`, `undoImport` | fake-indexeddb: outbox when linked, a second save adds nothing, Undo's tombstones and opening | checks only |
| 6 | The page and its Settings row; `share-file` out of the Backup panel; the export; `regions.ts`; texts in four languages; `PAGES`, map, `sw.js` | `entries-csv` unit; `import.spec.ts`: the export's download (BOM, `;`) | every spec + offline |
| 7 | Import for a recognised bank, the summary, Undo | spec: Sparkasse, then the same file again (all already in the app), then Undo; Revolut rows in another currency listed | every spec |
| 8 | Column matching by hand, remembered per header | spec: an unknown CSV | every spec |
| 9 | The `/entries` link; CLAUDE.md finished; a `languages=all` run on Roshan's OK; the real try with his own statements (iPhone Files, Android) | `entries.spec` | `/entries` specs |

Chunks 2–5 are pure TypeScript with unit tests, and run nothing heavy. Every chunk with words writes all four languages, since de, fr and es have no English underneath.

## Risks

- **Exchange rates:** `eurMinor` uses today's rate, as typed entries do. A row in another currency than the account's is skipped.
- **A changed fixed cost:** a fixed cost whose amount changed, or a booking more than 3 days off, imports twice. The summary shows it, and `OVERLAP_DAYS` is tuned after the real try.
- **Week records:** a week is recorded from the Wednesday after it ends, so an import every two weeks arrives after the first week was recorded. That week's badge chance is lost; past records aren't rewritten.
- **Two phones:** importing the same statement on two phones before syncing duplicates it, because the ids are new.
- **Bank layouts from public docs:** they may be out of date. The real try with Roshan's own exports is the check, and a wrong layout is a data fix in `profiles.ts`.

## Before chunk 1 (done, 09-11-2026)

- Main's two failing tests (run 390) were fixed in #145; #146 and #147 were settled with it.
- The merged branches `feat/reminder-4`, `feat/reminder-5` and `fix/e2e-calendar-and-empty-restore` were deleted on both remotes, and SupportRW's `main` caught up.
- `feat/calendar-month-year`, `feat/date-field` and `fix/count-whole-setup-month` still wait for Roshan: they belong to the redesign session's worktree and the separate `StudentsBudget-month` worktree.

## Verification

- **Each chunk, locally:** lint, typecheck and the touched unit tests.
- **In CI, on Roshan's OK:** a changed run for chunks 1 and 6–9, and a `languages=all` run at the end.
- **The real try:** Roshan's own Sparkasse, N26, DKB or Revolut export on the phone.
  - It imports with the right count, categories and transfers.
  - Importing it again adds nothing.
  - Undo removes it.
  - The export opens in Excel with umlauts and amounts right.

## As built

**Chunk 1 (09-11-2026):**
- `ImportMark` in `src/db/types.ts` (`batchId`, `merchant`, an optional `guess`) and an optional `imported` on every entry. `entryBase` in `src/db/schemas.ts` checks it: a batch id, a text, an optional category id.
- `buildEntry` keeps it through any edit, a change to a transfer included; `buildTransfer` keeps it too.
- `backup.ts` notes it with `isDefault`. There is no version bump, Dexie version or migration, as planned.
- Tests:
  - `build-entry.test.ts`: kept when recategorised, kept when turned into a transfer, none on a new entry.
  - `transfer.test.ts`: kept on a transfer's edit, none without.
  - `backup.test.ts`: a round trip with and without the mark; a mark without its batch is incomplete.
- `CLAUDE.md`: the plan's link and a "CSV import and export" rule.
