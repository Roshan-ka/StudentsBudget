-- Data retention, chunk 1 (docs/superpowers/plans/2026-11-13-data-retention.md): once a day, the database deletes what
-- the app no longer needs, so nothing is kept only because nobody cleared it.
--   - Hacks, comments and students' discounts their authors deleted, once posted more than a day ago: until then they
--     count in the daily limits. So a deleted one is gone within two days.
--   - Those hidden from everyone for 30 days without the moderator keeping them: by the moderator's Hide (`hidden_at`),
--     or by `hide_after_reports()` reports since the moderator last kept them. Their authors can't see or delete them,
--     so nothing else would (Roshan, 13-11-2026: 30 days).
--   - AI uses over two days old, which `take_ai_allowance` otherwise clears only at a feature's next use.
--   - The username, label and batch in Supabase Auth's sign-up metadata, which `profile_from_sign_up` has copied to
--     `public_profiles` and nothing reads. `lang` stays: the email templates read it.
-- A deleted hack takes its comments, votes and reports with it (on delete cascade), and a comment or a discount its
-- reports. Sync tombstones stay: they hold no content.

-- Deletes what is due, and says how much of each kind went (pg_cron keeps the result in its run log).
create function private.purge_old_content()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  hacks_gone int;
  comments_gone int;
  discounts_gone int;
  ai_uses_gone int;
  metadata_cleared int;
begin
  delete from public.hacks h
  where (h.deleted_at is not null and h.created_at < now() - interval '1 day')
    or h.hidden_at < now() - interval '30 days'
    or (
      select r.created_at from public.hack_reports r
      where r.hack_id = h.id and r.created_at > coalesce(h.kept_at, '-infinity'::timestamptz)
      order by r.created_at
      offset private.hide_after_reports() - 1
      limit 1
    ) < now() - interval '30 days';
  get diagnostics hacks_gone = row_count;

  delete from public.hack_comments c
  where (c.deleted_at is not null and c.created_at < now() - interval '1 day')
    or c.hidden_at < now() - interval '30 days'
    or (
      select r.created_at from public.hack_comment_reports r
      where r.comment_id = c.id and r.created_at > coalesce(c.kept_at, '-infinity'::timestamptz)
      order by r.created_at
      offset private.hide_after_reports() - 1
      limit 1
    ) < now() - interval '30 days';
  get diagnostics comments_gone = row_count;

  delete from public.community_discounts d
  where (d.deleted_at is not null and d.created_at < now() - interval '1 day')
    or d.hidden_at < now() - interval '30 days'
    or (
      select r.created_at from public.community_discount_reports r
      where r.discount_id = d.id and r.created_at > coalesce(d.kept_at, '-infinity'::timestamptz)
      order by r.created_at
      offset private.hide_after_reports() - 1
      limit 1
    ) < now() - interval '30 days';
  get diagnostics discounts_gone = row_count;

  delete from private.ai_uses u where u.used_at < now() - interval '2 days';
  get diagnostics ai_uses_gone = row_count;

  update auth.users u
  set raw_user_meta_data = u.raw_user_meta_data - 'username' - 'label' - 'batch'
  where u.raw_user_meta_data ?| array['username', 'label', 'batch'];
  get diagnostics metadata_cleared = row_count;

  return jsonb_build_object(
    'hacks', hacks_gone,
    'comments', comments_gone,
    'discounts', discounts_gone,
    'ai_uses', ai_uses_gone,
    'metadata', metadata_cleared
  );
end;
$$;

-- Only the job (which runs as the owner) purges.
revoke all on function private.purge_old_content() from public, anon, authenticated, service_role;

-- Every day at 03:20 UTC, when hardly anyone uses the app.
select cron.schedule('purge-old-content', '20 3 * * *', 'select private.purge_old_content()');
