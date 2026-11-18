# StudentsBudget: full review, 17-11-2026

## Context

Roshan asked for an independent review before the next round of work, after the redesign (up to #291). This session only finds and ranks; Roshan decides what gets fixed. This document holds findings only; no code was changed.

**How it was done:**
- Three parallel read-only code passes: logic bugs; dead code and stale docs; UI consistency and i18n.
- A guest walk on https://students-budget.vercel.app at 375 px, in English and German: start page, the four setup steps, Home, quick add, Entries, Charts, Tips, Discounts, Settings. No sign-in, no account writes. The guest data stays in the pane browser's IndexedDB only.
- The top findings re-read in the code by me. Nothing was built or run: no lint, typecheck, tests or heavy lane.

**Not covered:** signed-in journeys (sync, hacks posting, Ask, AI quick add, reminder), the map's WebGL view, the receipt scan with a real photo, offline, and French/Spanish by eye. Those need the local stack or a phone.

Severity: **high** = wrong money or data, or another person's data; **medium** = a student meets it in a normal week; **low** = polish or upkeep.
Sizes: XS < 15 min, S < 1 h, M 1–3 h, L > 3 h.

---

## 1. Bugs

### B1. A failed sign-out wipe plus a new sign-in shows the old user's data (high)
- **Where:** `src/features/account/signed-out-effects.ts:32`, `src/sync/link.ts:49-52`.
- **What:** sign-out's `wipeAfterSignOut()` fails, so the data and `syncState.userId = A` stay and the wipe is marked as owed. User B signs in in that tab: `SIGNED_IN` calls `forgetPendingWipe()`. The next start no longer finishes the wipe. `planLink` sees a link to A, A still exists, so it returns `other-account`: B can't link and sees A's entries on Home, Entries and Charts.
- **Why:** the comment on line 24 says "the link then asks what to keep"; the code blocks instead. On a shared or handed-on phone, A's money data shows to B.
- **Fix:** on `SIGNED_IN`, drop the mark only when `syncState.userId` is empty or the new user; otherwise run `finishPendingWipe()` first. Unit test in `pending-wipe`. **S.**

### B2. Weeks recorded from unsynced data when the tab is shown during startup (medium)
- **Where:** `src/components/app-init.tsx:114-127` (listeners), `:157` (`startAutoSync`), `src/features/account/auto-sync.ts:124-126`, `start-order.ts:24-39`.
- **What:** `visibilitychange`/`focus` fire before `startAutoSync()` has run; `visitAutoSync()` sees no runner and answers `unlinked`, so `inStartOrder` posts recurring entries and records last week's result without pulling first. A browser that restores tabs hidden and shows one during startup hits it.
- **Why:** week results are never rewritten, so a wrong week stays (CLAUDE.md: recorded only after `synced`, or with no link).
- **Fix:** `visitAutoSync` awaits a "runner started" promise, or visits before init are skipped. **S.**

### B3. Sign-out treats a failed outbox count as "nothing unsent" (medium)
- **Where:** `src/features/account/account-view.tsx:1012`, `db.outbox.count().catch(() => 0)`.
- **What:** if the count fails, sign-out skips the "Stay signed in / Sign out and lose them" question and wipes unsent changes.
- **Fix:** on failure, show the unsynced step with an unknown count. **XS.**

### B4. AI timeout doesn't cover the session read (medium-low)
- **Where:** `src/features/ai/call.ts:100-110`; `aiReady()` in `quick-add-field.tsx:61-69`.
- **What:** the 8 s timer only aborts `fetch`. `await deps.token()` (`getSession()`, which may refresh over the network) isn't raced, so "Reading…" can sit well past 8 s.
- **Fix:** race the token read against `controller.signal`. **S.**

### B5. Bringing back a used account isn't atomic (low)
- **Where:** `src/sync/used-accounts.ts:39-40`.
- **What:** the outbox delete and `applyFromAccount` run in two transactions. If the second fails, the phone has entries on an account row it no longer holds, which backup and Load refuse.
- **Fix:** drop the outbox keys inside the same untracked transaction. **S.**

### B6. A hung sync can write into the freshly wiped database (low)
- **Where:** `src/features/account/pending-wipe.ts:55`, `src/sync/lock.ts:17-22`, `pull.ts:57`.
- **What:** after the 10 s cap the wipe runs without the lock; a sync still running writes its next pull page into the empty database, so the signed-out phone gets old rows back with no link.
- **Fix:** a wipe generation counter that `untracked()` checks before writing. **S.**

### B7. Receipt scan: stale accounts and Cancel ignored while the engine loads (low)
- **Where:** `src/features/receipts/scan-receipt.tsx:195`; `src/features/receipts/ocr.ts:93-109`.
- **What:** the draft uses the accounts captured when the photo was picked (can be empty → "no account" on Save). Cancel during `loadOcr`/`createWorker` doesn't stop it, so a quick rescan runs two Tesseract workers on a phone.
- **Fix:** read accounts after reading; race `createWorker` against the signal and terminate on abort. **S.**

### B8. "1 weeks under budget" (low)
- **Where:** `src/i18n/messages/en/badges.ts:14`; the `weeks()` helper is on line 3. de/fr/es already use it.
- **Fix:** `${weeks(count)} under budget`. **XS.**

### B10. A label overlaps its field at 375 px (medium, seen live)
- **Where:** setup step 3 (Fixed costs), "Deutschlandticket / semester ticket" (`src/features/setup/steps/category-card.tsx`, `layout="row"`).
- **What:** "Deutschlandticket" is one long word; it runs under the € field. Longer still in German.
- **Fix:** `min-w-0` + `break-words`/`hyphens-auto` on the name, or stack the field under the name when the label is long. Check in all four languages. **S.**

**Refuted on re-read:** French "0 comptes" (`fr/accounts.ts:8`): zero accounts never reach that text, `summaries.ts:19` returns `summaryNone` first. Two live "wrong tab highlighted" and "rent not saved" moments were stale screenshots and a missed tap, not bugs.

**Checked and correct** (from the bug pass): `parseAmount`/`amountInputText` round trips, every cross-account sum on `eurMinor` (Home, charts, Ask snapshot, badges, recaps, MCP), `weeksLeftInMonth` stub weeks, `GRACE_DAYS`, recurring ids incl. `w:<Monday>`, `planForMonth`, the pull cursor written with its rows, `linkAndQueue` in one transaction, CSV amounts and overlap matching, the backup size cap, every `useSearchParams` inside `Suspense`. Live, Home's "This week: €161" after a €6 expense matched `weekToSpend` by hand.

---

## 2. Dead code and stale docs

### D0. CLAUDE.md says the map's Vercel flag is still owed; the live site shows the Map (low)
- **Where:** `CLAUDE.md:37` ("`db push`, the Vercel flag and the real try"), and the Discounts section ("in Production after the real try").
- **Seen:** https://students-budget.vercel.app/tips → Discounts has the List/Map switch, so `mapInBuild()` is on in Production.
- **Fix:** Roshan confirms whether `db push` and the real try happened; update the row. **XS.**

### D1. Anthropic-era comment in quick add (low)
- **Where:** `src/features/entries/ai-quick-add.ts:18`, "Quick add read by Claude Haiku". The model is Groq's `openai/gpt-oss-20b` since 13-11.
- **Fix:** name the model through the contract, not in prose. **XS.** No other Anthropic, Claude, Haiku or Sonnet strings remain in `src/` or `supabase/functions` outside tests.

### D2. Unused Button variant and sizes (low)
- **Where:** `src/components/ui/button.tsx:28` (`link`), `:35-42` (`xs`, `sm`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`: 24–36 px). None is used (UI pass grep), and each breaks the 44 px and no-text-link rules if someone reaches for it.
- **Fix:** delete them, so a wrong choice fails typecheck. shadcn may re-add on `shadcn add button`; note it in the file. **XS.**

### D3. A demo script broken by the Guess vs. reality removal (low)
- **Where:** `scripts/generate-demo-backups.mjs:2,30` imports and uses `GUESS_CATEGORY_IDS`, which no longer exists (now `CORE_FLEXIBLE_IDS`, `src/data/categories.ts:39`). Node stops on the import. Nothing runs it automatically; `README.md:108` and `fixtures/manual-demo/README.md` point to it.
- **Fix:** delete the script and its README lines (the fixtures it made are committed), or drop the `guesses` line and switch the import. **XS.**

### D4. Production functions only tests call (low)
- `src/features/charts/aggregate.ts:140,145` `spendingByCategory`, `incomeBySource` (one-month wrappers over the `…Over` versions).
- `src/features/entries/quick-add.ts:357` `parseQuickAdd` (CLAUDE.md forbids the field from calling it; only tests do).
- `src/features/profile/profile.ts:164` `semesterFeeDue` (its doc comment at `:186` should name `nextFee`).
- `src/features/swaps/suggest.ts:103` `swapLineText` (the UI uses `swapLineParts`).
- `src/sync/upload.ts:40` `applyUpload` (left from the old whole-account upload; tests and three `mcp/*.test.ts` use it to seed). Move to a test helper.
- **Fix:** delete or move, repointing the tests. **S together.**

### D5. Unused shadcn parts and CSS tokens (low)
- `src/components/ui/chart.tsx:116,118` `ChartTooltip`, `ChartTooltipContent` (~150 lines, never imported); `tabsListVariants` in `ui/tabs.tsx`.
- `src/app/globals.css`: the `--sidebar*` set (`:20-27`, `:99-106`, `:146-153`), `--chart-1…5` (`:28-32`, `:93-97`, `:141-145`; charts read `--cat-*`), `--radius-3xl/4xl` (`:54-55`). About 45 lines.
- With D2 (button sizes). **S together.** `tokens.test.ts` must still pass after the token removal.

### D6. Anthropic-shaped AI layer and comments (low)
- `supabase/functions/_shared/ai/model.ts:31,84-85` still speaks Anthropic's `stop_reason` (`end_turn`, `refusal`); `groq.ts:101-126` converts Groq's answers into it. Works, but it is a translation layer for a provider that is gone. Test comments say "Claude Haiku 5.5" (`src/features/ai/server/quick-add.test.ts:13,161`, `setup.test.ts:18`).
- **Fix:** name the model-neutral finish reasons in `model.ts`, drop the mapping; fix the comments with D1. **S–M.** Not urgent: no behaviour changes.

### D7. `.env.example` lists two of six build settings (low)
- **Where:** `.env.example` has only the two Supabase values; `NEXT_PUBLIC_AI`, `NEXT_PUBLIC_AI_SETUP_CHAT`, `NEXT_PUBLIC_DISCOUNT_MAP`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are set only in `e2e/helpers/supabase.ts:12-20` and on Vercel.
- **Fix:** list them, commented, with what each turns on. **XS.**

**Refuted:** "`src/features/ai/server/city-pack-build.ts` is an unused stub": it is the real builder; `scripts/write-city-pack.mjs:12` and `city-pack.test.ts:11` import it. About 130 `export`s used only in their own file (`planMonthFor`, `createFocusAfter`, `pageTitle`, `NAV_ITEMS` …) are tidying, not dead code.

**Checked, nothing to remove:** every non-test file in `src/` is imported; every path in `e2e/affected-map.json`, `skip-allow-list.json` and `e2e/mutations/*.json` exists; every e2e helper is imported; no `/ask` route, recovery-codes UI or Settings language field left; `guesses` only where CLAUDE.md keeps it; no flag hard-coded on or off. **Not covered:** proof ids in the mutation files against the specs, and an all-key i18n usage scan (de/fr/es parity is enforced by `Messages['<area>']` typing).

---

## 3. Features worth questioning

These are calls for Roshan, not bugs. Each says what it costs now and what removing or freezing it would take.

### F1. The setup chat: built, tested, and switched off (recommend: remove)
- **Evidence:** off in Production (`NEXT_PUBLIC_AI_SETUP_CHAT` unset, CLAUDE.md "AI"), and its daily limit is 0 in `20261113113428_ai_limits_groq_free.sql`. Still carried: `setup-chat-view.tsx`, `setup-chat.ts`, `chat-patch.ts` and tests, `finishSetup` in `_shared/ai/`, the contract's setup request, `setup-chat.spec.ts`, the token-budget case, the privacy-notice line, e2e build flag. Ten files reach it.
- **Why:** every prompt, contract or wizard change pays for it, and the four-step wizard already takes under two minutes (walked live).
- **Removing:** delete the view, the patch, the server branch and spec; a migration drops the `setup` kind from the allowance; the privacy notice loses its line. Git keeps it for a paid plan. **M (two chunks).**

### F2. Tips and Discounts repeat the same places (recommend: one home per fact)
- **Evidence:** the cinema (Kinos im Andreasstadel, €8 vs €9) and the Staatstheater (half price, U30 €10) appear as a tip and as a discount, each with its own source, checked date and four translations (live, both tabs).
- **Why:** the dated data refresh checks both, twice a semester.
- **Fix:** keep the deal in Discounts; the tip either goes or points to it (`discountId`, like the checklist's `tipId`). **S per pair, after a content pass.**

### F3. Hacks feed, comments, student discounts and moderation (recommend: freeze, don't grow)
- **Evidence:** three shared tables plus comments, four queues and decisions, the role matrix (`e2e-real/roles/`), the daily purge, the monkey walks, four privacy notes. For a guest, Hacks only says to sign in.
- **Why:** with few signed-in students the feed is empty, and an empty feed reads as a dead app; the moderator is one person. Upkeep is real (every migration touches the role matrix).
- **Options:** keep as is but hide the Hacks tab while the feed is empty for a guest, or park it until there are users. No removal proposed without Roshan's call. **Hiding: S.**

### F4. The `guesses` table (low, recommend: leave until the next backup version)
- **Evidence:** nothing reads or writes it since 05-11 (CLAUDE.md), yet it is in `db.ts`, `bulk.ts`, `backup.ts`, `sync/tables.ts`, `rows.ts`, `download.ts`.
- **Removing** means a Dexie version, a backup version and a migration. Cheap to keep; fold into the next change that bumps those anyway. **M, not now.**

### Kept on purpose
Badges, the checklist, the receipt scan, CSV import and the map each serve a clear student need and are already built; no change proposed. The MCP server is Roshan's learning tool, not student-facing, and costs nothing at runtime.

---

## 4. UI and UX consistency

### U1. Tinted list cards are hand-made six times, and drift (medium)
- **Where:** `entries-list.tsx:98-106`, `home/envelope-card.tsx:38-47`, `reveal-view.tsx:61-70`, `recurring-editor.tsx:299-308`, `start-view.tsx:92-100`, `setup/steps/category-card.tsx:24-33`.
- **What:** each writes `rounded-lg border-[1.5px] border-outline … shadow-offset` and its own tile: tile `bg-card/80` vs `bg-card`, `size-10` vs `size-9`, padding `p-3`/`p-3.5`/`px-3 py-2`. `components/ui/card.tsx:6` still promises a tinted variant "in chunk 4".
- **Fix:** a `tint` variant in `cardVariants` and an on-tint `RowTile`; move the six. **M.**

### U2. /settings/plan with no plan is an empty page (medium)
- **Where:** `src/features/setup/edit-plan-section.tsx:25`, `recurring-editor.tsx:420`, both `return null`.
- **What:** only the back button and heading show. Every other page has the no-plan line and Go to setup.
- **Fix:** the shared no-plan block. **XS.**

### U3. Dead-end sentences that name a Settings page with no button (medium)
- **Where:** `entries/entry-form.tsx:92` ("Add an account first, in Settings → Accounts and transfers." and nothing else on /entries/new); `home.nothingAvailable` (`i18n/messages/en/home.ts:39-41`, says "Settings → Plan", should be "Settings → Plan → Edit plan"); `setup.accountsInSettings` (`setup-wizard.tsx:221`); `recurring.pausedForNow` (`draft-schedule-fields.tsx:80`).
- **Fix:** a `LinkButton` after each; fix the wording in four languages. **S.**

### U4. The donut's legend rows are plain links (low)
- **Where:** `src/features/charts/donut.tsx:157`; the same kind of row in `chart-parts.tsx:241` uses `linkButtonClass`.
- **Fix:** `linkButtonClass('justify-start')` with a chevron. **XS.**

### U5. Empty, loading and "couldn't load" states look three ways (medium)
- **Where:** nothing while loading (Charts `:172`, Badges `:93`, Reveal `:152`, Check-in `:440`, Discounts `:183`); a bare "Loading…" (Ask `:142`, Hacks `:124,246`, Moderation `:101,118`, Reminder `:141`); no-plan and empty lines as bare muted text (Charts `:176`, Badges `:98`, Reveal `:126,156`, Check-in `:444`, Import `:186`, Hacks `:260`, Moderation `:206`), while Entries' empty state is a card with a `RowTile`. Try again exists in Hacks (`hacks-view.tsx:248`) but not Discounts (`discounts-view.tsx:180`) or comments (`hack-comments.tsx:165`).
- **Fix:** one `EmptyCard` (card, tile, line, optional button) and one rule (local data: nothing; network data: a muted `StatusLine`), written into CLAUDE.md; Try again in the two missing places. **M.**

### U6. "Edit envelopes" on the recaps opens Edit plan (low)
- **Where:** `src/features/reveal/reveal-view.tsx:136`, `reveal.adjust`. CLAUDE.md: "Edit plan" everywhere.
- **Fix:** use `setup.editPlan.link`. **XS.**

### U7. Smaller drift (low, one chunk together)
- Thin 1 px default borders: `account/passkeys.tsx:282`, `recurring/draft-schedule-fields.tsx:63` (setup's Fixed costs). **XS.**
- Hand-made notice boxes (`rounded-lg bg-accent|bg-muted px-4 py-3`, about 20, e.g. `start-view.tsx:72`, `legal-page.tsx:99`, `backup-panel.tsx:152`, `account-view.tsx:690`): a `Notice` component. **S.**
- Tips, Discounts, Hacks and Moderation tag items with a category pill, not a `RowTile`; on Tips and Discounts the pill takes the card's own tint and disappears; Checklist items are untinted. Decide the rule, then make the pill `bg-card`. **S.**
- Fixed `LEGEND_HEIGHT = 28` in `charts/bars.tsx:97,169` and `w-10` in `donut.tsx:147` hold text. **S.**
- `count === 1 ?` instead of `plural()` across en/de (`common.ts`, `sync.ts`, `import-export.ts`). Correct today for en/de, against the rule. **M, mechanical.**
- Negative amounts: Settings shows "-6 €" (hyphen, Intl's `formatMoney`), Charts "−€6" (U+2212). One signed formatter. **XS.**

**Checked and fine:** no `variant="link"` anywhere; every page one `PageHeading`, every Settings page `BackToSettings`; no left/right classes; no tap target under 44 px in use; no "failed/error/warning" wording; no raw `error.message` shown; all dates through `formatDate`.

---

## 5. Pain points as a new student (guest walk, 375 px)

### P1. The first month has no income, and charts call it overspending (high for trust)
- **Seen:** setup on Tue 17.11 with Parents €900 "Monthly on day 1", "Add it automatically" ticked by default: "First added on 01.12.2026." The hint says "It's added on its day — don't log it by hand." Charts then: "No income logged in November yet" and "Saved each month: €6 more spent than earned".
- **Texts:** `recurring.autoHint` and `recurring.firstAdded` (`src/i18n/messages/en/recurring.ts:19,58`).
- **Why:** by design a new line starts tomorrow, but nothing tells the student to log this month's money once. The hint even says not to. The first impression of Charts is a deficit that isn't real.
- **Fix:** when a schedule's first date is next month, the setup line says "This month's €900: log it once in Entries, or tick Add this month too", and the option posts this month's period on Save. Decide with Roshan; touches the recurring rule in CLAUDE.md. **M.**

### P2. Quick add's own example doesn't know its category (medium)
- **Seen:** typing the hint's example "döner 6" asks "Which category?" with Food & groceries focused; döner is Eating out.
- **Why:** `suggestCategory` (`src/features/entries/quick-add.ts:408`) learns only from the student's history, so every guest's first lines ask. A chain list already exists for the CSV import (`src/features/import/merchants.ts`).
- **Fix:** fall back to the import's `categorize` chain list plus a short food/drink word list (döner, kebab, kaffee, mensa, pizza, bäcker). Unit tests on the hint texts in all four languages. **S.**

### P3. Leaving a category question and typing again joins the lines (low-medium)
- **Seen:** after "döner 6,50" asked for a category, typing a second line appended to the first ("döner 6,50Bücher 1.200") and gave "Add an amount".
- **Fix:** select the text (or clear it) when the question shows, so a new line replaces it. **XS–S.**

### P4. A blank screen before the start page (low-medium)
- **Seen:** a first visit to `/` paints the header on an empty page for about a second, then redirects to `/start`.
- **Cause:** `src/app/page.tsx:26-31` waits for the Dexie plan read and `useAuth` (`firstRunPath` is `null` while auth loads) before `router.replace`, and renders nothing meanwhile.
- **Fix:** decide on the plan alone when no Supabase session key is in localStorage (a synchronous read), so a fresh phone redirects as soon as Dexie answers; keep the auth wait only when a session may exist. **S.**

### P5. The Ask bubble is a floating sign-in prompt for guests (low-medium)
- **Seen:** the round bubble sits over the envelope rows on every nav page; tapped, it says "Ask works through your account: sign in on this phone first."
- **Fix:** hide it for guests (`aiReady`-like check on the session), and mention Ask once on Your account. **XS.**

### P6. Discounts open on a five-sentence intro (low-medium)
- **Seen:** the intro (voting, linking, 8 weeks) plus "Sign in to see what other students confirmed" (no button) push the first discount below the fold at 375 px. Each card shows "Last confirmed 10.11.2026" and "checked 10.11.2026", the same date twice.
- **Fix:** one sentence plus a `FoldSummary` "How votes work"; a Sign in button; show "Last confirmed" only when it differs from the checked date. **S.**

### P7. Smaller notes
- Setup's first step offers "Overdrawn (below zero)" on every account: a new student rarely needs it on day one; fold it under the balance. **XS.**
- BAföG, the most common German student income, sits under the fold "Savings, BAföG or a scholarship?" in setup step 2. Worth a direct field, or naming it in the step's line. **XS–S.**
- Typing an income amount instantly expands the card with schedule fields and moves Next (layout shift under the thumb). **S.**
- Charts' "Saved each month" shows June–October at €0, months before the student used the app. Start at the setup month. **S.**
- Charts and Entries let you page into future months with Next. **XS.**
- Tips and Discounts carry the same items (Andreasstadel cinema, Staatstheater): two texts to keep checked. See F2.

---

## 6. Ranked shortlist (one-hour chunks)

Ranked by harm to a student times how cheap the fix is. Each chunk is one commit and a report, per Roshan's chunk rule.

| # | Chunk (~1 h each) | Findings | Why first |
|---|---|---|---|
| 1 | Sign-out safety | B1, B3 | the only path where one person's money data shows to another, and unsent changes lost without asking |
| 2 | Quick add that knows its own example | P2, P3 | the first thing a guest types asks a question; the chain list already exists |
| 3 | The first month's income (decide first) | P1 | Charts open on a deficit that isn't real; needs Roshan's call on posting this month |
| 4 | Small text fixes in one go | B8, U6, U4, U3 wording, negative-sign formatter | each XS, all in the dictionaries and two components |
| 5 | Dead ends and empty pages | U2, U3 buttons, B10 overlap | three places where a student gets stuck or can't read |
| 6 | Start-up order | B2, then B4 | a wrong week result is permanent; the AI wait is visible |
| 7 | Guest polish | P4 blank screen, P5 Ask bubble, P6 Discounts intro | first-visit impressions on the live site |
| 8 | Remove the setup chat, part 1 (app) | F1 | upkeep for a switched-off feature |
| 9 | Remove the setup chat, part 2 (server, migration, notice) | F1 | finishes 8 |
| 10 | Shared tinted card and empty-state card | U1, U5 | one look kept by components, not by copy-paste |

Next tier: B5–B7; one dead-code chunk (D1–D5, D7: ~1 h, nothing users see); U7; D6; the F2 content pass and the F3 decision; D0 once Roshan confirms the map's state.

---

## Verification (when chunks are built)
- Each chunk: unit tests beside the change; CI's `quick-check` on the PR; e2e only through a `changed` run Roshan starts.
- B1, B2, B3: unit tests in `src/features/account/`; B1 also an e2e case in `start.spec.ts` (sign-out with the wipe failing, then sign-in).
- UI chunks: the axe spec and the 375 px language tour (`languages: all`) in one CI run.
- P1, P2: a guest walk again on a Vercel preview, in English and German.

---

## As built (17-11-2026)

Every chunk of the shortlist and the next tier is merged, except the setup chat's removal: Roshan parked the chat instead (kept, off in every build, untested).

| Chunk | Findings | Where |
|---|---|---|
| 1 Sign-out safety | B1, B3 | #293 (`91d1fac`); B1's e2e case #296 (`095b5f4`) |
| 2 Quick add | P2, P3 | #293 (`be29ad1`) |
| 3 First month's income | P1 | #293 (`3b137f8`); the poster and the backup check took the plan's first period in #298 (`3fa58f5`) |
| 4 Small text fixes | B8, U6, U4, U3 wording, the minus sign | #293 (`ef1c9ae`); every count through `plural()`, #296 (`d47c5e7`) |
| 5 Dead ends | U2, U3 buttons, B10 | #293 (`bd047ac`) |
| 6 Start-up order | B2, B4 | #293 (`c8903b9`) |
| 7 Guest polish | P4, P5, P6 | #293 (`408df02`) |
| 8, 9 Remove the setup chat | F1 | parked instead, #293 (`e923341`) |
| 10 Shared cards | U1, U5 | #298 (`5addce7`, `0575cc3`); U5's Try again #293 (`e79e9c6`) |
| Next tier | B5–B7, U7, D6 | #294 (`9fce079`, `094a043`, `b9bc26c`); U7's minus sign #293 (`ef1c9ae`), its plurals #296, its pill rule #297 (`4fcd29d`), and its legend band (the bars' own key), the last open item, in the PR after #299 |
| Dead code and docs | D0–D5, D7 | #293 (`c41ddc2`); D0 #294 (`bc35d4f`); a type D5 left behind #299 (`0a9fbf4`) |
| Features | F2; F3 frozen; F4 | #293 (`adba59a`); #299 (`f0594c8`, `6359386`) |
| P7 notes | Overdrawn fold, BAföG field, no jump while typing | #297 (`bcf8d12`, `a69d7fd`, `48c110b`); savings history and future months kept (Roshan) |

**Guest walk on the live site** (18-11-2026, https://students-budget.vercel.app at 375 px, signed out, after #302–#304 deployed):

- **English:** start page → "Continue without an account" → setup with Local bank €500, Cash €40, Parents €800, rent €400 and the suggested envelopes.
  - **P1:** the Parents line showed "Add this month too", ticked, dated 01.11.2026. After Save, Home read "Across all accounts: €1,340" (the €800 posted), and Charts opened on €800 income and "€783 saved", with no deficit.
  - **P2:** "döner 6", quick add's own example, saved at once as Eating out, with no question.
  - **Today's changes:** "poster 3" asked with the tinted chips and icons (#303); More went, and the focus moved to Health & pharmacy; Personal showed in teal (#302) and saved the line. "kino 8 yesterday" saved as Going out, dated 17.11.2026 (#304).
- **German:** "Döner 6" saved as Essen auswärts; "Kino 8 gestern" as Ausgehen, dated 17.11.2026; "Poster" went straight to Persönliches, learned from the earlier pick; "Tasse 4" asked with the six chips and Mehr, which gave way to the other seven, focus on Gesundheit & Apotheke. Home and Grafiken read in German, Persönliches among them ("3 € über den geplanten 0 €").
- **Noted, by design:** a fixed cost never asks "Add this month too", so in the first month the rent isn't posted and "saved" reads €400 higher until it is.

Still owed from Verification: one CI run with the axe spec and `languages: all` for the UI chunks.
