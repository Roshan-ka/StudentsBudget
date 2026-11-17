import { describe, expect, it, vi } from 'vitest';
import { weeksMayRecord } from './start-order';

// A build without the Supabase settings: starting the automatic sync runs nothing, but it has started.
vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => null }));

describe('visitAutoSync before and after the start (review B2, 17-11-2026)', () => {
  it('answers not-synced before AppInit starts it, so no week is recorded from unsynced data', async () => {
    const { visitAutoSync } = await import('./auto-sync');
    const early = await visitAutoSync('return');
    expect(early).toBe('not-synced');
    expect(weeksMayRecord(early)).toBe(false);
  });

  it('answers unlinked once started with no automatic sync to run', async () => {
    const { startAutoSync, visitAutoSync } = await import('./auto-sync');
    const stop = startAutoSync();
    expect(await visitAutoSync('open')).toBe('unlinked');
    stop();
  });
});
