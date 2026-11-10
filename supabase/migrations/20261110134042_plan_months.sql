-- Plan history, chunk 3 (docs/superpowers/plans/2026-11-10-plan-history.md): the account's copy of the phone's months.
--
--   plan_months  db.planMonths  (id: the month, YYYY-MM)
--
-- A month's plan is a user-data row like a checklist tick (20261110122750_checklist_ticks.sql), with the same shape and
-- rules as the tables of 20261023121726_user_data.sql, as 20261026132206_sync.sql and
-- 20261028150013_two_step_sign_in.sql left them:
-- - `data` is the Dexie row as JSON (`PlanMonth`: the month and its plan's money parts, lines without schedules), null
--   for a tombstone, and `deleted_at` and `rev` are the server's, set by private.stamp_sync;
-- - `user_id` comes from the session and cascades from auth.users, so deleting the account (delete_my_account) takes
--   every month with it;
-- - signed-in owners select, insert and update their own rows, nobody deletes (deleting is writing a tombstone), and
--   `anon` gets nothing;
-- - the restrictive second-step policy holds on top;
-- - sync_pull, which lists its tables by name, is redefined here with this one added.
-- The month rows hold no schedules, so keep_watermarks (plans only) has nothing to keep here.
-- A schema change is a new migration; this one is never edited once applied.

create table public.plan_months (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null constraint plan_months_id_check check (char_length(id) between 1 and 200),
  -- One row of the app's data: a JSON object of at most 64 kB, or null for a tombstone.
  data jsonb constraint plan_months_data_check
    check (data is null or (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536)),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  rev bigint not null default 0,
  primary key (user_id, id),
  constraint plan_months_tombstone_check check ((deleted_at is null) = (data is not null))
);

alter table public.plan_months enable row level security;

-- Only signed-in users reach the table, and only through the policies below: no DELETE (a tombstone instead) and no
-- TRUNCATE, which would skip row-level security.
revoke all on table public.plan_months from anon, authenticated;
grant select, insert, update on table public.plan_months to authenticated;

create policy "owner reads" on public.plan_months
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner adds" on public.plan_months
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "owner changes" on public.plan_months
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "second step when the account has one" on public.plan_months as restrictive to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' or not (select private.has_verified_factor()))
  with check ((select auth.jwt() ->> 'aal') = 'aal2' or not (select private.has_verified_factor()));

-- A pull reads one user's rows after a revision.
create index plan_months_user_rev on public.plan_months (user_id, rev);

-- BEFORE triggers fire in name order: stamp_sync, then stamp_updated_at, as on the other tables.
create trigger stamp_sync before insert or update on public.plan_months
  for each row execute function private.stamp_sync();
create trigger stamp_updated_at before insert or update on public.plan_months
  for each row execute function private.stamp_updated_at();

-- sync_pull as in 20261110122750_checklist_ticks.sql, with plan_months added. Same signature, so the app's call and the
-- grants stay; they are stated again below all the same. A table added later redefines it again, in its own migration.
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
    union all
    select 'plan_months', r.id, r.data, r.deleted_at, r.rev from public.plan_months r where r.rev > p_since
  ) c
  order by c.rev
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke all on function public.sync_pull(bigint, integer) from public, anon;
grant execute on function public.sync_pull(bigint, integer) to authenticated;
