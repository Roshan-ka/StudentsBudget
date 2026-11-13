-- The Groq switch, chunk 5 (docs/superpowers/plans/2026-11-13-groq-free-plan.md): the AI features' daily allowances,
-- fitted to Groq's free plan. Its limits count per model and organisation: 1,000 requests and 200,000 tokens a day,
-- 8,000 tokens a minute (console.groq.com/docs/rate-limits, read 13-11-2026). Quick add runs on gpt-oss-20b, Ask and
-- the setup chat on gpt-oss-120b, so each model's day is shared only by its own features.
--
--   quick add: 30 lines per account (was 50), 120 for everyone (was 3,000): about 156,000 tokens a day at a typical
--              1,300 a line.
--   Ask:       6 questions per account (as before), 36 for everyone (was 300): about 148,000 tokens a day at a typical
--              4,100 a question.
--   setup:     0 (was 15 and 300): the setup chat is off on the free plan (Roshan, 13-11-2026). An old or crafted call
--              is refused with 'daily-limit' before any tokens; a moderator, who has no limit, can still try it in a
--              build with NEXT_PUBLIC_AI_SETUP_CHAT.
--
-- src/features/ai/server/limits.test.ts reads these numbers and holds each model's day to 80 % of the plan's tokens.
-- A paid plan raises them in a new migration. `create or replace` keeps both functions' owner and privileges: only
-- take_ai_allowance calls them.

create or replace function private.ai_own_limit(p_feature text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_feature when 'quick-add' then 30 when 'ask' then 6 when 'setup' then 0 end;
$$;

create or replace function private.ai_everyone_limit(p_feature text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_feature when 'quick-add' then 120 when 'ask' then 36 when 'setup' then 0 end;
$$;

revoke all on function private.ai_own_limit(text) from public, anon, authenticated;
revoke all on function private.ai_everyone_limit(text) from public, anon, authenticated;
