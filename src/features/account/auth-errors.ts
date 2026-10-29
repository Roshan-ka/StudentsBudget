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
  // Two-step sign-in (the authenticator code).
  mfa_verification_failed: 'That code didn’t work. Codes change every 30 seconds: enter the newest one.',
  mfa_verification_rejected: 'That code didn’t work. Codes change every 30 seconds: enter the newest one.',
  mfa_challenge_expired: 'That took a little long. Enter the newest code from your authenticator app.',
  mfa_factor_not_found: 'Two-step sign-in was turned off for this account. Sign out, then sign in again.',
  mfa_factor_name_conflict: 'An earlier set-up is still open. Try again.',
  mfa_totp_enroll_not_enabled: 'Two-step sign-in can’t be turned on right now.',
  mfa_totp_verify_not_enabled: 'Codes can’t be checked right now. Try again later.',
  // The challenge and its code must come from the same connection.
  mfa_ip_address_mismatch: 'Your connection changed while checking the code. Enter the newest code again.',
  insufficient_aal: 'Sign out, sign in again with your code, then try once more.',
  // Passkeys (a beta in Supabase Auth), and the one browser answer worth a text of its own. Switched off and the wrong
  // site are in PASSKEYS_UNAVAILABLE below, since what to do then depends on where the person is.
  too_many_passkeys: 'Your account has as many passkeys as it can keep. Remove one first.',
  webauthn_credential_exists: 'This passkey is already on your account.',
  webauthn_challenge_expired: 'That took a little long. Try again.',
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: 'This device already has a passkey for your account.',
};

/**
 * Passkeys can't be used here at all: switched off in the account server, or a copy of the app on another address than
 * the one passkeys are made for (a preview, the LAN), which the browser refuses.
 */
const PASSKEYS_UNAVAILABLE: Record<string, string> = {
  passkey_disabled: 'Passkeys are switched off right now.',
  ERROR_INVALID_RP_ID: 'Passkeys don’t work on this copy of the app.',
  ERROR_INVALID_DOMAIN: 'Passkeys don’t work on this copy of the app.',
};

const GENERAL = 'Something went wrong. Try again.';

/** Calm text for an error from signing in, creating an account or signing out. */
export function authErrorMessage(error: unknown): string {
  const { code, status, name } = fieldsOf(error);
  if (code !== undefined && code in BY_CODE) return BY_CODE[code];
  if (status === 429) return BY_CODE.over_request_rate_limit;
  // supabase-js raises this when the request never got an answer, or the server failed.
  if (name === 'AuthRetryableFetchError') return "The account server can't be reached. Check your connection and try again.";
  // The account server no longer knows this session (signed out elsewhere, or ended by a finished second step).
  if (name === 'AuthSessionMissingError') return 'This sign-in has ended. Sign out, then sign in again.';
  return GENERAL;
}

/**
 * Whether the browser's passkey prompt was closed without a passkey: the person cancelled it, it timed out, or the
 * device has none for this site. Nothing went wrong that needs saying.
 */
export function passkeyCancelled(error: unknown): boolean {
  const { code, name } = fieldsOf(error);
  return name === 'NotAllowedError' || name === 'AbortError' || code === 'ERROR_CEREMONY_ABORTED';
}

/** Why passkeys can't be used here at all, or null when they can. */
export function passkeysUnavailable(error: unknown): string | null {
  const { code } = fieldsOf(error);
  return code !== undefined && code in PASSKEYS_UNAVAILABLE ? PASSKEYS_UNAVAILABLE[code] : null;
}

/** Calm text for a passkey sign-in that didn't work: every path points back to the password, which always does. */
export function passkeySignInMessage(error: unknown): string {
  const unavailable = passkeysUnavailable(error);
  if (unavailable !== null) return `${unavailable} Sign in with your email and password.`;
  const message = authErrorMessage(error);
  return message === GENERAL ? 'That passkey didn’t work. Try again, or sign in with your email and password.' : message;
}

/** Calm text for a passkey that couldn't be listed, added or removed in Settings; `fallback` for anything unknown. */
export function passkeySettingsMessage(error: unknown, fallback: string): string {
  const message = passkeysUnavailable(error) ?? authErrorMessage(error);
  return message === GENERAL ? fallback : message;
}

/** Shown instead of trying while the phone has no connection. */
export const OFFLINE_MESSAGE = "You're offline. Signing in needs a connection.";
