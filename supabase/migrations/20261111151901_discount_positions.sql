-- Students' pins (discount map, chunk 7; docs/superpowers/plans/2026-11-11-discount-map.md): a discount added from the
-- app may carry a position, chosen on the map in its form, so it shows as a pin. Both or neither, and inside the box the
-- map covers: `REGENSBURG_BOX` (src/data/regensburg-box.ts) holds the same numbers, and its test reads them from here,
-- so change both together. The feed returns the position; the moderator's queue is unchanged.
--
-- 20261111101604_community_discounts.sql is applied, so its functions are replaced here, not edited. `post_discount`
-- takes two more parameters and the feed returns two more columns, which `create or replace` can't do: each is dropped
-- and made again. The new parameters default to null, so a call that names the first seven (the app before chunk 8)
-- still adds a discount, without a pin.

alter table public.community_discounts
  add column lat double precision,
  add column lng double precision,
  add constraint community_discounts_position_whole check ((lat is null) = (lng is null)),
  add constraint community_discounts_position_in_regensburg check (
    lat is null or (lat between 48.97 and 49.07 and lng between 12.0 and 12.2)
  );

drop function public.post_discount(text, text, text, text, text, text, text);

-- Adds a discount for the signed-in user and returns its id, as before, now with an optional position. It needs a
-- username first (hint 'needs-username') and allows 3 in any 24 hours, deleted ones included (hint 'daily-limit'). The
-- table's checks refuse a bad field (23514), a half position or one outside the box included. An empty address or
-- conditions is left out.
create function public.post_discount(
  p_place text,
  p_address text,
  p_offer text,
  p_conditions text,
  p_category text,
  p_link text,
  p_lang text,
  p_lat double precision default null,
  p_lng double precision default null
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
  insert into public.community_discounts (user_id, place, address, offer, conditions, category, link, lang, lat, lng)
  values (
    me,
    btrim(p_place),
    nullif(btrim(p_address), ''),
    btrim(p_offer),
    nullif(btrim(p_conditions), ''),
    p_category,
    btrim(p_link),
    p_lang,
    p_lat,
    p_lng
  )
  returning id into made;
  return made;
end;
$$;

drop function public.community_discounts_feed();

-- The newest 200 discounts the signed-in user may see, with the author's username, label and batch, whether it is the
-- user's own, and its position (null without a pin). Never a user id.
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
  mine boolean,
  lat double precision,
  lng double precision
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
    d.user_id = me,
    d.lat, d.lng
  from public.community_discounts d
  left join public.public_profiles p on p.user_id = d.user_id
  where private.discount_visible(d.id, me)
  order by d.created_at desc, d.id
  limit 200;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.post_discount(text, text, text, text, text, text, text, double precision, double precision)',
    'public.community_discounts_feed()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
