-- Discounts added from the app (community, chunk 4; docs/superpowers/plans/2026-11-11-community.md): a student's
-- discount, with its source link, shown at once to every signed-in student and hidden by reports, as a hack is
-- (20261105110007_hacks.sql). The tables stay owner-only with the second-step policy and no direct writes; every write
-- goes through a function below; others' discounts are read only through `community_discounts_feed` and
-- `discount_queue`, which return usernames, never a user id.
--
-- Votes on them are the same as on the app's own discounts: each account's `discount_votes` row by the discount's id
-- (here the uuid as text), and everyone's totals from `discount_confirmations` (20261104142424).
--
-- A discount is hidden for everyone by the moderator, or once `private.hide_after_reports()` accounts reported it since
-- the moderator last kept it, and at once for each account that reported it. It and its reports go with the account
-- that made them.

create table public.community_discounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place text not null check (char_length(place) between 2 and 80),
  address text check (char_length(address) between 1 and 120),
  offer text not null check (char_length(offer) between 3 and 120),
  conditions text check (char_length(conditions) between 1 and 300),
  -- An app category id; the app checks which (src/data/categories.ts), the database only its shape.
  category text not null check (category ~ '^[a-z][a-z-]{1,29}$'),
  -- The page that states the offer: a discount always names where it comes from.
  link text not null check (link ~ '^https://\S+$' and char_length(link) <= 300),
  city text not null default 'regensburg' check (city = 'regensburg'),
  -- The language it was written in, as the app's language codes.
  lang text not null check (lang ~ '^[a-z]{2}$'),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  hidden_at timestamptz,
  kept_at timestamptz
);

create index community_discounts_newest on public.community_discounts (created_at desc);
create index community_discounts_by_author on public.community_discounts (user_id, created_at);

-- One report per account per discount.
create table public.community_discount_reports (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  discount_id uuid not null references public.community_discounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, discount_id)
);

create index community_discount_reports_by_discount on public.community_discount_reports (discount_id, created_at);

do $$
declare
  t text;
begin
  foreach t in array array['community_discounts', 'community_discount_reports'] loop
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

-- Whether `me` may see the discount `p_id`: not deleted, not hidden by the moderator, not reported by `me`, and not
-- hidden by reports.
create function private.discount_visible(p_id uuid, me uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.community_discounts d
    where d.id = p_id
      and d.deleted_at is null
      and d.hidden_at is null
      and not exists (select 1 from public.community_discount_reports r where r.discount_id = d.id and r.user_id = me)
      and (
        select count(*) from public.community_discount_reports r
        where r.discount_id = d.id and r.created_at > coalesce(d.kept_at, '-infinity'::timestamptz)
      ) < private.hide_after_reports()
  );
$$;

-- Only the functions below call it (two_step.test.sql holds what authenticated may run in private).
revoke all on function private.discount_visible(uuid, uuid) from public, anon, authenticated;

-- Adds a discount for the signed-in user and returns its id. It needs a username first (hint 'needs-username'), and
-- allows 3 in any 24 hours, deleted ones included (hint 'daily-limit'). The table's checks refuse a bad field
-- (23514). An empty address or conditions is left out.
create function public.post_discount(
  p_place text,
  p_address text,
  p_offer text,
  p_conditions text,
  p_category text,
  p_link text,
  p_lang text
)
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
  if (
    select count(*) from public.community_discounts d where d.user_id = me and d.created_at > now() - interval '1 day'
  ) >= 3 then
    raise exception 'three discounts a day' using errcode = 'P0001', hint = 'daily-limit';
  end if;
  insert into public.community_discounts (user_id, place, address, offer, conditions, category, link, lang)
  values (
    me,
    btrim(p_place),
    nullif(btrim(p_address), ''),
    btrim(p_offer),
    nullif(btrim(p_conditions), ''),
    p_category,
    btrim(p_link),
    p_lang
  )
  returning id into made;
  return made;
end;
$$;

-- Deletes one of the signed-in user's own discounts (it stays as a row with `deleted_at`, out of every list). Someone
-- else's discount, or none, is refused (hint 'not-found'); deleting a deleted one again changes nothing.
create function public.delete_discount(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.acting_user();
begin
  if not exists (select 1 from public.community_discounts d where d.id = p_id and d.user_id = me) then
    raise exception 'no such discount of yours' using errcode = 'P0001', hint = 'not-found';
  end if;
  update public.community_discounts d set deleted_at = now() where d.id = p_id and d.deleted_at is null;
end;
$$;

-- Reports a discount: it leaves the reporter's list at once, and everyone's once enough accounts reported it. Once per
-- account per discount; not one's own (hint 'own-post'); a discount that is gone is refused (hint 'not-found').
create function public.report_discount(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.acting_user();
  author uuid;
begin
  select d.user_id into author from public.community_discounts d where d.id = p_id and d.deleted_at is null;
  if author is null then
    raise exception 'no such discount' using errcode = 'P0001', hint = 'not-found';
  end if;
  if author = me then
    raise exception 'not your own discount' using errcode = 'P0001', hint = 'own-post';
  end if;
  insert into public.community_discount_reports (user_id, discount_id) values (me, p_id) on conflict do nothing;
end;
$$;

-- The newest 200 discounts the signed-in user may see, with the author's username, label and batch and whether it is
-- the user's own. Never a user id.
create function public.community_discounts_feed()
returns table (
  id uuid,
  place text,
  address text,
  offer text,
  conditions text,
  category text,
  link text,
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
  return query
  select
    d.id, d.place, d.address, d.offer, d.conditions, d.category, d.link, d.lang, d.created_at,
    p.username, p.label, p.batch,
    d.user_id = me
  from public.community_discounts d
  left join public.public_profiles p on p.user_id = d.user_id
  where private.discount_visible(d.id, me)
  order by d.created_at desc, d.id
  limit 200;
end;
$$;

-- For the moderator: every discount that was reported or hidden, and not deleted, most recently reported first, with
-- the author's username, the reports in all and since it was last kept, and whether it is hidden by hand or by
-- reports.
create function public.discount_queue()
returns table (
  id uuid,
  place text,
  offer text,
  conditions text,
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
    d.id, d.place, d.offer, d.conditions, d.link, d.lang, d.created_at,
    p.username,
    count(r.discount_id),
    count(r.discount_id) filter (where r.created_at > coalesce(d.kept_at, '-infinity'::timestamptz)),
    d.hidden_at is not null,
    count(r.discount_id) filter (where r.created_at > coalesce(d.kept_at, '-infinity'::timestamptz))
      >= private.hide_after_reports(),
    d.kept_at,
    max(r.created_at)
  from public.community_discounts d
  left join public.public_profiles p on p.user_id = d.user_id
  left join public.community_discount_reports r on r.discount_id = d.id
  where d.deleted_at is null
  group by d.id, p.username
  having count(r.discount_id) > 0 or d.hidden_at is not null
  order by max(r.created_at) desc nulls last, d.created_at desc;
end;
$$;

-- The moderator's decision on a discount: 'hide' takes it out of every list; 'keep' brings it back and starts the
-- report count afresh (each reporter still doesn't see it).
create function public.moderate_discount(p_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.acting_moderator();
  if p_action = 'hide' then
    update public.community_discounts d set hidden_at = now() where d.id = p_id;
  elsif p_action = 'keep' then
    update public.community_discounts d set hidden_at = null, kept_at = now() where d.id = p_id;
  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  if not found then
    raise exception 'no such discount' using errcode = 'P0001', hint = 'not-found';
  end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.post_discount(text, text, text, text, text, text, text)',
    'public.delete_discount(uuid)',
    'public.report_discount(uuid)',
    'public.community_discounts_feed()',
    'public.discount_queue()',
    'public.moderate_discount(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
