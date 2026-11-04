-- P2.6: what students confirmed about each discount (docs/superpowers/plans/2026-11-04-shared-discount-confirmations.md).
-- Each account keeps its own votes in discount_votes (one row per discount id), readable only by its owner. This
-- returns totals per discount across every account and nothing else: no user id and no single vote, so nobody learns
-- who voted. It runs as its owner, which row-level security doesn't limit, and is asked by signed-in users only.

-- A vote's day as a date, or null for text that isn't a YYYY-MM-DD date, so one bad row is skipped rather than failing
-- every caller. Only discount_confirmations calls it.
create function private.date_or_null(p_text text)
returns date
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_text is null or p_text !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return p_text::date;
exception when others then
  return null;
end;
$$;

revoke all on function private.date_or_null(text) from public, anon, authenticated;

-- Per discount id, over every live vote (tombstones left out): the latest "still works" day (a day after today, from
-- a phone clock that ran ahead, counts as today), and how many "still works" and "doesn't work anymore" votes are
-- dated on or after `p_since`.
create function public.discount_confirmations(p_since date)
returns table (discount_id text, last_works date, works_since bigint, outdated_since bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.discount_id,
    max(least(v.on_date, current_date)) filter (where v.vote = 'works'),
    count(*) filter (where v.vote = 'works' and least(v.on_date, current_date) >= p_since),
    count(*) filter (where v.vote = 'outdated' and least(v.on_date, current_date) >= p_since)
  from (
    select r.id as discount_id, r.data ->> 'vote' as vote, private.date_or_null(r.data ->> 'on') as on_date
    from public.discount_votes r
    where r.data is not null
  ) v
  where v.on_date is not null and v.vote in ('works', 'outdated')
  group by v.discount_id
  order by v.discount_id;
$$;

revoke all on function public.discount_confirmations(date) from public, anon;
grant execute on function public.discount_confirmations(date) to authenticated;
