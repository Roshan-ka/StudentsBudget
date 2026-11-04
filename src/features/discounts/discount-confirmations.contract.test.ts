import { describe, expect, it } from 'vitest';
import { newId } from '@/lib/new-id';
import { confirmedUser, MAIL_URL, STACK_KEY, STACK_URL, stackClient } from '@/sync/contract-users';
import { supabaseStore } from '@/sync/store';

// Shared discount confirmations (P2.6, docs/superpowers/plans/2026-11-04-shared-discount-confirmations.md) against the
// local Supabase stack: votes written by two accounts through the app's own store, totals read by a third. pgTAP
// (discount_confirmations.test.sql) covers tombstones, bad dates and future days. Runs with `npm run test:contract`.

/** One row of `discount_confirmations`, as PostgREST returns it. */
type Totals = { discount_id: string; last_works: string | null; works_since: number; outdated_since: number };

describe.runIf(Boolean(STACK_URL && STACK_KEY && MAIL_URL))('shared discount confirmations against a real Supabase stack (P2.6)', () => {
  it('totals every account’s votes per discount, and still shows nobody the votes themselves', async () => {
    const voterA = await confirmedUser();
    const voterB = await confirmedUser();
    const reader = await confirmedUser();
    // Ids of this run only: the local stack keeps earlier runs' votes.
    const works = `contract-${newId()}`;
    const outdated = `contract-${newId()}`;
    await supabaseStore(voterA).upsert('discount_votes', [
      { id: works, data: { discountId: works, vote: 'works', on: '2026-10-30' } },
    ]);
    await supabaseStore(voterB).upsert('discount_votes', [
      { id: works, data: { discountId: works, vote: 'works', on: '2026-10-20' } },
      { id: outdated, data: { discountId: outdated, vote: 'outdated', on: '2026-10-25' } },
    ]);

    const answer = await reader.rpc('discount_confirmations', { p_since: '2026-10-01' });
    expect(answer.error).toBeNull();
    const rows = answer.data as Totals[];
    expect(rows.find((row) => row.discount_id === works)).toEqual({
      discount_id: works,
      last_works: '2026-10-30',
      works_since: 2,
      outdated_since: 0,
    });
    expect(rows.find((row) => row.discount_id === outdated)).toEqual({
      discount_id: outdated,
      last_works: null,
      works_since: 0,
      outdated_since: 1,
    });

    // The totals open nothing else: the reader's own table is still only its own.
    expect(await supabaseStore(reader).listIds('discount_votes')).toEqual([]);
  });

  it('answers only a signed-in user', async () => {
    const answer = await stackClient().rpc('discount_confirmations', { p_since: '2026-10-01' });
    expect(answer.data).toBeNull();
    expect(answer.error).not.toBeNull();
  });
});
