import { useSyncExternalStore } from 'react';

// Whether this tab just deleted its account (P2.5). The deletion signs the tab out, which swaps the account page to
// the sign-in form, so the "Your account is deleted" line needs a flag that outlives the card. Kept in memory only: a
// reload or the next sign-in drops it.

let deleted = false;
const listeners = new Set<() => void>();

function write(next: boolean) {
  if (deleted === next) return;
  deleted = next;
  for (const listener of listeners) listener();
}

/** The account is deleted: the sign-in form says so. */
export function markAccountDeleted(): void {
  write(true);
}

/** Signed in again: nothing is left to say. */
export function forgetAccountDeleted(): void {
  write(false);
}

/** Whether this tab deleted its account; false while the page is rendered on the server. */
export function useAccountDeleted(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => deleted,
    () => false,
  );
}
