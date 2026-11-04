import type { SupabaseClient } from '@supabase/supabase-js';
import type { IsoDate } from '@/lib/dates';

// What students confirmed about each discount, across every account (P2.6,
// docs/superpowers/plans/2026-11-04-shared-discount-confirmations.md): totals from `discount_confirmations()`, never
// who voted. Only a signed-in phone reads them; without them the list goes by this phone's own votes.

/** One discount's totals: the latest "still works" day anyone gave, and each kind of vote since the semester began. */
export type CommunityEntry = { lastWorks: IsoDate | null; works: number; outdated: number };

/** The totals by discount id. A discount nobody voted on has no entry. */
export type CommunityConfirmations = ReadonlyMap<string, CommunityEntry>;

type Row = { discount_id: string; last_works: string | null; works_since: number; outdated_since: number };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The totals since `since`, or null when they can't be read (offline, signed out, or the server refused). */
export async function readCommunity(supabase: SupabaseClient, since: IsoDate): Promise<CommunityConfirmations | null> {
  try {
    const { data, error } = await supabase.rpc('discount_confirmations', { p_since: since });
    if (error || !Array.isArray(data)) {
      if (error) console.error('StudentsBudget: could not read the discount confirmations', error);
      return null;
    }
    return new Map(
      (data as Row[]).map((row) => [
        row.discount_id,
        {
          lastWorks: typeof row.last_works === 'string' && ISO_DATE.test(row.last_works) ? row.last_works : null,
          works: Number(row.works_since) || 0,
          outdated: Number(row.outdated_since) || 0,
        },
      ]),
    );
  } catch (thrown) {
    console.error('StudentsBudget: could not read the discount confirmations', thrown);
    return null;
  }
}
