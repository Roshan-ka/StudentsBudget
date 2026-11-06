import type { AuthState } from '@/features/account/auth-state';

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
