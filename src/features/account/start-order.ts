import type { VisitResult } from '@/sync/auto-runner';

// The start order of a visit (automatic sync, chunk 5, docs/superpowers/plans/2026-11-10-automatic-sync.md): on a
// linked phone the sync goes first, so the rates, the fixed costs and income that are due and the weeks that are over
// start from what the account holds. A sync that takes long holds the rest back for at most `SYNC_FIRST_CAP`; the
// weeks wait for it whatever it takes, and are recorded only when it succeeded, or on a phone with no link, so two
// phones never record one week differently.

/** How long a visit's sync holds back the rates and the posting. */
export const SYNC_FIRST_CAP = 8_000;

export type StartSteps = {
  rates: () => Promise<void>;
  recurring: () => Promise<void>;
  weeks: () => Promise<void>;
};

export type StartClock = {
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

/** Whether a visit's sync lets this phone record the weeks that are over. */
export function weeksMayRecord(result: VisitResult): boolean {
  return result === 'synced' || result === 'unlinked';
}

/** Runs one visit's steps in the start order; `visit` is the visit's sync (`visitAutoSync`). */
export async function inStartOrder(visit: Promise<VisitResult>, steps: StartSteps, clock: StartClock): Promise<void> {
  const result = visit.catch((): VisitResult => 'not-synced');
  let timer: unknown = null;
  const cap = new Promise<void>((resolve) => {
    timer = clock.setTimer(resolve, SYNC_FIRST_CAP);
  });
  await Promise.race([result, cap]);
  clock.clearTimer(timer);
  await steps.rates();
  await steps.recurring();
  if (weeksMayRecord(await result)) await steps.weeks();
}
