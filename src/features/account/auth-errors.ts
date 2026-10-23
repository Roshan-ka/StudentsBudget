/** What the app reads from a supabase-js auth error: its error code, HTTP status and class name. */
function fieldsOf(error: unknown): { code?: string; status?: number; name?: string } {
  if (typeof error !== 'object' || error === null) return {};
  const { code, status, name } = error as { code?: unknown; status?: unknown; name?: unknown };
  return {
    code: typeof code === 'string' ? code : undefined,
    status: typeof status === 'number' ? status : undefined,
    name: typeof name === 'string' ? name : undefined,
  };
}

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Email or password is wrong.',
  user_already_exists: 'This email already has an account. Sign in instead.',
  email_exists: 'This email already has an account. Sign in instead.',
  weak_password: 'This password is too easy to guess. Choose a longer one.',
  email_address_invalid: 'Check the email address.',
  validation_failed: 'Check the email address.',
  signup_disabled: 'New accounts are switched off right now.',
  email_provider_disabled: 'Signing in with email is switched off right now.',
  email_not_confirmed: 'This account still has to be confirmed by email.',
  over_request_rate_limit: 'Too many tries. Wait a minute, then try again.',
};

/** Calm text for an error from signing in, creating an account or signing out. */
export function authErrorMessage(error: unknown): string {
  const { code, status, name } = fieldsOf(error);
  if (code !== undefined && code in BY_CODE) return BY_CODE[code];
  if (status === 429) return BY_CODE.over_request_rate_limit;
  // supabase-js raises this when the request never got an answer, or the server failed.
  if (name === 'AuthRetryableFetchError') return "The account server can't be reached. Check your connection and try again.";
  return 'Something went wrong. Try again.';
}

/** Shown instead of trying while the phone has no connection. */
export const OFFLINE_MESSAGE = "You're offline. Signing in needs a connection.";
