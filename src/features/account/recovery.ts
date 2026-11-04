import { useSyncExternalStore } from 'react';

// Where a "Forgot password" sign-in stands in this tab (P2.4, docs/superpowers/plans/2026-11-04-email-codes.md). The
// emailed code signs in like a password, and the page would show the account at once, so the new-password step needs
// a flag that outlives that switch: 'pending' from the code until a new password is saved, then 'changed' for one
// "Password changed" line. Kept in sessionStorage too, so a reload of the tab keeps the step; another tab, or the
// next visit, starts without it. Never synced or backed up.

export type RecoveryState = 'pending' | 'changed' | null;

/** Where this tab keeps a pending reset (sessionStorage). */
export const RECOVERY_KEY = 'studentsbudget-password-reset';

// Undefined until this load sets it: then the stored flag decides. Kept in memory as well, so blocked storage (a
// private window) still shows the step for as long as the tab is open.
let current: RecoveryState | undefined;
const listeners = new Set<() => void>();

/** Where the reset stands now. */
export function recoveryState(): RecoveryState {
  if (current !== undefined) return current;
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === 'pending' ? 'pending' : null;
  } catch {
    return null;
  }
}

function write(next: RecoveryState) {
  current = next;
  try {
    if (next === 'pending') sessionStorage.setItem(RECOVERY_KEY, 'pending');
    else sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Blocked storage: the flag lives in memory only, until a reload.
  }
  for (const listener of listeners) listener();
}

/** A "Forgot password" code signed in: the new password is still to come. */
export function startRecovery(): void {
  write('pending');
}

/** The new password is saved. */
export function finishRecovery(): void {
  write('changed');
}

/** Signed out, or the "Password changed" line was seen: nothing is left to say. */
export function endRecovery(): void {
  if (recoveryState() !== null) write(null);
}

/** Drops the "Password changed" line once it was shown, and leaves a pending reset alone. */
export function forgetPasswordChanged(): void {
  if (recoveryState() === 'changed') write(null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The reset's state, for a component. Nothing is pending while the page is rendered on the server. */
export function useRecovery(): RecoveryState {
  return useSyncExternalStore(subscribe, recoveryState, () => null);
}
