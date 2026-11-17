import type { AuthState } from '@/features/account/auth-state';
import { AUTH_STORAGE_KEY } from '@/lib/supabase/client';

/** Where a phone without a plan goes. */
export type FirstRunPath = '/start' | '/start/sign-in' | '/setup';

/**
 * Where a phone without a plan goes, by its sign-in state (the start page, 06-11-2026): the start page while nobody is
 * signed in, the sign-in page's code step for a session that still needs its authenticator code, and setup otherwise,
 * which includes a build without accounts. `null` while the state is still being read.
 */
export function firstRunPath(status: AuthState['status']): FirstRunPath | null {
  switch (status) {
    case 'loading':
      return null;
    case 'signed-out':
      return '/start';
    case 'second-step':
      return '/start/sign-in';
    case 'off':
    case 'signed-in':
      return '/setup';
  }
}

/**
 * Whether supabase-js may have a session on this phone: its key is in localStorage. Read in effects only. Blocked
 * storage counts as maybe, so the page waits for the real answer.
 */
export function sessionMayBeStored(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): boolean {
  try {
    return storage === undefined || storage.getItem(AUTH_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

/**
 * `firstRunPath`, without waiting for the sign-in state when no session can be on this phone (review P4, 17-11-2026):
 * a first visit goes to the start page as soon as the database says there is no plan, instead of an empty page while
 * supabase-js starts. Where a session may be stored, it still waits.
 */
export function firstRunPathSoon(status: AuthState['status'], sessionStored: boolean): FirstRunPath | null {
  if (status === 'loading' && !sessionStored) return '/start';
  return firstRunPath(status);
}
