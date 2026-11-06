import { useSyncExternalStore } from 'react';

// Whether this tab has just signed out (06-11-2026): signing out clears the phone and ends with a full load of /start,
// which says so in one line. In sessionStorage, so it outlives that load and not the tab. It goes once the person
// picks something on the start page, or signs in again.

const KEY = 'studentsbudget-signed-out';

export function markSignedOut(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Blocked storage: the start page just doesn't say it.
  }
}

export function forgetSignedOut(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}

function read(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

const subscribe = () => () => {};

/** Whether this tab has just signed out; false while the page is rendered on the server. */
export function useJustSignedOut(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
