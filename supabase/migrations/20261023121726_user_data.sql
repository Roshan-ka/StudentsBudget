-- P2.1: the account's copy of the phone's data. One table per Dexie table the app saves to the account:
--
--   accounts        db.accounts        (id: the account id)
--   entries         db.entries         (id: the entry id)
--   plans           db.plan            (id: 'current')
--   guesses         db.guesses         (id: the category id)
--   manual_rates    db.fxRates         (manual rates only; id: the currency)
--   week_results    db.weekResults     (id: the week's Monday)
--   discount_votes  db.discountVotes   (id: the discount id)
--   profiles        db.profile         (id: 'current')
--
-- Every row is the Dexie row as JSON (`data`), checked by the app's zod schemas on the way in and out. A row belongs to
-- the user who wrote it: `user_id` comes from the session, and row-level security lets each user read, add, change and
-- delete only their own rows. Deleting a user deletes their rows. `anon` (signed out) gets nothing.
-- A schema change is a new migration; this one is never edited once applied.

create schema if not exists private;

-- The server's clock, not the phone's, says when a row last changed.
create function private.stamp_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'entries', 'plans', 'guesses', 'manual_rates', 'week_results', 'discount_votes', 'profiles'
  ] loop
    execute format(
      $sql$
      create table public.%1$I (
        user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
        id text not null check (char_length(id) between 1 and 200),
        -- One row of the app's data: a JSON object of at most 64 kB.
        data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536),
        updated_at timestamptz not null default now(),
        primary key (user_id, id)
      )
      $sql$,
      t
    );

    execute format('alter table public.%I enable row level security', t);

    -- Only signed-in users reach the table, and only through the four policies below. No TRUNCATE, which would skip
    -- row-level security.
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);

    execute format(
      'create policy "owner reads" on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "owner adds" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "owner changes" on public.%I for update to authenticated '
        || 'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "owner deletes" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t
    );

    execute format(
      'create trigger stamp_updated_at before insert or update on public.%I '
        || 'for each row execute function private.stamp_updated_at()',
      t
    );
  end loop;
end;
$$;
