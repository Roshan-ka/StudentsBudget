-- Guess vs. reality's guesses go (review F4, Roshan, 17-11-2026). Nothing has read or written them since 05-11-2026,
-- and the app no longer keeps them: Dexie version 7 drops the phone's table, the backup writes version 6 without
-- them, and a pull leaves out any of their rows it still meets (RETIRED_TABLES, src/sync/tables.ts). Their rows here
-- were never read by anyone.
--
-- sync_pull first, as in 20261110134042_plan_months.sql without the guesses, so it never names a table that is gone.
-- Same signature, so the app's call and the grants stay; they are stated again below all the same.
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

-- Then the table, with its rows, its policies and its triggers.
drop table public.guesses;
