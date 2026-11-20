import { describe, expect, it, vi } from 'vitest';
import { startAutoSync, visitAutoSync } from './auto-sync';
import { weeksMayRecord } from './start-order';

// A build without the Supabase settings: starting the automatic sync runs nothing, but it has started. vi.mock is
// hoisted above the imports, so the module is imported once, as the file loads: an import inside the first test counted
// against its 5 s and timed it out on a busy laptop (20-11-2026). The first test still runs before anything starts it.
vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => null }));

describe('visitAutoSync before and after the start (review B2, 17-11-2026)', () => {
  it('answers not-synced before AppInit starts it, so no week is recorded from unsynced data', async () => {
    const early = await visitAutoSync('return');
    expect(early).toBe('not-synced');
    expect(weeksMayRecord(early)).toBe(false);
  });

  it('answers unlinked once started with no automatic sync to run', async () => {
    const stop = startAutoSync();
    expect(await visitAutoSync('open')).toBe('unlinked');
    stop();
  });
});
