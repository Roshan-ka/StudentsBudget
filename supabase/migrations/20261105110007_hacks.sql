-- The hacks feed, chunk 3 (docs/superpowers/plans/2026-11-05-hacks-feed.md): students' money-saving posts, their votes
-- and reports, and the moderator who hides or keeps a reported post.
--
-- Shared, unlike the user-data tables: every signed-in account reads every visible post. The tables themselves stay
-- owner-only (each user reads their own rows and writes none directly). Every write goes through a function below,
-- and others' rows are read only through `hacks_feed` and `moderation_queue`, which return usernames, never a user id.
-- Like the user-data tables, an account with two-step sign-in needs the code first (aal2); the moderator's two
-- functions need it always. A post, its votes and its reports go with the account that made them.
--
-- A post is hidden for everyone by the moderator, or once `private.hide_after_reports()` accounts reported it since
-- the moderator last kept it; it is hidden at once for each account that reported it.

create table public.hacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 10 and 500),
  city text not null check (city in ('regensburg', 'anywhere')),
  -- An app category id; the app checks which (src/data/categories.ts), the database only its shape.
  category text not null check (category ~ '^[a-z][a-z-]{1,29}$'),
  link text check (link ~ '^https://\S+$' and char_length(link) <= 300),
  -- The language the post was written in, as the app's language codes.
  lang text not null check (lang ~ '^[a-z]{2}$'),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  hidden_at timestamptz,
  kept_at timestamptz
);

create index hacks_newest on public.hacks (created_at desc);
create index hacks_by_author on public.hacks (user_id, created_at);

-- Each account's vote on a post: an upvote, and "worked for me" or "outdated" (one of the two at most).
create table public.hack_votes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hack_id uuid not null references public.hacks (id) on delete cascade,
  up boolean not null default false,
  verdict text check (verdict in ('worked', 'outdated')),
  updated_at timestamptz not null default now(),
  primary key (user_id, hack_id)
);

create index hack_votes_by_hack on public.hack_votes (hack_id);

-- One report per account per post.
create table public.hack_reports (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hack_id uuid not null references public.hacks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, hack_id)
);

create index hack_reports_by_hack on public.hack_reports (hack_id, created_at);

do $$
declare
  t text;
begin
  foreach t in array array['hacks', 'hack_votes', 'hack_reports'] loop
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

-- Who moderates: filled by hand in the SQL editor (the plan doc has the statement). Nobody signed in reads it.
create table private.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table private.moderators enable row level security;
revoke all on table private.moderators from public, anon, authenticated;

-- How many accounts' reports hide a post for everyone, since the moderator last kept it. One number, to raise as the
-- app grows: a new migration replaces this function.
create function private.hide_after_reports()
returns int
language sql
immutable
set search_path = ''
as $$
  select 5;
$$;

-- The signed-in user, as the functions below may act for them: refused without one, and refused for an account with
-- two-step sign-in until it gave the code (as delete_my_account does).
create function private.acting_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if (select private.has_verified_factor()) and coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'the second step is owed' using errcode = '42501';
  end if;
  return me;
end;
$$;

-- The signed-in moderator, in a session that gave the authenticator code: every moderator action needs both.
create function private.acting_moderator()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not exists (select 1 from private.moderators m where m.user_id = me) then
    raise exception 'not a moderator' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'the second step is owed' using errcode = '42501';
  end if;
  return me;
end;
$$;

-- Only the functions below call these (two_step.test.sql holds what authenticated may run in private).
revoke all on function private.hide_after_reports() from public, anon, authenticated;
revoke all on function private.acting_user() from public, anon, authenticated;
revoke all on function private.acting_moderator() from public, anon, authenticated;

-- Posts a hack for the signed-in user and returns its id. It needs a username first (hint 'needs-username'), and
-- allows 5 posts in any 24 hours, deleted ones included (hint 'daily-limit'). The table's checks refuse a bad body,
-- city, category, link or language (23514).
create function public.post_hack(p_body text, p_city text, p_category text, p_link text, p_lang text)
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
  if (select count(*) from public.hacks h where h.user_id = me and h.created_at > now() - interval '1 day') >= 5 then
    raise exception 'five posts a day' using errcode = 'P0001', hint = 'daily-limit';
  end if;
  insert into public.hacks (user_id, body, city, category, link, lang)
  values (me, btrim(p_body), p_city, p_category, nullif(btrim(p_link), ''), p_lang)
  returning id into made;
  return made;
end;
$$;

-- Deletes one of the signed-in user's own posts (it stays as a row with `deleted_at`, out of every list). Someone
-- else's post, or none, is refused (hint 'not-found'); deleting a deleted post again changes nothing.
create function public.delete_hack(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.acting_user();
begin
  if not exists (select 1 from public.hacks h where h.id = p_id and h.user_id = me) then
    raise exception 'no such post of yours' using errcode = 'P0001', hint = 'not-found';
  end if;
  update public.hacks h set deleted_at = now() where h.id = p_id and h.deleted_at is null;
end;
$$;

-- The signed-in user's vote on a post others can see: the upvote and the verdict, both as they should now be. Not on
-- one's own post (hint 'own-post'); a post that is gone or hidden is refused (hint 'not-found').
create function public.vote_hack(p_id uuid, p_up boolean, p_verdict text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.acting_user();
  author uuid;
begin
  select h.user_id into author from public.hacks h
  where h.id = p_id and h.deleted_at is null and h.hidden_at is null;
  if author is null then
    raise exception 'no such post' using errcode = 'P0001', hint = 'not-found';
  end if;
  if author = me then
    raise exception 'not on your own post' using errcode = 'P0001', hint = 'own-post';
  end if;
  insert into public.hack_votes (user_id, hack_id, up, verdict)
  values (me, p_id, coalesce(p_up, false), p_verdict)
  on conflict (user_id, hack_id) do update set up = excluded.up, verdict = excluded.verdict, updated_at = now();
end;
$$;

-- Reports a post: it leaves the reporter's feed at once, and everyone's once enough accounts reported it. Once per
-- account per post; not one's own (hint 'own-post'); a post that is gone is refused (hint 'not-found').
create function public.report_hack(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.acting_user();
  author uuid;
begin
  select h.user_id into author from public.hacks h where h.id = p_id and h.deleted_at is null;
  if author is null then
    raise exception 'no such post' using errcode = 'P0001', hint = 'not-found';
  end if;
  if author = me then
    raise exception 'not your own post' using errcode = 'P0001', hint = 'own-post';
  end if;
  insert into public.hack_reports (user_id, hack_id) values (me, p_id) on conflict do nothing;
end;
$$;

-- The newest 200 posts the signed-in user may see, with the author's username, label and batch, whether it is the
-- user's own, the totals of each kind of vote, and the user's own vote. Never a user id.
create function public.hacks_feed()
returns table (
  id uuid,
  body text,
  city text,
  category text,
  link text,
  lang text,
  created_at timestamptz,
  username text,
  label text,
  batch smallint,
  mine boolean,
  ups bigint,
  worked bigint,
  outdated bigint,
  my_up boolean,
  my_verdict text
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
  return query
  select
    h.id, h.body, h.city, h.category, h.link, h.lang, h.created_at,
    p.username, p.label, p.batch,
    h.user_id = me,
    (select count(*) from public.hack_votes v where v.hack_id = h.id and v.up),
    (select count(*) from public.hack_votes v where v.hack_id = h.id and v.verdict = 'worked'),
    (select count(*) from public.hack_votes v where v.hack_id = h.id and v.verdict = 'outdated'),
    coalesce(mv.up, false),
    mv.verdict
  from public.hacks h
  left join public.public_profiles p on p.user_id = h.user_id
  left join public.hack_votes mv on mv.hack_id = h.id and mv.user_id = me
  where h.deleted_at is null
    and h.hidden_at is null
    and not exists (select 1 from public.hack_reports r where r.hack_id = h.id and r.user_id = me)
    and (
      select count(*) from public.hack_reports r
      where r.hack_id = h.id and r.created_at > coalesce(h.kept_at, '-infinity'::timestamptz)
    ) < private.hide_after_reports()
  order by h.created_at desc
  limit 200;
end;
$$;

-- Whether the signed-in user moderates, so the app shows the moderation page. Says nothing about anyone else.
create function public.am_i_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.moderators m where m.user_id = (select auth.uid()));
$$;

-- For the moderator: every post that was reported or hidden, and not deleted, most recently reported first, with the
-- author's username, the reports in all and since it was last kept, and whether it is hidden by hand or by reports.
create function public.moderation_queue()
returns table (
  id uuid,
  body text,
  city text,
  category text,
  link text,
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
    h.id, h.body, h.city, h.category, h.link, h.lang, h.created_at,
    p.username,
    count(r.hack_id),
    count(r.hack_id) filter (where r.created_at > coalesce(h.kept_at, '-infinity'::timestamptz)),
    h.hidden_at is not null,
    count(r.hack_id) filter (where r.created_at > coalesce(h.kept_at, '-infinity'::timestamptz))
      >= private.hide_after_reports(),
    h.kept_at,
    max(r.created_at)
  from public.hacks h
  left join public.public_profiles p on p.user_id = h.user_id
  left join public.hack_reports r on r.hack_id = h.id
  where h.deleted_at is null
  group by h.id, p.username
  having count(r.hack_id) > 0 or h.hidden_at is not null
  order by max(r.created_at) desc nulls last, h.created_at desc;
end;
$$;

-- The moderator's decision on a post: 'hide' takes it out of every feed; 'keep' brings it back and starts the report
-- count afresh (earlier reports no longer hide it for everyone, though each reporter still doesn't see it).
create function public.moderate_hack(p_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.acting_moderator();
  if p_action = 'hide' then
    update public.hacks h set hidden_at = now() where h.id = p_id;
  elsif p_action = 'keep' then
    update public.hacks h set hidden_at = null, kept_at = now() where h.id = p_id;
  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  if not found then
    raise exception 'no such post' using errcode = 'P0001', hint = 'not-found';
  end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.post_hack(text, text, text, text, text)',
    'public.delete_hack(uuid)',
    'public.vote_hack(uuid, boolean, text)',
    'public.report_hack(uuid)',
    'public.hacks_feed()',
    'public.am_i_moderator()',
    'public.moderation_queue()',
    'public.moderate_hack(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
