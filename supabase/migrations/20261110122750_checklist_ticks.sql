-- The checklist for new students, chunk 3: the account's copy of the phone's ticks.
--
--   checklist_ticks  db.checklistTicks  (id: the checklist item's id)
--
-- A tick is a user-data row like a discount vote, with the same shape and the same rules as the tables of
-- 20261023121726_user_data.sql, as 20261026132206_sync.sql and 20261028150013_two_step_sign_in.sql left them:
-- - `data` is the Dexie row as JSON (`{ itemId, on }`), null for a tombstone (unticking), and `deleted_at` and `rev` are
--   the server's, set by private.stamp_sync;
-- - `user_id` comes from the session and cascades from auth.users, so deleting the account (delete_my_account) takes
--   every tick with it;
-- - signed-in owners select, insert and update their own rows, nobody deletes (deleting is writing a tombstone), and
--   `anon` gets nothing;
-- - the restrictive second-step policy holds on top;
-- - sync_pull, which lists its tables by name, is redefined here with this one added.
-- A schema change is a new migration; this one is never edited once applied.

create table public.checklist_ticks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null constraint checklist_ticks_id_check check (char_length(id) between 1 and 200),
  -- One row of the app's data: a JSON object of at most 64 kB, or null for a tombstone.
  data jsonb constraint checklist_ticks_data_check
    check (data is null or (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536)),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  rev bigint not null default 0,
  primary key (user_id, id),
  constraint checklist_ticks_tombstone_check check ((deleted_at is null) = (data is not null))
);

alter table public.checklist_ticks enable row level security;

-- Only signed-in users reach the table, and only through the policies below: no DELETE (a tombstone instead) and no
-- TRUNCATE, which would skip row-level security.
revoke all on table public.checklist_ticks from anon, authenticated;
grant select, insert, update on table public.checklist_ticks to authenticated;

create policy "owner reads" on public.checklist_ticks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner adds" on public.checklist_ticks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "owner changes" on public.checklist_ticks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "second step when the account has one" on public.checklist_ticks as restrictive to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' or not (select private.has_verified_factor()))
  with check ((select auth.jwt() ->> 'aal') = 'aal2' or not (select private.has_verified_factor()));

-- A pull reads one user's rows after a revision.
create index checklist_ticks_user_rev on public.checklist_ticks (user_id, rev);

-- BEFORE triggers fire in name order: stamp_sync, then stamp_updated_at, as on the other tables.
create trigger stamp_sync before insert or update on public.checklist_ticks
  for each row execute function private.stamp_sync();
create trigger stamp_updated_at before insert or update on public.checklist_ticks
  for each row execute function private.stamp_updated_at();

-- sync_pull as in 20261026132206_sync.sql, with checklist_ticks added. Same signature, so the app's call and the grants
-- stay; they are stated again below all the same. A table added later redefines it again, in its own migration.
create or replace function public.sync_pull(p_since bigint, p_limit integer)
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
    union all
    select 'checklist_ticks', r.id, r.data, r.deleted_at, r.rev from public.checklist_ticks r where r.rev > p_since
  ) c
  order by c.rev
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke all on function public.sync_pull(bigint, integer) from public, anon;
grant execute on function public.sync_pull(bigint, integer) to authenticated;
