-- The AI phase, chunk 1 (docs/superpowers/plans/2026-11-09-ai-phase-1.md): each account's daily allowance for the
-- three AI features, and one for all accounts together, so the model's bill has a ceiling below Roshan's monthly
-- spend limit.
--
-- The `ai` Edge Function calls `take_ai_allowance` with the caller's own token before it asks the model. The function
-- refuses a signed-out caller and an account that owes its authenticator code (as every user write does), counts the
-- caller's uses of the feature in the last 24 hours and everyone's, records this use and says how many are left. A
-- try counts even when the model then fails. A moderator has no limit: the use is recorded, nothing is refused.
--
-- The uses live in `private`: nobody signed in reads or writes them, and they go with the account.

create table private.ai_uses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('quick-add', 'ask', 'setup')),
  used_at timestamptz not null default now()
);

create index ai_uses_by_user on private.ai_uses (user_id, feature, used_at);
create index ai_uses_by_feature on private.ai_uses (feature, used_at);

alter table private.ai_uses enable row level security;
revoke all on table private.ai_uses from public, anon, authenticated;

-- Uses of a feature one account may make in any 24 hours: null for a feature the app doesn't have. A new migration
-- replaces this function to change them.
create function private.ai_own_limit(p_feature text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_feature when 'quick-add' then 50 when 'ask' then 6 when 'setup' then 15 end;
$$;

-- Uses of a feature all accounts together may make in any 24 hours, moderators' included (they cost the same).
create function private.ai_everyone_limit(p_feature text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_feature when 'quick-add' then 3000 when 'ask' then 300 when 'setup' then 300 end;
$$;

-- Only take_ai_allowance calls these (two_step.test.sql holds what authenticated may run in private).
revoke all on function private.ai_own_limit(text) from public, anon, authenticated;
revoke all on function private.ai_everyone_limit(text) from public, anon, authenticated;

-- Takes one use of an AI feature ('quick-add', 'ask' or 'setup') for the signed-in user and returns how many are left
-- in the last 24 hours, or null for a moderator, who has no limit. Refused, with a hint the function reads:
--   signed out ('signed-out'), an account with two-step sign-in before its code ('second-step'), the account's own
--   allowance used up ('daily-limit'), everyone's used up ('busy'). An unknown feature is 22023.
-- One call at a time per feature (a transaction lock), so parallel calls never pass a limit together. Uses older than
-- two days are pruned on the way.
create function public.take_ai_allowance(p_feature text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid;
  own_limit int := private.ai_own_limit(p_feature);
  everyone_limit int := private.ai_everyone_limit(p_feature);
  own_uses int;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501', hint = 'signed-out';
  end if;
  -- The second-step rule stays in acting_user, the one place every write asks; only its hint is added here.
  begin
    me := private.acting_user();
  exception when insufficient_privilege then
    raise exception 'the second step is owed' using errcode = '42501', hint = 'second-step';
  end;
  if own_limit is null then
    raise exception 'unknown feature %', p_feature using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('take_ai_allowance'), hashtext(p_feature));
  delete from private.ai_uses u where u.feature = p_feature and u.used_at < now() - interval '2 days';

  if exists (select 1 from private.moderators m where m.user_id = me) then
    insert into private.ai_uses (user_id, feature) values (me, p_feature);
    return null;
  end if;

  select count(*) into own_uses from private.ai_uses u
  where u.user_id = me and u.feature = p_feature and u.used_at > now() - interval '1 day';
  if own_uses >= own_limit then
    raise exception 'the daily allowance is used up' using errcode = 'P0001', hint = 'daily-limit';
  end if;
  if (select count(*) from private.ai_uses u where u.feature = p_feature and u.used_at > now() - interval '1 day')
      >= everyone_limit then
    raise exception 'everyone''s daily allowance is used up' using errcode = 'P0001', hint = 'busy';
  end if;

  insert into private.ai_uses (user_id, feature) values (me, p_feature);
  return own_limit - own_uses - 1;
end;
$$;

revoke all on function public.take_ai_allowance(text) from public, anon;
grant execute on function public.take_ai_allowance(text) to authenticated;
