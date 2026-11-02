-- P2.2 chunk 8: a plan never takes a recurring schedule's watermark back.
--
-- Each income and fixed line of the plan may carry a schedule whose `postedThrough` says that every period up to that
-- day has posted its entry (src/db/types.ts). With sync, an older copy of the plan can reach the account after a newer
-- one: a phone that was offline, or that changed the plan before it pulled. Its earlier watermark would make the next
-- phone post a period's entry again, or bring back one that was deleted. So on every update of a plan, each schedule
-- keeps the later of the stored and the incoming `postedThrough`; everything else in the plan is the incoming one.
--
-- The trigger is named to sort before stamp_sync: BEFORE triggers fire in name order, and stamp_sync decides
-- `deleted_at` on the final data.

-- `lines` (an array of plan lines) with each schedule's postedThrough raised to the one `kept` holds for its id, when
-- that one is later. IsoDate strings (YYYY-MM-DD) compare as dates. Anything that isn't an array comes back as it is.
create function private.with_later_watermarks(lines jsonb, kept jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when lines is null or jsonb_typeof(lines) <> 'array' then lines
    else coalesce(
      (select jsonb_agg(
                case
                  when jsonb_typeof(line -> 'schedule') = 'object'
                    and (kept ->> (line -> 'schedule' ->> 'id')) > (line -> 'schedule' ->> 'postedThrough')
                  then jsonb_set(line, '{schedule,postedThrough}', kept -> (line -> 'schedule' ->> 'id'))
                  else line
                end
                order by n)
       from jsonb_array_elements(lines) with ordinality as e(line, n)),
      '[]'::jsonb)
  end
$$;

-- Security definer, so the helper above needs no grant to signed-in users: they reach nothing in private but the
-- factor check (see 20261028150013_two_step_sign_in.sql).
create function private.keep_watermarks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kept jsonb;
begin
  -- A tombstone, or a plan written over a tombstone, has no watermarks to keep.
  if old.data is null or new.data is null then
    return new;
  end if;

  select coalesce(jsonb_object_agg(schedule ->> 'id', schedule -> 'postedThrough'), '{}'::jsonb)
  into kept
  from (
    select line -> 'schedule' as schedule
    from jsonb_array_elements(
      case when jsonb_typeof(old.data -> 'incomes') = 'array' then old.data -> 'incomes' else '[]'::jsonb end
        || case when jsonb_typeof(old.data -> 'fixed') = 'array' then old.data -> 'fixed' else '[]'::jsonb end
    ) as e(line)
  ) schedules
  where jsonb_typeof(schedule) = 'object'
    and schedule ->> 'id' is not null
    and jsonb_typeof(schedule -> 'postedThrough') = 'string';

  if new.data ? 'incomes' then
    new.data := jsonb_set(new.data, '{incomes}', private.with_later_watermarks(new.data -> 'incomes', kept));
  end if;
  if new.data ? 'fixed' then
    new.data := jsonb_set(new.data, '{fixed}', private.with_later_watermarks(new.data -> 'fixed', kept));
  end if;
  return new;
end;
$$;

-- A trigger fires without its function's execute right, which Postgres checks only when the trigger is created.
revoke all on function private.with_later_watermarks(jsonb, jsonb) from public;
revoke all on function private.keep_watermarks() from public;

create trigger keep_watermarks
before update on public.plans
for each row execute function private.keep_watermarks();
