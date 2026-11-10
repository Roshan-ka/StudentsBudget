import type { BrowserContext } from '@playwright/test';

/**
 * Holds the phone's sync lock (`studentsbudget-sync`, src/sync/lock.ts) from a second page of the same browser
 * context, as another tab syncing would (automatic sync, docs/superpowers/plans/2026-11-10-automatic-sync.md). While it
 * is held, automatic syncs skip (busy) and a change stays in the outbox; a Sync now waits for it, and runs first once
 * it goes. The page is a same-origin file, not the app, so it starts no sync of its own, and the lock survives the
 * app page's own loads. Returns `release`, which lets the lock go and closes that page.
 */
export async function holdSyncLock(context: BrowserContext): Promise<() => Promise<void>> {
  const holder = await context.newPage();
  await holder.goto('/manifest.webmanifest');
  await holder.evaluate(
    () =>
      new Promise<void>((granted) => {
        void navigator.locks.request(
          'studentsbudget-sync',
          () =>
            new Promise<void>((release) => {
              (window as unknown as { releaseSyncLock: () => void }).releaseSyncLock = release;
              granted();
            }),
        );
      }),
  );
  return async () => {
    await holder.evaluate(() => (window as unknown as { releaseSyncLock: () => void }).releaseSyncLock());
    await holder.close();
  };
}
