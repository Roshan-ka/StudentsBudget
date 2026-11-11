-- Comments on hacks (community, chunk 1; docs/superpowers/plans/2026-11-11-community.md): flat, under each post,
-- oldest first, with their reports and the moderator's decisions. Built as the hacks feed is
-- (20261105110007_hacks.sql): the tables stay owner-only with the second-step policy and no direct writes; every
-- write goes through a function below; others' comments are read only through `comments_for`, `comment_counts` and
-- `comment_queue`, which return usernames, never a user id.
--
-- A comment is seen only on a post the reader may see. It is hidden for everyone by the moderator, or once
-- `private.hide_after_reports()` accounts reported it since the moderator last kept it, and at once for each account
-- that reported it. A comment and its reports go with the account that made them, and with their post.

create table public.hack_comments (
  id uuid primary key default gen_random_uuid(),
  hack_id uuid not null references public.hacks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 3 and 300),
  -- The language the comment was written in, as the app's language codes.
  lang text not null check (lang ~ '^[a-z]{2}$'),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  hidden_at timestamptz,
  kept_at timestamptz
);

create index hack_comments_by_hack on public.hack_comments (hack_id, created_at);
create index hack_comments_by_author on public.hack_comments (user_id, created_at);

-- One report per account per comment.
create table public.hack_comment_reports (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  comment_id uuid not null references public.hack_comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index hack_comment_reports_by_comment on public.hack_comment_reports (comment_id, created_at);

do $$
declare
  t text;
begin
  foreach t in array array['hack_comments', 'hack_comment_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    -- Reading one's own rows only; no direct writes (the functions below write them).
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format(
      'create policy "owner reads" on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t
    );
    -- As on every user table (20261028150013_two_step_sign_in.sql).
    execute format(
      'create policy "second step when the account has one" on public.%I as restrictive to authenticated '
        || 'using ((select auth.jwt() ->> ''aal'') = ''aal2'' or not (select private.has_verified_factor())) '
        || 'with check ((select auth.jwt() ->> ''aal'') = ''aal2'' or not (select private.has_verified_factor()))',
      t
    );
  end loop;
end;
$$;

-- Whether `me` may see the post `p_hack_id`, as `hacks_feed` decides: not deleted, not hidden by the moderator, not
-- reported by `me`, and not hidden by reports.
create function private.post_visible(p_hack_id uuid, me uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.hacks h
    where h.id = p_hack_id
      and h.deleted_at is null
      and h.hidden_at is null
      and not exists (select 1 from public.hack_reports r where r.hack_id = h.id and r.user_id = me)
      and (
        select count(*) from public.hack_reports r
        where r.hack_id = h.id and r.created_at > coalesce(h.kept_at, '-infinity'::timestamptz)
      ) < private.hide_after_reports()
  );
$$;

-- Whether `me` may see the comment `c`, its post aside: the same rules as for a post.
create function private.comment_visible(p_comment_id uuid, me uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.hack_comments c
    where c.id = p_comment_id
      and c.deleted_at is null
      and c.hidden_at is null
      and not exists (select 1 from public.hack_comment_reports r where r.comment_id = c.id and r.user_id = me)
      and (
        select count(*) from public.hack_comment_reports r
        where r.comment_id = c.id and r.created_at > coalesce(c.kept_at, '-infinity'::timestamptz)
      ) < private.hide_after_reports()
  );
$$;

-- Only the functions below call these (two_step.test.sql holds what authenticated may run in private).
revoke all on function private.post_visible(uuid, uuid) from public, anon, authenticated;
revoke all on function private.comment_visible(uuid, uuid) from public, anon, authenticated;

-- Comments on a post the signed-in user may see, and returns the comment's id. It needs a username first (hint
-- 'needs-username'), a post the user may see (hint 'not-found'), and allows 20 comments in any 24 hours, deleted ones
-- included (hint 'daily-limit'). The table's checks refuse a bad body or language (23514). Commenting on one's own
-- post is fine.
create function public.post_comment(p_hack_id uuid, p_body text, p_lang text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.acting_user();
  made uuid;
begin
  if not exists (select 1 from public.public_profiles p where p.user_id = me) then
    raise exception 'pick a username first' using errcode = 'P0001', hint = 'needs-username';
  end if;
  if not private.post_visible(p_hack_id, me) then
    raise exception 'no such post' using errcode = 'P0001', hint = 'not-found';
  end if;
  if (select count(*) from public.hack_comments c where c.user_id = me and c.created_at > now() - interval '1 day') >= 20
  then
    raise exception 'twenty comments a day' using errcode = 'P0001', hint = 'daily-limit';
  end if;
  insert into public.hack_comments (hack_id, user_id, body, lang)
  values (p_hack_id, me, btrim(p_body), p_lang)
  returning id into made;
  return made;
end;
$$;

-- Deletes one of the signed-in user's own comments (it stays as a row with `deleted_at`, out of every list). Someone
-- else's comment, or none, is refused (hint 'not-found'); deleting a deleted comment again changes nothing.
create function public.delete_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.acting_user();
begin
  if not exists (select 1 from public.hack_comments c where c.id = p_id and c.user_id = me) then
    raise exception 'no such comment of yours' using errcode = 'P0001', hint = 'not-found';
  end if;
  update public.hack_comments c set deleted_at = now() where c.id = p_id and c.deleted_at is null;
end;
$$;

-- Reports a comment: it leaves the reporter's list at once, and everyone's once enough accounts reported it. Once per
-- account per comment; not one's own (hint 'own-post'); a comment that is gone is refused (hint 'not-found').
create function public.report_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.acting_user();
  author uuid;
begin
  select c.user_id into author from public.hack_comments c where c.id = p_id and c.deleted_at is null;
  if author is null then
    raise exception 'no such comment' using errcode = 'P0001', hint = 'not-found';
  end if;
  if author = me then
    raise exception 'not your own comment' using errcode = 'P0001', hint = 'own-post';
  end if;
  insert into public.hack_comment_reports (user_id, comment_id) values (me, p_id) on conflict do nothing;
end;
$$;

-- The comments the signed-in user may see on a post they may see, oldest first (at most 200), with the author's
-- username, label and batch and whether it is the user's own. Never a user id. Nothing for a post they may not see.
create function public.comments_for(p_hack_id uuid)
returns table (
  id uuid,
  body text,
  lang text,
  created_at timestamptz,
  username text,
  label text,
  batch smallint,
  mine boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := private.acting_user();
begin
  if not private.post_visible(p_hack_id, me) then
    return;
  end if;
  return query
  select c.id, c.body, c.lang, c.created_at, p.username, p.label, p.batch, c.user_id = me
  from public.hack_comments c
  left join public.public_profiles p on p.user_id = c.user_id
  where c.hack_id = p_hack_id and private.comment_visible(c.id, me)
  order by c.created_at, c.id
  limit 200;
end;
$$;

-- How many comments the signed-in user may see on each post they may see, for the posts that have any.
create function public.comment_counts()
returns table (hack_id uuid, comments bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := private.acting_user();
begin
  return query
  select c.hack_id, count(*)
  from public.hack_comments c
  where private.post_visible(c.hack_id, me) and private.comment_visible(c.id, me)
  group by c.hack_id;
end;
$$;

-- For the moderator: every comment that was reported or hidden, and not deleted, most recently reported first, with
-- its post's id, the author's username, the reports in all and since it was last kept, and whether it is hidden by
-- hand or by reports.
create function public.comment_queue()
returns table (
  id uuid,
  hack_id uuid,
  body text,
  lang text,
  created_at timestamptz,
  username text,
  reports bigint,
  reports_since_kept bigint,
  hidden_by_hand boolean,
  hidden_by_reports boolean,
  kept_at timestamptz,
  last_report timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.acting_moderator();
  return query
  select
    c.id, c.hack_id, c.body, c.lang, c.created_at,
    p.username,
    count(r.comment_id),
    count(r.comment_id) filter (where r.created_at > coalesce(c.kept_at, '-infinity'::timestamptz)),
    c.hidden_at is not null,
    count(r.comment_id) filter (where r.created_at > coalesce(c.kept_at, '-infinity'::timestamptz))
      >= private.hide_after_reports(),
    c.kept_at,
    max(r.created_at)
  from public.hack_comments c
  left join public.public_profiles p on p.user_id = c.user_id
  left join public.hack_comment_reports r on r.comment_id = c.id
  where c.deleted_at is null
  group by c.id, p.username
  having count(r.comment_id) > 0 or c.hidden_at is not null
  order by max(r.created_at) desc nulls last, c.created_at desc;
end;
$$;

-- The moderator's decision on a comment: 'hide' takes it out of every list; 'keep' brings it back and starts the
-- report count afresh (each reporter still doesn't see it).
create function public.moderate_comment(p_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.acting_moderator();
  if p_action = 'hide' then
    update public.hack_comments c set hidden_at = now() where c.id = p_id;
  elsif p_action = 'keep' then
    update public.hack_comments c set hidden_at = null, kept_at = now() where c.id = p_id;
  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  if not found then
    raise exception 'no such comment' using errcode = 'P0001', hint = 'not-found';
  end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.post_comment(uuid, text, text)',
    'public.delete_comment(uuid)',
    'public.report_comment(uuid)',
    'public.comments_for(uuid)',
    'public.comment_counts()',
    'public.comment_queue()',
    'public.moderate_comment(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
