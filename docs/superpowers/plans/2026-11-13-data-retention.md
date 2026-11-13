# Data retention (13-11-2026)

## Context

The privacy notice (`docs/superpowers/plans/2026-11-12-legal-pages.md`, live since #227) says what the account keeps and for how long. Some of it is kept longer than the app needs, which a legal check would likely question (storage limitation, Art. 5 (1) (e) GDPR):

- **Deleted hacks, comments and students' discounts** only get a `deleted_at` stamp: their text stays until the whole account is deleted. Nothing reads them afterwards (the feeds and the moderation queues skip them); only the daily limits count them, over the last 24 hours.
- **Hidden ones** (by the moderator, or by `hide_after_reports()` reports since the moderator last kept them) are out of every feed, their author's included, so the author can't see or delete them either: they also stay until the account goes.
- **AI uses** (`private.ai_uses`) are cleared only at a feature's next use (`take_ai_allowance`), so someone who stops using the AI keeps theirs.
- **The username, label and batch** stay in Supabase Auth's sign-up metadata (`raw_user_meta_data`) after `profile_from_sign_up` copies them to `public_profiles`, and don't follow a later change of name there. Nothing reads them; the email templates read only `lang`.

## Decided (Roshan, 13-11-2026)

- Data retention is the next plan, from "plan next steps".
- Hidden content goes **30 days** after it was hidden, unless the moderator keeps it.
- "Dive in": the rest is my call, below.

## Design (my calls)

- **One daily job** in the database, like the weekly reminder's schedule: `private.purge_old_content()`, scheduled by pg_cron at 03:20 UTC, owner only. It returns what it deleted per kind, which pg_cron's run log keeps.
  - **Deleted by their authors:** hacks, comments and students' discounts with `deleted_at`, once posted more than a day ago (so they no longer count in the daily limits). A deleted one is gone within two days.
  - **Hidden for 30 days:** `hidden_at` more than 30 days ago (the moderator's Hide), or the `hide_after_reports()`-th report since `kept_at` more than 30 days ago. Keep clears `hidden_at` and sets `kept_at`, so a kept item is safe.
  - **AI uses** over two days old, as `take_ai_allowance` already treats them.
  - **Sign-up metadata:** `username`, `label` and `batch` taken out of `raw_user_meta_data`; `lang` stays.
  - A deleted hack takes its comments, votes and reports with it (`on delete cascade`).
- **Left as they are:**
  - **Sync tombstones:** they hold no content (`data` null: an id and timestamps), and purging them would need a full re-pull for any phone offline longer than the purge age. The notice already calls them "a note without its content".
  - **Reports and votes** go with their item or their account.
  - **Other accounts' `discount_votes`** naming a purged student discount by its uuid: the voter's own synced data, with nothing to join to.
- **The notice and the moderation page** say it (chunk 2): the shared section, the AI section, and a line on Settings → Moderation that hidden items go after 30 days unless kept.

## Chunks (about 1 h each, a draft PR each; checks in CI on Roshan's OK, none run locally)

1. **The daily purge:** the migration (`purge_old_content`), and `purge_old_content.test.sql` (the job and who may run it; what goes and what stays in each case; the metadata; a second run deletes nothing).
2. **Saying it:** the privacy notice's shared and AI sections (German and English) and its test; the moderation page's line in four languages; CLAUDE.md; As built. It merges after chunk 1's migration is on the hosted project, so the notice never promises what the database doesn't do yet.

## Verification

- **Chunk 1:** CI's `db` job runs the migrations and pgTAP on a local stack.
- **Go-live (Roshan):** after chunk 1 merges, `npx supabase migration list --linked`, then `npx supabase db push`. The next day, the run log: `select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'purge-old-content') order by start_time desc limit 3;` in the SQL editor shows it succeeded, with its counts.
- **Undo:** `select cron.unschedule('purge-old-content');` stops it at once; a new migration removes it for good.

## As built
- **Chunk 1** (13-11-2026), the daily purge (migration `20261113081710_purge_old_content.sql`):
  - **`private.purge_old_content()`**, owner only, returns `{hacks, comments, discounts, ai_uses, metadata}` counts, scheduled as `purge-old-content` at `20 3 * * *`.
  - **Hidden by reports:** the `hide_after_reports()`-th report after `coalesce(kept_at, '-infinity')`, found with `order by created_at offset hide_after_reports() - 1 limit 1`; a kept item has no such report and stays.
  - **Not security definer:** pg_cron runs the job as the owner, which may already change `auth.users` (as `delete_my_account()` does).
  - **Tests:** `purge_old_content.test.sql` (31): the job, its schedule and who may run it; each case of hacks (live, deleted within or after the day, hidden by the moderator 29 or 31 days ago, by five reports 29 or 31 days ago, kept after reports, four reports), comments (live, deleted, hidden, gone with their post) and discounts (live, deleted, report-hidden with its reports, hidden 29 days ago); AI uses; the metadata (the name out, `lang` in, `public_profiles` untouched, no name left as it is); the counts, and a second run that deletes nothing.
  - **CLAUDE.md:** the plan in the opening list, and the purge in the Supabase schema rule.
  - **Go-live:** Roshan's `db push` once merged (Verification); chunk 2's texts merge only after it.
