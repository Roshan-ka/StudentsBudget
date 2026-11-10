# Checklist for new students (10-11-2026)

## Context

Everything is merged. Roshan picked the **benefits checklist** from the leftover list.

It's for students new to Regensburg: what to claim and what to get done in the first weeks. Each item carries its own source, and a tick marks it done.

Most of the money side already exists as tips, with sources and translations:
- `studienstarthilfe`
- `check-wohngeld`
- `stay-on-family-insurance`
- `rundfunkbeitrag-bafoeg-exemption`
- `split-the-rundfunkbeitrag`

So the checklist is a list of short actions, and links to a tip instead of repeating its text.

## Decided (Roshan, 10-11-2026)

- **Scope:** both kinds of item:
  - **Money to claim:** BAföG and its start grant, Kindergeld, Wohngeld, the Rundfunkbeitrag exemption, family health insurance.
  - **First weeks:** Anmeldung, a bank account, health insurance for enrolment, the residence permit for students from abroad, the Rundfunkbeitrag sign-up.
- **Place:** a fourth tab on Tips: Tips, Discounts, Hacks, Checklist.
- **Ticks:** synced with the account, like discount votes: Dexie, Supabase, the backup and sync.

**My calls (open to objection):**
- **Ticks are per item.** A row holds `{ itemId, on }`; unticking deletes it, which becomes a tombstone, as a discount vote does. The last sync wins.
- **Each item says who it's for** (`everyone`, `from-abroad`, `bafoeg`, `under-25`) as a tag. Version 1 doesn't filter by it, and ticks are never hidden.
- **The city pack and the MCP server leave the checklist out** in version 1, so Ask can't cite it. Both can be added later, each with its tests.
- **"See the tip"** switches to the Tips tab and scrolls to that tip, focusing its heading.

## Chunks (about 1 h each, a draft PR each, CI on Roshan's OK)

### 1. Items and their sources
- **`src/data/checklist.ts`:** `ChecklistItem = { id, title, body, group: 'money' | 'first-weeks', who, tipId?, source, url, checked }`.
  - Each item is sourced from the official page: Stadt Regensburg, STWNO, Familienkasse, Beitragsservice, the Ausländerbehörde, the universities.
  - Items are fetched and read like the discount re-check. One the sources don't state stays out of the list, with the reason in a "left out" comment.
  - Planned items, about 11:
    - **Money:** BAföG, Studienstarthilfe, Kindergeld until 25, Wohngeld, the Rundfunkbeitrag exemption, family insurance.
    - **First weeks:** Anmeldung within two weeks, a bank account (the right to a basic account), health insurance proof for enrolment, the residence permit, the Rundfunkbeitrag (one per flat).
  - Wording stays calm and states no deadline a source doesn't give.
- **`checklist.test.ts`**, like `tips.test.ts`, plus: a `tipId` names an existing tip, ids are unique, and `who` is one of the four.

#### As built (chunk 1, 10-11-2026)

- **`src/data/checklist.ts`:** 11 items.
  - **First weeks:** register your address, health insurance for enrolment, the residence permit, a bank account, the Rundfunkbeitrag.
  - **Money:** BAföG, the study start grant, Kindergeld, family insurance, Wohngeld, the Rundfunkbeitrag exemption.
  - **Order:** `CHECKLIST_GROUPS` puts the first weeks first, since that is the order a newcomer needs them.
- **Six new sources, read on 10-11-2026:**
  - **Laws:** Bundesmeldegesetz § 17 and Zahlungskontengesetz § 31, on gesetze-im-internet.de.
  - **UR:** the health insurance proof (number H0000341, electronic only) and the International Office's residence permit page.
  - **STWNO:** the BAföG page.
  - **Familienkasse:** Kindergeld from 18.
- **The five items that lean on tips** cite the tip's page and its date (20-10-2026), since those pages weren't read again.
- **Left out** (in the file's comment):
  - **regensburg.de's own pages:** they answer automated reads with 503;
  - **OTH's enrolment page:** not read;
  - **UR's 7–14 days for registration:** the law's two weeks is cited instead.
- **Not shown anywhere yet:** nothing imports the file, so no e2e runs.

### 2. Translations
- `src/i18n/city/{de,es,fr}/checklist.ts` holds the title, body and source by id.
- `checklistIn()` goes in `src/i18n/city/index.ts`, with a `checklist` entry in `city.test.ts`'s `KINDS` and `allTexts`. Every number is kept, and French spacing applies.

### 3. The account's table
- **Migration `checklist_ticks`:** a copy of `discount_votes`'s shape and rules:
  - `user_id` cascades from `auth.users`;
  - owner-only select, insert and update on `(select auth.uid()) = user_id`, nothing for `anon`;
  - the restrictive second-step policy;
  - the `stamp_sync` trigger, so a delete is a tombstone;
  - `sync_pull` covers it the way the sync migration lists tables.
- **pgTAP** in `supabase/tests/checklist_ticks.test.sql`, alongside the cases that `user_data`, `two_step` and `account_deletion` hold for the other tables.

### 4. The phone's table and sync
- **Dexie:** `db.version(5).stores({ checklistTicks: 'itemId' })` in `src/db/db.ts`.
- **Types and checks:** a `ChecklistTick` type, and `checklistTickRow` in `src/db/schemas.ts`.
- **Backup v4:** add 4 to `READABLE_VERSIONS`, default the table to `[]`, add the ids check, and keep the demo fixture restoring.
- **Bulk:** `src/db/bulk.ts` (export, `replaceAll`).
- **Sync:**
  - `src/sync/tables.ts`: `SERVER_TABLES`, `serverRowsOf`, `dexieSync` and `dexieHome`;
  - `src/sync/rows.ts`: `ROW_CHECKS`;
  - `src/sync/download.ts`: `planDownload`;
  - `WRITE_ORDER` and `DELETE_ORDER` in `src/sync/upload.ts`.
- **Tests:** the existing sync and backup unit tests, extended with the table.
- **The CI `db` job** runs the contract tests.

### 5. The Checklist tab
- **`src/features/checklist/checklist-view.tsx`:**
  - two groups ("Money to claim", "First weeks"), each item with a checkbox;
  - the item's text with its `textLang`, its `who` tag, and `RangeSource` for its source;
  - "See the tip" where it has a `tipId`;
  - a `StatusLine` reading "4 of 11 done".
- **The tick** writes `db.checklistTicks` (put `{ itemId, on: todayIso() }`, or delete) and is read with `useLiveQuery`.
- **`tips-view.tsx`:** `VIEWS` gets `'checklist'`, and the tablist label becomes "Tips, discounts, hacks or checklist" in four languages. The remembered tab takes the new value.
- **Texts** in `src/i18n/messages/{en,de,fr,es}/`.
- **Look:** cards, a 44 px tap target on the checkbox, logical sides, and a tint by group from the existing tokens. `tokens.test.ts` gets any new colour pair.

### 6. e2e and docs
- **`e2e/checklist.spec.ts`:**
  - ticks last across a reload;
  - "See the tip" opens and focuses the tip;
  - German, with no `[lang="en"]`;
  - 375 px, with no overflow;
  - a linked phone sends a tick to the mocked account (`mockSupabaseData` keeps any table), and unticking sends a tombstone.
- **Other specs:** add `checklist` to `/tips` in `e2e/affected-map.json`, and update `discounts.spec.ts` and `tips.spec.ts` where they name the tablist.
- **Docs:** CLAUDE.md gets a Checklist rule and the new table in the sync and backup rules; the plan doc goes into `docs/superpowers/plans/2026-11-10-checklist.md`.

## Files

- **New:** `src/data/checklist.ts`, `src/i18n/city/*/checklist.ts`, `src/features/checklist/`, a migration and pgTAP file, `e2e/checklist.spec.ts`.
- **Changed:** `src/db/db.ts`, `schemas.ts`, `bulk.ts`, `src/features/backup/backup.ts`, `src/sync/{tables,rows,download,upload}.ts`, `src/features/tips/tips-view.tsx`, `src/i18n/city/index.ts`, `src/i18n/messages/*/`, and `e2e/affected-map.json`.

## Verification

- **Each chunk:** lint, typecheck and the touched unit tests locally (no heavy lane).
- **Chunks 3–4:** the `db` job in CI (`test:db` and `test:contract`) on a changed run.
- **Chunks 4–6:** a changed run reaches every spec (the backup and sync reach Settings), on Roshan's OK.
- **Real try on the live site:**
  - tick on phone A, and it shows on phone B within a minute (automatic sync);
  - a backup holds the ticks and restores them;
  - every source link opens.
- **Native read:** the German, French and Spanish texts wait for one, like the rest of the city content.
