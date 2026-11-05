-- The hacks feed, chunk 1 (docs/superpowers/plans/2026-11-05-hacks-feed.md): the name a student posts under. One row per
-- user: a unique @username, a label (Student, Graduate or Alumni) and an optional batch year. Other students will see
-- them on posts, but only through the feed's functions (chunk 3), never by reading this table: like the user-data
-- tables, each user reads and writes only their own row, and the row goes with the user.
--
-- Sign-up sends the username, label and batch as user metadata; a trigger on auth.users copies them here. A username
-- that is malformed, reserved or already taken is skipped instead of failing the sign-up, and the app asks for one
-- later. Before signing up, the app asks `username_available`, which anyone may call.
--
-- The username rule (3 to 20 of a-z, 0-9 and _, not reserved) is written twice: in the table's check and in
-- `username_available`. Change both together; public_profiles.test.sql tests them alike.

create table public.public_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username text not null unique check (
    username ~ '^[a-z0-9_]{3,20}$'
    and username not in ('admin', 'administrator', 'moderator', 'mod', 'studentsbudget', 'support', 'system')
  ),
  label text check (label in ('student', 'graduate', 'alumni')),
  batch smallint check (batch between 2000 and 2100),
  updated_at timestamptz not null default now()
);

alter table public.public_profiles enable row level security;

-- Signed-in users only, through the policies below. No delete: the row goes with the account (cascade).
revoke all on table public.public_profiles from anon, authenticated;
grant select, insert, update on table public.public_profiles to authenticated;

create policy "owner reads" on public.public_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owner adds" on public.public_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "owner changes" on public.public_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- As on every user table (20261028150013_two_step_sign_in.sql): an account with two-step sign-in needs the code first.
create policy "second step when the account has one" on public.public_profiles as restrictive to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' or not (select private.has_verified_factor()))
  with check ((select auth.jwt() ->> 'aal') = 'aal2' or not (select private.has_verified_factor()));

create trigger stamp_updated_at before insert or update on public.public_profiles
  for each row execute function private.stamp_updated_at();

-- Copies the sign-up's username, label and batch into public_profiles. It never fails a sign-up: a username that
-- breaks the rule or is taken leaves the user without a row, a label or batch that isn't valid is left empty, and any
-- other error is swallowed. It runs as its owner, since the sign-up runs as the auth server's role.
create function private.profile_from_sign_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := meta ->> 'username';
  wanted_label text := meta ->> 'label';
  wanted_batch text := meta ->> 'batch';
begin
  if wanted is null or not public.username_available(wanted) then
    return new;
  end if;
  insert into public.public_profiles (user_id, username, label, batch)
  values (
    new.id,
    wanted,
    case when wanted_label in ('student', 'graduate', 'alumni') then wanted_label end,
    -- Nested, so the cast only ever sees four digits (the order inside an `and` isn't guaranteed).
    case when wanted_batch ~ '^\d{4}$' then
      case when wanted_batch::int between 2000 and 2100 then wanted_batch::smallint end
    end
  )
  on conflict do nothing;
  return new;
exception when others then
  return new;
end;
$$;

-- A trigger function only: nobody calls it (two_step.test.sql holds what authenticated may run in private).
revoke all on function private.profile_from_sign_up() from public, anon, authenticated;

create trigger profile_from_sign_up after insert on auth.users
  for each row execute function private.profile_from_sign_up();

-- Whether a username may still be taken: it follows the rule and nobody has it. Anyone may ask, signed out too,
-- because sign-up asks before the account exists. It says only yes or no, never whose a name is.
create function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_username ~ '^[a-z0-9_]{3,20}$'
    and p_username not in ('admin', 'administrator', 'moderator', 'mod', 'studentsbudget', 'support', 'system')
    and not exists (select 1 from public.public_profiles p where p.username = p_username);
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
