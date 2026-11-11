# Community: comments on hacks and discounts added from the app (11-11-2026)

## Context

Roshan picked the community features from the leftover list, without the badges for now. The hacks feed (`docs/superpowers/plans/2026-11-05-hacks-feed.md`) put comments off ("No comments for now"). The Concept (§11) says students can add discount entries themselves. Today the Discounts list is only the 17 hand-seeded, sourced items in `src/data/discounts.ts`, behind a `DiscountSource` interface written for "a server later".

Both features are shared content, like the hacks feed. They reuse its building blocks (migration `20261105110007_hacks.sql`, `src/features/hacks/`):
- the posting name (`public_profiles`, hint `needs-username`);
- `private.acting_user()` (signed in, and the second step given where the account has one);
- the 24-hour rate limit (hint `daily-limit`);
- reports that hide an item for the reporter at once, and for everyone at `private.hide_after_reports()` (5), with the moderator's keep;
- owner-select RLS with the second-step policy, writes only through security-definer functions, and reads through functions that never return a user id;
- the e2e mock in `e2e/helpers/supabase.ts`.

## Decided (Roshan, 11-11-2026)

- **Scope:** comments on hacks, and discounts added from the app. Community badges come later.
- **Comments:** flat, under each post, newest last; no replies.
- **A submitted discount** shows to signed-in students at once and is hidden by reports, like a hack (my recommendation was a moderator's approval first). Because nobody checks it before it shows, it is always marked as added by a student and shows its link, so it never reads like the app's own sourced list. The form says no alcohol deals, and reports plus the moderator keep the list clean.

**My calls (open to objection):**
- **Comments:** 3–300 characters, at most 20 a day per account. They show with `@username`, label and batch, and can be reported (on others') or deleted (one's own). A comment on a hidden or deleted post is gone with it.
- **Submitted discounts:**
  - **Fields:** place (2–80), offer (3–120), conditions (up to 300, optional), address (up to 120, optional), an expense category, a required https link (the source), and the language.
  - **Limits:** at most 3 a day; Regensburg only.
  - **Dates:** the checked date is the day it was added.
  - **Votes:** "Still works" and "Doesn't work anymore" work as for the app's own discounts (`discount_votes`, `discount_confirmations`, keyed by the id).
- **Who sees them:** signed in only, as the hacks feed. Guests keep the app's own list.
- **Notes:** one `post` data-protection note for hacks, comments and discounts, reworded to cover all three in four languages: each is public to every student with an account, under the posting name. Translate (the `translate` note) works on comments and discounts in another language.
- **Moderation:** each kind gets its own queue function and decision, because `moderation_queue`'s shape is pinned by pgTAP and the app. Settings → Moderation shows three sections: posts, comments, discounts.
- **Left out:** the AI city pack and the MCP server don't include submitted discounts (they're built from `src/data`).

## Chunks (about 1 h each, a draft PR each, CI on Roshan's OK)

1. **Comments, the database:** migration `hack_comments` (`id`, `hack_id` cascade, `user_id`, `body` 3–300, `lang`, `created_at`, `deleted_at`, `hidden_at`, `kept_at`) and `hack_comment_reports`. RLS and grants follow the hacks loop. Functions:
   - `post_comment(p_hack_id, p_body, p_lang)`, refusing with `needs-username`, `daily-limit` or `not-found` (a hidden or deleted post);
   - `delete_comment` and `report_comment`;
   - `comments_for(p_hack_id)`, oldest first, with the posting name and `mine`, never a user id;
   - `comment_counts()`: visible comments per visible post;
   - `comment_queue()` and `moderate_comment(p_id, 'hide'|'keep')`, for moderators at aal2.
   - pgTAP in `supabase/tests/hack_comments.test.sql`, with the shapes pinned, and additions where the two-step, account-deletion and private-function tests list functions or tables.
2. **Comments in the app** (`src/features/hacks/comments.ts`, `hacks-view.tsx`):
   - each post gets "Comments (n)", from one `comment_counts` read per visit, which opens the list (`comments_for`) and a short form;
   - `checkComment` holds the migration's limits, and its test reads them;
   - the `post` note comes first, and `needs-username` asks for a name, as `HackForm` does;
   - one's own comment has Delete, others' have Report (after a question) and Translate;
   - names follow the per-item rule ("Report: the comment by @lena, 04.11.2026");
   - texts in four languages, and the e2e mock answers the five functions.
3. **Comments: moderation and e2e:**
   - a Comments section on Settings → Moderation (`comment_queue`, Hide and Keep);
   - `e2e/hacks-comments.spec.ts`: post, the count, delete, report, the daily limit, a name first, German, 375 px;
   - the moderation spec gets comments;
   - the map entries.
4. **Discounts, the database:** migration `community_discounts` (the fields above, with `user_id`, `city`, `lang` and the timestamps, as hacks) and `community_discount_reports`. Functions:
   - `post_discount`, refusing with `needs-username` or `daily-limit`; the table checks refuse bad fields with 23514;
   - `delete_discount` and `report_discount`;
   - `community_discounts_feed()`: the newest 200 visible, with the posting name and `mine`;
   - `discount_queue()` and `moderate_discount`.
   - `discount_confirmations` already counts votes by any id: a pgTAP test proves it does so for a submitted discount too.
5. **Discounts in the list** (`src/features/discounts/community.ts`, `discounts-view.tsx`):
   - signed in, the list reads `community_discounts_feed` once per visit (rows checked like `postOf`), kept per account in localStorage like the hacks feed, and forgotten on sign-out (`followSessionForPhone`);
   - each becomes a `Discount`: the source reads "Added by @lena", with its link and the day it was added; it's tagged "Added by a student", and its text is marked with its `lang`;
   - it sorts with freshness and takes votes like the others;
   - own items have Delete, others' Report and Translate.
6. **Adding a discount:**
   - "Add a discount" on the Discounts tab opens a form (`checkDiscount`, which holds the migration's limits, the category from the expense categories, and "No alcohol deals" in its hint);
   - then the `post` note, `needs-username` and `post_discount`, after which the list reloads;
   - texts in four languages, and the e2e mock.
7. **Discounts: moderation, e2e and docs:**
   - a Discounts section on Settings → Moderation;
   - `e2e/community-discounts.spec.ts`: add, see it marked, vote, report, delete, the daily limit, German, 375 px;
   - the map entries;
   - CLAUDE.md: a Community rule, the outgoing-requests list, and the reworded note;
   - the plan doc, `docs/superpowers/plans/2026-11-11-community.md`.

Chunks 1 and 4 (the database) touch no shared files and could run in parallel. So could chunks 2 and 5–6 once their database chunk is merged, apart from the shared `post` note text, which chunk 2 rewords.

## Files

- **New:**
  - two migrations and their pgTAP files;
  - `src/features/hacks/comments.ts` (with a test);
  - `src/features/discounts/` additions: the community feed reader, `checkDiscount`, the add form;
  - two e2e specs.
- **Changed:**
  - `src/features/hacks/hacks-view.tsx`, `src/features/hacks/moderation*`, `src/features/discounts/discounts-view.tsx`;
  - `src/features/privacy/notes.ts`, the `common.privacy` texts;
  - `src/i18n/messages/*/` (tips and common);
  - `e2e/helpers/supabase.ts`, `e2e/affected-map.json`, CLAUDE.md.

## Verification

- **Each chunk:** lint, typecheck and the touched unit tests locally (no heavy lane).
- **Database chunks:** the CI `db` job (pgTAP), on Roshan's OK.
- **App chunks:** a changed CI run (Tips, Discounts and Settings specs), on Roshan's OK.
- **Real try on the live site** (two accounts):
  - a comment shows to the other account;
  - a report hides it for the reporter;
  - five reports hide it for everyone;
  - the moderator keeps it;
  - the same steps for a submitted discount, plus "Still works" counting across accounts.
- **Go-live:** `npx supabase db push` for the two migrations (Roshan's step, as for earlier migrations).

## As built

- **Chunk 1** (11-11-2026), migration `20261111092551_hack_comments.sql`:
  - **Tables:** `hack_comments` and `hack_comment_reports`, RLS and the second-step policy as the hacks tables, with no direct writes.
  - **Private helpers:** `private.post_visible(hack, me)` and `private.comment_visible(comment, me)`. Both are revoked from `authenticated`, and both follow `hacks_feed`'s rules: not deleted, not hidden, not reported by me, under `hide_after_reports()` reports since kept.
  - **Functions:**
    - `post_comment` refuses with `needs-username`, `not-found` (a post one may not see) or `daily-limit` (20 in 24 hours), and the table's checks refuse a bad body or language (23514);
    - `delete_comment`, and `report_comment` (`own-post` on one's own);
    - `comments_for` (oldest first, at most 200, no user id) and `comment_counts`;
    - `comment_queue` and `moderate_comment`, for a moderator at aal2.
  - **Tests:** `supabase/tests/hack_comments.test.sql` has 36 tests, and `user_data.test.sql`'s table list gains the two tables.
