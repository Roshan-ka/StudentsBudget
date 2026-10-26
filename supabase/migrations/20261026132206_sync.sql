-- P2.2: what live sync needs from the user-data tables (migration 20261023121726_user_data.sql).
--
-- Revisions. Every write of a user's row takes the next number of that user's counter (private.sync_meta) and stores it
-- in the row's `rev`. A phone remembers the highest revision it has seen and pulls everything after it (sync_pull).
-- The counter row stays locked until the writing transaction ends, so a user's revisions become visible in order and a
-- pull never skips one. Numbers can be skipped (an upsert that ends up as an update takes two); only the order counts.
--
-- Deletion markers. A deleted row stays, with `data` null and `deleted_at` set (a tombstone), so other phones learn of
-- the delete when they pull. Signed-in users can no longer delete rows; deleting the user still removes them all.
-- Writing data to a tombstone's id brings the row back. `deleted_at` is the server's time, set by the trigger whatever
-- the phone sends. The app writes tombstones as upserts, so every write takes the counter before the row and two
-- phones of one user cannot lock the two in opposite orders.
--
-- A BEFORE trigger added later that rewrites `data` must be named to sort before `stamp_sync` (triggers fire in name
-- order), so `deleted_at` is decided on the final data.

create table private.sync_meta (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rev bigint not null default 0
);

-- Only its owner (and so the trigger below) reaches it; a counter set back would make pulls skip changes.
alter table private.sync_meta enable row level security;

-- Runs as its owner: signed-in users have no access to private.sync_meta, only this trigger does.
create function private.stamp_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Row-level security checks the row only after this trigger. A signed-in caller writing under another user's id is
  -- refused here first, so it neither touches that user's counter nor learns from the error whether the id exists.
  if current_setting('role', true) in ('authenticated', 'anon') and new.user_id is distinct from auth.uid() then
    raise exception 'new row violates row-level security policy for table "%"', tg_table_name
      using errcode = '42501';
  end if;

  insert into private.sync_meta as meta (user_id, rev)
  values (new.user_id, 1)
  on conflict (user_id) do update set rev = meta.rev + 1
  returning meta.rev into new.rev;

  new.deleted_at := case
    when new.data is not null then null
    -- Already a tombstone: it stays deleted since when it was deleted.
    when tg_op = 'UPDATE' and old.data is null then old.deleted_at
    else now()
  end;
  return new;
end;
$$;

revoke all on function private.stamp_sync() from public;

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'entries', 'plans', 'guesses', 'manual_rates', 'week_results', 'discount_votes', 'profiles'
  ] loop
    -- A tombstone has no data. The P2.1 check on `data` (named <table>_data_check) is replaced by one that allows that.
    execute format('alter table public.%I drop constraint %I', t, t || '_data_check');
    execute format('alter table public.%I alter column data drop not null', t);
    execute format('alter table public.%I add column deleted_at timestamptz', t);
    execute format('alter table public.%I add column rev bigint not null default 0', t);
    execute format(
      'alter table public.%I add constraint %I check '
        || '(data is null or (jsonb_typeof(data) = ''object'' and octet_length(data::text) <= 65536))',
      t,
      t || '_data_check'
    );
    execute format(
      'alter table public.%I add constraint %I check ((deleted_at is null) = (data is not null))',
      t,
      t || '_tombstone_check'
    );

    -- A pull reads one user's rows after a revision.
    execute format('create index %I on public.%I (user_id, rev)', t || '_user_rev', t);

    execute format(
      'create trigger stamp_sync before insert or update on public.%I '
        || 'for each row execute function private.stamp_sync()',
      t
    );

    -- Deleting becomes writing a tombstone.
    execute format('drop policy "owner deletes" on public.%I', t);
    execute format('revoke delete on table public.%I from authenticated', t);

    -- Rows saved before this migration get their revisions now, so a first pull from 0 finds them.
    execute format('update public.%I set data = data', t);
  end loop;
end;
$$;

-- Every change of the signed-in user after revision `p_since`, oldest first, at most `p_limit` (up to 1000) rows: the
-- table it belongs to, its id, its data (null for a tombstone), when it was deleted, and its revision. It runs as the
-- caller, so row-level security keeps it to the caller's own rows.
create function public.sync_pull(p_since bigint, p_limit integer)
returns table (tbl text, id text, data jsonb, deleted_at timestamptz, rev bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.tbl, c.id, c.data, c.deleted_at, c.rev
  from (
    select 'accounts' as tbl, r.id, r.data, r.deleted_at, r.rev from public.accounts r where r.rev > p_since
    union all
    select 'entries', r.id, r.data, r.deleted_at, r.rev from public.entries r where r.rev > p_since
    union all
    select 'plans', r.id, r.data, r.deleted_at, r.rev from public.plans r where r.rev > p_since
    union all
    select 'guesses', r.id, r.data, r.deleted_at, r.rev from public.guesses r where r.rev > p_since
    union all
    select 'manual_rates', r.id, r.data, r.deleted_at, r.rev from public.manual_rates r where r.rev > p_since
    union all
    select 'week_results', r.id, r.data, r.deleted_at, r.rev from public.week_results r where r.rev > p_since
    union all
    select 'discount_votes', r.id, r.data, r.deleted_at, r.rev from public.discount_votes r where r.rev > p_since
    union all
    select 'profiles', r.id, r.data, r.deleted_at, r.rev from public.profiles r where r.rev > p_since
  ) c
  order by c.rev
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke all on function public.sync_pull(bigint, integer) from public, anon;
grant execute on function public.sync_pull(bigint, integer) to authenticated;
