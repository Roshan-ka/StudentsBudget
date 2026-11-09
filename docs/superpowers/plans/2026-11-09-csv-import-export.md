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

## Parked (not in these chunks)

- **Group a trip's expenses** (Roshan, 09-11-2026: parked until CSV import exists).
  - **The idea:** offer to group what looks like a trip as one trip that counts against the Travel envelope: a burst of payments in another currency, or at unfamiliar merchants, within a few days.
    - The idea was first worded "while an import is reviewed". This import saves straight away with no review, so the offer would sit in the import's summary.
  - **Each entry keeps its own category,** so a dinner on the trip is still eating out in the charts.
  - **Never automatic:** the person confirms the group.
  - **Location:** bank CSVs rarely have a reliable location column. A card payment's city sometimes sits in the free-text reference, differently per bank, so location alone isn't the signal.
  - **A first step that helps sooner:** select several entries in Entries and move them to another category at once.

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

**Chunk 2 (09-11-2026): reading a statement file**

All of it is in `src/features/import/`, pure TypeScript, and nothing in the app calls it yet.
- **`decode.ts`:** the bytes are read as strict UTF-8, which also drops a BOM. Anything that isn't valid UTF-8 is read as Windows-1252.
- **`csv.ts`:**
  - `parseCsv` reads RFC 4180 (quotes, `""`, line breaks inside quotes, CRLF, LF or CR), and N26's uneven quoting;
  - `cellKey` compares header names trimmed and in any case.
- **`amounts.ts`:**
  - `parseStatementAmount` reads a signed amount in minor units. Thousands separators count only between groups of three digits. It takes a currency sign or code, a Unicode minus, a trailing minus and brackets. A third decimal counts only when it's zero, and there's never a -0.
  - `guessDecimalMark` goes by the mark before the last one or two digits.
- **`dates.ts`:**
  - `parseStatementDate` reads `dmy` with a 2- or 4-digit year (as 20YY), `ymd` with any time dropped, and `mdy` only when asked. A day that doesn't exist is refused.
  - `guessDateOrder`: year first when every date is; a part over 12 decides the rest; otherwise the expected order.
- **`profiles.ts`:** the layouts as data, with their sources in a comment.
  - `sparkasse-camt`, `sparkasse-mt940`, `dkb`, `dkb-old`, `n26`, `n26-old`, `n26-old-de` and `revolut`.
  - `dkb-visa` is recognised and refused (`UNSUPPORTED_PROFILES`).
  - `recognise(row)`: the profile whose header names are all in the row.
  - What changed from the plan's `Mapping`:
    - `amount` is `{ column }` or `{ out, in }`;
    - `payee` can be split by direction (DKB writes the payer and the payee apart);
    - `bookingText` keeps the bank's own word (`BARGELDAUSZAHLUNG`) for telling transfers apart later;
    - `kind` (top-up, cash, inside the bank) and `internalWhen` (Revolut's `Product` `Deposit`);
    - `summaryWords` (DKB's `Tagessaldo` and `Abschluss` rows are dropped).
  - A test holds every profile away from the account-number, IBAN, BIC and mandate columns.
- **`read-rows.ts`:**
  - `readRows(table, mapping)` gives `StatementRow`s: the index, the date, the signed amount with any fee taken off, the currency (or null), payee, purpose, booking text, pending and kind.
  - Rows without a readable date or amount come back as `UnreadRow`s, with their text.
  - The date order and decimal mark the values show win over the profile's, so a file a spreadsheet saved again still reads.
  - `sepaText` takes the text after `SVWZ+` (Sparkasse's MT940).
- **`statement.ts`:** added to the plan's list as the one entry point.
  - `openStatement(bytes)` finds the header within the first 20 lines with each separator, recognises the bank, and reads its rows.
  - A file it doesn't know comes back as a `Table` for the column matching: the separator with the most rows of one width wins, `;` on a tie.
  - The limits are 2 MB and 5,000 rows.
- **`fixtures.ts`:** files for every profile, written in TypeScript with made-up people and zero IBANs:
  - Sparkasse CAMT in Windows-1252, and MT940;
  - DKB with `;` and with `,`;
  - the old DKB file in ISO-8859-1;
  - N26, N26 saved again by a spreadsheet, and the old German N26 file;
  - Revolut, with a top-up, cash with a fee, an exchange, a vault move, pending, INR, reverted and a Title-case type;
  - the DKB Visa file, and an unknown CSV with money out and money in apart.
- **Tests:** 42, in six files (`decode`, `csv`, `amounts`, `dates`, `read-rows`, `statement`).
- **Left for chunk 4:** masking the card numbers and IBANs some purposes hold (`Debitk.1 2029-12`). Revolut Business has no profile: its layout is unknown, so it goes to the column matching.

**Chunk 3 (09-11-2026): categories**
- **`merchants.ts`:**
  - `fold` writes umlauts and ß out in lower case, so one pattern fits "BAföG", "BAFOEG" and "Bafög".
  - The chain list is `OUT_RULES` and `IN_RULES`, each rule a label, a whole-word pattern and a category. Order matters, narrowest first:
    - rent ("Miete", "Wohnheim") comes before the Mensa and Studierendenwerk;
    - Aldi Talk comes before Aldi, and Amazon Prime before Amazon.
  - Compared with the plan's list:
    - added: insurance (TK, AOK, Barmer, DAK), the Deutschlandticket (`transport-pass`), Flixbus, McFit, FitX and Hochschulsport (`gym`), IKEA (`household`), cinemas (`going-out`), airlines and booking sites (`travel`), and "Taschengeld" (`income-parents`);
    - left out: Müller (a common surname, so "Bäckerei Müller" would turn into personal care).
  - `chainRule(text, direction)` is the first rule that fits.
  - `merchantKey(payee, purpose)` is the name the mark keeps: folded, without numbered words or legal forms, at most two words. "REWE Markt GmbH" and "REWE SAGT DANKE 1234" are both `rewe`.
- **`categorize.ts`:** `categorize(row, history, categories)` gives the category, where it came from (`yours`, `typed`, `chain` or `fallback`) and the merchant.
  - It tries, in order:
    1. the newest imported entry of the shop whose category the student moved away from its `guess`;
    2. a typed entry of the same type whose first word is one of the row's words (as quick add learns; scheduled and imported entries don't count);
    3. the chain list;
    4. Other, or Other income.
  - Money back from a listed shop is a refund: Other income.
  - A learned category that no longer exists, or of the wrong kind, is passed over.
- **Tests:** 16 in `merchants.test.ts` and `categorize.test.ts`:
  - every rule's category exists and has the right kind;
  - spellings, and the narrower rules first;
  - whole words only;
  - a changed guess teaches, and an unchanged one never does;
  - typed entries teach;
  - money in learns only from money in;
  - refunds.

  There are 58 import tests in all.

**Chunk 4 (09-11-2026): what an import does**
- **`overlap.ts`:** `findOverlaps(rows, accountId, entries)`, the overlap rule. Matching goes by direction (an entry's movement on the account), one to one, closest dates first, within `OVERLAP_DAYS` (3). It finds:
  - entries typed by hand and posted fixed costs;
  - transfers: cash typed as a transfer to Cash, and the other half of a top-up.
- **`transfers.ts`:** `transferTarget(row, account, accounts)` gives a transfer with the other account, none, or a skip.
  - An account named as a whole word, the longest name first. Generic names (Bank, Konto, Cash, Wallet…) never count, so "Deutsche Bank" or "Cash at Sparkasse" name nothing.
  - A cash withdrawal goes to a cash account (one it names, else the only euro one), never to the bank whose machine it was. `isCashWithdrawal` reads Revolut's `ATM`, or BARGELDAUSZAHLUNG, Geldautomat, GAA, "GA NR…" and ATM in the booking text or purpose.
  - A top-up comes from the account it names, else the only other euro bank account.
  - Without such an account: `noTransferAccount`. To another currency: `otherCurrencyTransfer`.
- **`note.ts`:** added; the plan had this inside `plan-import`. `importNote` writes "payee · purpose", at most 200 characters, with these taken out:
  - IBANs (and the word);
  - card numbers (DKB's and Sparkasse's `Debitk.…`, masked numbers, Revolut's `*1234`);
  - a card payment's time stamp;
  - SEPA fields, and any run of eight digits or more.
- **`plan-import.ts`:** `planImport({ read, account, accounts, entries, categories, plan, batchId, now })` gives the drafts (`EntryInput`, the mark, the row), the skipped rows, and `openingChanges`.
  - Skips, in this order:
    - `unreadable`, `pending`;
    - `internal` (added for Revolut's exchanges and vault moves);
    - `zero`, `currency`, `future`;
    - `beforePlan` (only with a plan);
    - the transfer skips;
    - `duplicate`.
  - Payments get `categorize`'s category, kept as the mark's `guess`. Transfers get the merchant only.
  - `openingChanges` is a map per account. It covers both sides of a transfer, wider than the plan's single account, so a top-up dated before Cash or Revolut was added moves that account's start too.
- **Tests:** 22 new, in four files (`overlap`, `transfers`, `note`, `plan-import`); 80 for the import in all. They include:
  - Sparkasse's fixture to drafts;
  - the same file again, all duplicates;
  - Revolut after Sparkasse, its top-up found as the other half;
  - each Revolut row's fate;
  - before the plan and in the future;
  - the starting balances.

**Chunk 5 (09-11-2026): saving and Undo**
- **`save-import.ts`, `saveImport({ read, accountId, batchId?, now? })`:**
  - One `db.transaction('rw', …)` over entries, accounts, plan, categories and rates.
  - It reads everything again (rates through `loadRates`, inside the transaction) and runs `planImport` again.
  - It builds every entry with `buildEntry` before writing anything. For a transfer, that is on its sending account, which for money in is the other account.
  - It then runs `bulkAdd` and moves each `openingMinor` by its change.
  - It refuses `noAccount`, or `noRate` with the currency, and then nothing is written.
  - A second tap, or the same file in another tab, waits for the first transaction and finds every row already in the app.
  - On a linked phone, the outbox middleware records every write (not as automatic).
- **`undoImport({ batchId, openingChanges })`:**
  - Removes the batch's entries; the deletes go into the outbox, so the account gets tombstones at the next sync.
  - Moves each start back.
  - With none of the batch left, it changes nothing, so a second tap can't move a start twice.
- **Tests:** 9 in `save-import.test.ts` (fake-indexeddb); 89 for the import in all.
  - saved with the mark and in euros;
  - the same file again, and two taps at once, add nothing;
  - the outbox on a linked phone;
  - the start of an account added after some rows;
  - a missing rate or account writes nothing;
  - Undo keeps other entries and moves the start back, does nothing the second time, and records the deletes.

**Chunk 6 (09-11-2026): the page and the export**
- **`src/components/export-file-button.tsx`:** `ExportFileButton` and `downloadFile`, taken out of `backup-panel.tsx`.
  - It shares or downloads, and offers "Download instead" when the share sheet fails, with a status line.
  - `build` is synchronous, from data read before the tap (iOS).
  - The Backup panel uses it with its own texts; its markup is unchanged. The plan's name was `src/lib/share-file.ts`: it holds JSX, so it went into components.
- **`src/i18n/regions.ts`:** `RegionInfo.csv`, which is `{ separator: ';', decimal: ',' }` for `de`.
- **`src/features/export/entries-csv.ts`:**
  - `entriesCsv(entries, accounts, t, region)`: a BOM, CRLF, oldest first.
  - Headers from the entry form's own words (date, entry type, category, account, amount, note), plus currency and amount in EUR.
  - Types and category names in the language. A transfer's category cell is "To Cash".
  - Amounts are unsigned with no thousands separator; the EUR amount comes from `eurMinor`.
  - Fields with the separator, a quote or a line break are quoted. Text that starts like a formula gets a `'`.
  - `entriesFileName` gives `studentsbudget-entries-YYYY-MM-DD.csv`.
- **`src/features/export/export-entries.tsx`:** the "Export to a spreadsheet" card. It reads the entries and accounts before the tap, and with no entries yet it says so instead of showing the button.
- **The page:**
  - `/settings/import` (`PageHeading id="importExport"`), with its Settings row (`FileSpreadsheetIcon`, before Backup and data).
  - It joins `sw.js`'s precache list, `PAGES` and the map (`axe`, `import`, `language-tour`, `reflow`, `theme`).
- **Texts:** a new area, `importExport`, and `shell.headings.importExport`, in en, de, fr and es.
- **Tests:**
  - `entries-csv.test.ts` (4: English and German, quoting, the formula guard, no entries);
  - `e2e/import.spec.ts` (2: the row and the empty page; the download's name, BOM, `;`, decimal comma and day-first date).

**Chunk 7 (09-11-2026): importing a recognised bank's statement**
- **`src/features/import/import-statement.tsx`, `ImportStatement`:** the "Import a bank statement" card, above the export on `/settings/import`.
  - **Without a plan,** it points to setup.
  - **Picking a file:** a labelled file input (`.csv`). The bytes are read in the page's memory only (`file.arrayBuffer()`, then `openStatement`), and a newer pick wins over one still being read.
  - **A recognised bank:**
    - a `StatusLine` names it, with its rows and dates ("Sparkasse: 6 rows, 30.10.2026 to 04.11.2026");
    - "Import into" is preselected by an account named after the bank (`accountHints`), else `defaultAccount`;
    - then Import (`lg`), or "Choose another file".
  - **Anything else** gets an alert tied to the input (`aria-invalid`, `aria-describedby`): too big, empty, DKB's credit card (unsupported), or columns it doesn't know (the column matching comes in chunk 8). The same goes for a refused save (`noRate` with the currency, `noAccount`).
- **`ImportSummary`:** replaces the form, with the focus on its heading (`useFocusOnMount`).
  - It shows the entries added and how many are transfers, or "Nothing new"; each starting balance that moved; and the rows left out, grouped by reason (duplicates first), each with its date, amount and cleaned text.
  - "Undo this import" (only when something was added) calls `undoImport`. A `StatusLine` says how many entries went, and the focus returns to the file input (`useFocusAfter`).
  - "Import another file" starts over.
- **`plan-import.ts`:** a skipped row keeps its `currency` (the row's or the account's), and its text goes through `importNote`, so no card or account number reaches the screen.
- **Texts:** the `importExport` area gains `import`, `result` (`reasons` for every `SkipReason`) and a summary that names the import too, in en, de, fr and es. French and Spanish counts go through `byCount`.
- **Tests:** `e2e/import.spec.ts`, 4 more:
  - Sparkasse into the default account, with the summary (3 added, 1 a transfer; both starts moved; 3 left out), the database rows and the starts, then Undo (entries gone, starts back, the focus on the input);
  - the same file twice ("Nothing new", "Already in the app", no Undo);
  - Revolut (another currency, moves inside Revolut, pending, top-ups with no account);
  - an unknown CSV (the alert and `aria-invalid`).
