# The hacks feed, with a moderator (05-11-2026)

## Context

Next on the roadmap after the data-protection notes (#95, #97): the community hacks feed from the Concept's §12. Students post money-saving tips in the Tips tab, others confirm or flag them, and Roshan moderates reported posts by hand. It also gives the playwright-tester skill its Roles case (reader, poster, moderator). Roshan approved this plan on 05-11-2026.

## Decided

**By Roshan (05-11-2026):**
- Sign-up asks for a unique **@username** and a **label**: Student, Graduate or Alumni ("passout"), plus an optional batch year ("Batch '27"). Existing accounts are asked at their first post; both can be changed under Your account.
- A report hides the post at once for the reporter; **5 reports** hide it for everyone until the moderator decides. One constant, to raise later.
- A standard **Translate** link on posts. **No comments** for now. **No house rules** for now.
- The moderator's actions need **two-step sign-in** (an aal2 session).

**From the Concept (§12):** any account reads and posts (no invites). A post has text, a city (Regensburg or "anywhere"), a category and a date. Buttons: upvote, "worked for me", "outdated", report. The verified badge joins the username later (it waits for the email sender).

**My calls (not objected to):**
- Authors delete their posts but never edit them, so votes stay with the confirmed text.
- A link is optional.
- Posts stay in their own language.
- Offline, the feed shows the last list it loaded.
- At most 5 posts per account a day, against spam.

## Design

### Database (new migrations, never edits)
- **`public_profiles`**: one row per user.
  - Columns:
    - `user_id` (pk, cascades from `auth.users`);
    - `username`: `^[a-z0-9_]{3,20}$`, unique, a few reserved names such as `moderator`, `admin` and `studentsbudget`;
    - `label`: `student`, `graduate`, `alumni` or null;
    - `batch`: 2000–2100 or null;
    - `updated_at`.
  - RLS: owner select, insert and update, plus the restrictive "second step when the account has one" policy.
  - **`private.profile_from_sign_up()`**, a trigger after insert on `auth.users`:
    - copies `username`, `label` and `batch` from the sign-up metadata;
    - skips a bad or taken name (`on conflict do nothing`), so it never fails a sign-up;
    - a person left without a username is asked for one later.
  - **`username_available(text)`**: security definer, granted to `anon` and `authenticated`. Sign-up calls it before `signUp`.
- **`hacks`**:
  - Columns:
    - `id` (uuid);
    - `user_id` (cascades);
    - `body` (10–500 characters);
    - `city` (`regensburg` or `anywhere`);
    - `category`: an app category id, checked by the app; the database checks only its shape;
    - `link`: `https://`, at most 300 characters, or null;
    - `lang` (two letters);
    - `created_at`, `deleted_at`, `hidden_at`, `kept_at`.
  - RLS: owner select plus the restrictive policy. There are no insert or update grants: every write goes through an RPC.
- **`hack_votes`**: `(user_id, hack_id)` primary key, `up` boolean and `verdict` (`worked`, `outdated` or null).
- **`hack_reports`**: `(user_id, hack_id)` primary key and `created_at`.
- Both are owner-select only, with the restrictive policy, and cascade from the user and the post.
- **`private.moderators(user_id)`**: filled by hand. Roshan runs one `insert … select id from auth.users where email = …` in the hosted SQL editor. It isn't granted to anyone.
- **RPCs** follow `delete_my_account`'s pattern: security definer, `search_path = ''`, and 42501 without a user, or for an aal1 session on an account with a factor.
  - **Writes:**
    - `post_hack`: needs a username; at most 5 a day; returns the id.
    - `delete_hack`: only the author's own posts; sets `deleted_at`.
    - `vote_hack`: not on the author's own post.
    - `report_hack`: once per account per post.
  - **`hacks_feed()`**: the newest 200 visible posts.
    - Each row has the username, label, batch, `mine`, the up, worked and outdated counts, and my own vote. It never returns a `user_id` (pgTAP pins the return shape).
    - It leaves out posts that are:
      - deleted;
      - hidden;
      - reported by me;
      - at 5 or more reports since `kept_at`.
  - **Moderation:**
    - `am_i_moderator()`: a boolean.
    - `moderation_queue()`: posts with reports, their counts and state.
    - `moderate_hack(id, 'hide' | 'keep')`. "Keep" sets `kept_at`, so the earlier reports stop counting.
    - The last two need a moderator in an **aal2** session.
- **Account deletion** cascades the profile, posts, votes and reports, with no change to `delete_my_account`. Votes on a deleted post go with it.
- **Tests:**
  - Update `user_data.test.sql`'s `tables_are` list. `two_step.test.sql`'s private-function list stays as it is, since nothing new in `private` is granted.
  - New pgTAP files `public_profiles.test.sql` and `hacks.test.sql`.
  - Contract tests use two confirmed users (`src/sync/contract-users.ts`), as `discount-confirmations.contract.test.ts` does.

### App
- **`src/features/hacks/`**:
  - `hacks.ts`: typed RPC wrappers that check results, like `community.ts`, plus the feed cache;
  - `hacks-view.tsx`, `hack-card.tsx` and `hack-form.tsx`;
  - `public-profile.tsx`: the username and label editor, shared by sign-up, Your account and the first post;
  - `moderation-view.tsx`.
- **Tips tab:** a third tab, "From students", beside Tips and Discounts, with keepMounted panels. The category chips reuse `tipChipIds`, and names, icons and tints come from `categoryNameIn`, `CATEGORY_ICONS` and `categoryTint`.
- **Signed out:** the tab says that signing in lets you read and post.
- **The cache:** the last loaded feed is kept per phone in localStorage. It is cleared on sign-out, and the tab shows when the list was loaded.
- **A card shows:**
  - `@username · Student · Batch '27`;
  - the category, the city and the date (`formatDate`);
  - the text, marked with `lang`, and the link;
  - the counts;
  - the buttons: upvote, worked for me, outdated and report, plus Delete on the author's own posts.
- **Translate:** shown when the post's `lang` isn't the phone's. It opens `https://translate.google.com/?sl=auto&tl=<phone>&text=…&op=translate` in a new tab.
- **Sign-up** (`SignInForm`, create mode) adds a username field, a label select and an optional batch year.
  - The username is checked on the phone, then with `username_available`, after the account note.
  - `signUp` sends `{ lang, username, label, batch }`.
- **Your account:** a "Your name on posts" card for changing the username, label and batch.
- **Moderation:**
  - Under the Settings hub (from the pain-points chunks), a row shows only when `am_i_moderator()` is true, and it leads to a new static route, `/settings/moderation`.
  - In an aal1 session the page asks for the authenticator code first.
  - The new route gets entries in `affected-map.json`, `PAGES` and `shell.headings`.
- **Data-protection notes** (`PRIVACY_NOTES` and `common.privacy`):
  - The `account` note's text adds the username and label that others see.
  - New notes:
    - `post`: every account can read the post, with the username and label; it can be deleted at any time;
    - `hackVotes`: votes count in totals and nobody sees who voted; a report hides the post for the reporter;
    - `translate`: Google gets the text and the phone's address.
- **Texts:** all four languages. French with `NNBSP`.
- **e2e:** `mockSupabaseData` gains an in-memory feed:
  - posts, votes, reports and a `moderator` flag;
  - it answers every new RPC;
  - `mockSupabaseAuth`'s `/signup` keeps the metadata.
- **CLAUDE.md:** a "Hacks feed" rule. Shared tables are owner-select only. Their writes go only through security-definer RPCs that check the second step. Others' rows are read only through functions that return usernames, never user ids. Add the new calls to "Outgoing requests".

## Chunks (about 1 h each; one PR each; Roshan merges)

1. **Usernames in the database:** the `public_profiles` migration, the trigger and `username_available`; pgTAP and a contract test (a sign-up's metadata makes the profile, a taken name is skipped); the plan doc into the repo.
2. **Sign-up and Your account:** the username, label and batch fields; the "Your name on posts" card; the updated account note; texts; e2e.
3. **Posts in the database:** `hacks`, `hack_votes`, `hack_reports`, `private.moderators` and every RPC; pgTAP and a contract test (two users: post, vote, report, the auto-hide at 5, keep).
4. **Reading the feed:** the third tab, the cards, the signed-out text and the offline cache; e2e.
5. **Posting and deleting:** the form, the `post` note, the username asked at the first post when it's missing, and delete; e2e.
6. **Votes and reports:** the buttons, the `hackVotes` note, and a report hiding the post at once; e2e.
7. **Moderation:** the Settings row and page, the aal2 step, hide and keep; a roles e2e spec (reader, poster, moderator); the moderator SQL in the plan doc.
8. **Translate:** the link and its note; German, French and Spanish checked on the tab; CLAUDE.md and the plan doc finished.

**Order with the pain-points session (now on #99):**
- Chunks 1 and 3 touch no screen the pain-points work changes.
- Chunk 4 waits for its Tips chunk 8, which widens the remembered tab.
- Chunk 7 waits for the Settings hub (its chunks 3 and 4).
- If either is late, I'll ask that session for its timing instead of building on top of it.

**Hosted project:** Roshan runs `npx supabase db push` after chunks 1 and 3 merge, and adds himself as moderator with the SQL from chunk 7.

## As built

**Chunk 1 (2026-11-05):**
- Migration `20261105100426_public_profiles.sql`: the table, its owner policies and the restrictive second-step policy; the `profile_from_sign_up` trigger (security definer, every error swallowed); `username_available`, granted to `anon` and `authenticated`.
- Reserved usernames: admin, administrator, moderator, mod, studentsbudget, support, system.
- Tests:
  - `supabase/tests/public_profiles.test.sql`: grants, the trigger with good and bad metadata, the username rule, owner-only reads and writes, a taken name, the cascade.
  - `user_data.test.sql` now lists `public_profiles` among the public tables.
  - `src/features/hacks/public-profiles.contract.test.ts`: a real sign-up keeps its name, a second one with the same name gets none, and `username_available` answers signed out.
- The hosted project needs `npx supabase db push` once this merges.

**Chunk 2 (2026-11-05):**
- `src/features/hacks/posting-name.ts`: the username rule (checked against the migration in its unit test), the labels, the batch, `checkDraft`, `postingNameText` ("@roshan · Student · Batch '27") and the calls (`usernameAvailable`, `readPostingName`, `savePostingName`).
- `posting-name-fields.tsx` (the three fields, the username kept in lower case as typed) in the sign-up form and in `posting-name-card.tsx`, "Your name on posts" on Your account, after Sync. The plan's `public-profile.tsx` became these two files.
- Sign-up: the phone checks the name, then the account note, then `username_available` (a taken name is said before the account exists), then `signUp` with `{ lang, username, label, batch }`. The label starts on Student.
- Texts: `auth.postingName` in four languages; the account note now names the username, label and batch others see.
- e2e: `mockSupabaseData` answers `username_available` (signed out too) and `public_profiles` per user (`profiles`); `posting-name.spec.ts` (sign-up checks and metadata, a check that fails, the card changing a name, a taken name, an account without one, German); the sign-up specs (`account`, `email-codes`, `privacy-notes`) give a username.

**Chunk 3 (2026-11-05):**
- Migration `20261105110007_hacks.sql`: `hacks`, `hack_votes`, `hack_reports` (owner-select only, second-step policy, no direct writes), `private.moderators`, `private.hide_after_reports()` (5), `private.acting_user()` and `private.acting_moderator()`, and the functions `post_hack`, `delete_hack`, `vote_hack`, `report_hack`, `hacks_feed`, `am_i_moderator`, `moderation_queue`, `moderate_hack`.
- One change from the plan: an upvote and a verdict sit in one `hack_votes` row per account and post, as planned, but reports are refused on one's own post too (`own-post`), as votes are.
- Errors the app reads by their hint: `needs-username`, `daily-limit`, `own-post`, `not-found`; a bad body, city, category, link or language is the table's check (23514).
- Tests:
  - `supabase/tests/hacks.test.sql` (38): grants and policies; the return shapes with no user id; posting (a username, the second step, the checks, 5 a day, no direct writes); votes and their totals; reports (gone for the reporter, for everyone at 5); the moderator (aal2 only, the queue, keep and hide); deleting; the cascade.
  - `user_data.test.sql` lists the three new tables.
  - `src/features/hacks/hacks.contract.test.ts`: real users post, vote and read the feed by username; a report hides a post from its reporter only; no username, no post; no direct writes; nobody moderates by default; signed out, no feed.
- The hosted project needs `npx supabase db push` once this merges.

**Making the moderator** (once chunk 3 is on the hosted project; in the dashboard's SQL editor, as the project owner):

```sql
insert into private.moderators (user_id) select id from auth.users where email = '<the moderator account''s email>';
```

The moderator account needs two-step sign-in turned on: the moderation functions answer only a session that gave the authenticator code.

## Verification

- **Each chunk, locally:** lint, typecheck and the touched unit tests only. The full suite, pgTAP and contract tests (the CI `db` job) and the e2e run in CI, on Roshan's OK.
- **Database chunks:**
  - pgTAP pins the grants and policies, and that no function returns a `user_id`.
  - The aal2 refusal, the 5-a-day limit, the auto-hide at 5 reports and `kept_at`.
  - A contract test with real signed-in users.
- **UI chunks:**
  - e2e at 375 px: a reader, a poster and a moderator.
  - The German tab.
  - Each new note: shows once, Cancel sends nothing, Continue goes on.
- **At the end:** a real try on the live site with two accounts and the moderator, added to Roshan's batch of postponed phone tries.
