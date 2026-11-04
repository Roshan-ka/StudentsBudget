# P2.6: shared discount confirmations

## Context

The Concept's §11 ("Discounts in my city", P2) says "still works" and "doesn't work anymore" become shared, so the list reads "Last confirmed 3 days ago · 14 confirmations this semester" and an entry nobody has confirmed for 8 weeks sinks. Today (P1.2) each phone keeps its own votes; a linked phone already syncs them into its account (`discount_votes`), but only their owner can read them. This is the first community step of P2, and what the AI phase will later cite.

Roshan approved it as the next feature on 04-11-2026, after Change password. Claude's choices are below, to check before approving.

## Claude's choices (to check)

- **No new table.** The votes are already in the accounts, one row per discount per person. A new database function, `discount_confirmations()`, returns only totals per discount: the last "still works" date, the "still works" count this semester and the "doesn't work anymore" count. No user ids and no single votes, so row-level security stays owner-only and nobody sees who voted.
- **Who counts:** phones linked to an account, once they have synced. Votes on a phone that isn't linked stay on it, as now.
- **Who sees the totals:** a signed-in phone, when the Discounts list opens (one read). Signed out or offline, the list works as today, from this phone's own votes, with one quiet line: "Sign in to see what other students confirmed."
- **"This semester":** the University of Regensburg semester the day falls in (`semesterOn('ur', today)`), or the profile's university when it is set.
- **Freshness:**
  - "Last confirmed" is the latest of the source's check, your own "still works" and anyone's.
  - The 8-week rule (`STALE_AFTER_DAYS`) then works as today.
  - Your own "doesn't work anymore" still sinks the entry for you.
  - Other people's "doesn't work anymore" is shown as a count, and doesn't move the list (v1: no majority rule).
- **Wording:** "Last confirmed 3 days ago · 14 confirmations this semester", plus "2 said it no longer works" when there are any. Counts go through `plural()` in all four languages.

## What exists (verified)

- **`src/features/discounts/discounts.ts`:** `freshness(d, vote, today)`, `sortByFreshness`, `voteMove`, `STALE_AFTER_DAYS = 56`, and the `DiscountSource` interface.
- **`discounts-view.tsx`:** `useLiveQuery` on `db.discountVotes`, and `choose()` writes a vote.
- **The votes in the account:**
  - `DiscountVote = { discountId, vote: 'works' | 'outdated', on }`;
  - synced as `discount_votes`, one row per discount id (`src/sync/tables.ts`), under owner-only RLS (`20261023121726_user_data.sql`).
- **`src/features/profile/profile.ts`:** `semesterOn(university, date)`.
- **Texts:** `tips.ts` holds `lastConfirmed(date)`, `mayBeOutdated` and `markedOutdated(date)`.

## Design

**Server (a new migration `discount_confirmations`):**
- `public.discount_confirmations(p_since date)` (`security definer`, `search_path = ''`, `stable`, for `authenticated` only).
- Per discount id, over every live vote row (tombstones left out):
  - `last_works`: the latest "still works" date, a future date counted as today;
  - `works_since` and `outdated_since`: the counts of each vote dated on or after `p_since`.
- A row whose `on` isn't a date is skipped rather than failing the call.
- **pgTAP:**
  - totals over two users' votes;
  - tombstones and malformed dates ignored;
  - `anon` refused;
  - nothing but totals returned.

**App:**
- **`src/features/discounts/community.ts`:** `CommunityConfirmations` (a map by discount id) and `readCommunity(supabase, since)`. Null when it fails, and the list then shows only this phone's votes.
- **`freshness()` takes an optional community entry:** "last confirmed" also counts its `last_works`. `sortByFreshness` passes the entries through. Both get unit tests.
- **`discounts-view.tsx`:** read the totals in an effect when signed in, then the count lines and the signed-out line.
- **Texts** in en, de, fr and es.

**Tests:**
- the contract test (two users vote, a third reads the totals);
- unit tests for the merged freshness;
- one mocked e2e: a signed-in phone sees the counts, a signed-out one sees the line.

## Chunks

Each is about an hour: lint, typecheck, the touched unit tests; the full suite, pgTAP and e2e run in CI on Roshan's OK.

1. **Server:** the migration, pgTAP and the contract test.
   - **As built (2026-11-04):**
     - **`20261104142424_discount_confirmations.sql`:**
       - `public.discount_confirmations(p_since date)` returns `(discount_id, last_works, works_since, outdated_since)`. It is plain SQL, `security definer` (the tables don't force row-level security, so their owner reads every account's votes), and for `authenticated` only.
       - A vote's day goes through `private.date_or_null`, a plpgsql helper nobody else may call: text that isn't `YYYY-MM-DD`, or isn't a real date, is skipped instead of failing every caller.
       - A day after today counts as today, as `freshness()` does on the phone.
     - **`supabase/tests/discount_confirmations.test.sql`** (8 checks):
       - who may call it, and that the helper isn't callable;
       - the result type is totals only;
       - the counts across two voters, with tombstones and a bad date left out;
       - the latest "still works", a future day as today, and none for a discount only marked as not working.
     - **`src/features/discounts/discount-confirmations.contract.test.ts`** (2 tests):
       - two accounts vote through the app's store and a third reads the totals, still seeing none of their rows;
       - a signed-out client is refused.
2. **The list:** `community.ts`, the merged freshness, the view, texts, the mock and the spec, plus CLAUDE.md (a new outgoing request: the totals, read when the Discounts list opens while signed in). Before merging, Roshan runs `npx supabase db push`.

## Left out

- A majority rule that sinks an entry other people marked as not working.
- "By a verified student", which waits for the verified badge.
- Adding new discounts from the app, and the discount map.
- The MCP server's `find_discounts` stays on the seeded list.
