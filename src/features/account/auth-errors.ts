import type { Language } from '@/i18n/languages';
import { MESSAGES, type Messages } from '@/i18n/messages';

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

/** What an error means, as the dictionary words it (`auth.errors`). */
type ErrorKey = keyof Messages['auth']['errors'];

const BY_CODE: Record<string, ErrorKey> = {
  invalid_credentials: 'invalidCredentials',
  user_already_exists: 'accountExists',
  email_exists: 'accountExists',
  weak_password: 'weakPassword',
  email_address_invalid: 'checkEmail',
  validation_failed: 'checkEmail',
  signup_disabled: 'signupDisabled',
  email_provider_disabled: 'emailDisabled',
  email_not_confirmed: 'notConfirmed',
  over_request_rate_limit: 'tooMany',
  // The emailed codes (P2.4). Supabase Auth answers a wrong code and an expired one alike.
  otp_expired: 'codeWrongOrExpired',
  over_email_send_rate_limit: 'waitForCode',
  // The hosted project's own sender delivers only to its team's addresses, until it has an SMTP sender of its own.
  email_address_not_authorized: 'emailNotSent',
  // Two-step sign-in (the authenticator code).
  mfa_verification_failed: 'codeFailed',
  mfa_verification_rejected: 'codeFailed',
  mfa_challenge_expired: 'codeExpired',
  mfa_factor_not_found: 'factorGone',
  mfa_factor_name_conflict: 'setupOpen',
  mfa_totp_enroll_not_enabled: 'enrollOff',
  mfa_totp_verify_not_enabled: 'verifyOff',
  // The challenge and its code must come from the same connection.
  mfa_ip_address_mismatch: 'connectionChanged',
  insufficient_aal: 'signInAgain',
  // Passkeys (a beta in Supabase Auth), and the one browser answer worth a text of its own. Switched off and the wrong
  // site are in PASSKEYS_UNAVAILABLE below, since what to do then depends on where the person is.
  too_many_passkeys: 'tooManyPasskeys',
  webauthn_credential_exists: 'passkeyOnAccount',
  webauthn_challenge_expired: 'passkeyExpired',
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: 'passkeyOnDevice',
};

/**
 * Passkeys can't be used here at all: switched off in the account server, or a copy of the app on another address than
 * the one passkeys are made for (a preview, the LAN), which the browser refuses.
 */
const PASSKEYS_UNAVAILABLE: Record<string, keyof Messages['auth']['unavailable']> = {
  passkey_disabled: 'disabled',
  ERROR_INVALID_RP_ID: 'wrongSite',
  ERROR_INVALID_DOMAIN: 'wrongSite',
};

/** What an error from signing in, creating an account or signing out means. */
function errorKey(error: unknown): ErrorKey {
  const { code, status, name } = fieldsOf(error);
  if (code !== undefined && code in BY_CODE) return BY_CODE[code];
  if (status === 429) return BY_CODE.over_request_rate_limit;
  // supabase-js raises this when the request never got an answer, or the server failed.
  if (name === 'AuthRetryableFetchError') return 'unreachable';
  // The account server no longer knows this session (signed out elsewhere, or ended by a finished second step).
  if (name === 'AuthSessionMissingError') return 'sessionEnded';
  return 'general';
}

/** Calm text for an error from signing in, creating an account or signing out, in `lang`. */
export function authErrorMessage(error: unknown, lang: Language = 'en'): string {
  return MESSAGES[lang].auth.errors[errorKey(error)];
}

/**
 * Whether the browser's passkey prompt was closed without a passkey: the person cancelled it, it timed out, or the
 * device has none for this site. Nothing went wrong that needs saying.
 */
export function passkeyCancelled(error: unknown): boolean {
  const { code, name } = fieldsOf(error);
  return name === 'NotAllowedError' || name === 'AbortError' || code === 'ERROR_CEREMONY_ABORTED';
}

/** Why passkeys can't be used here at all, in `lang`, or null when they can. */
export function passkeysUnavailable(error: unknown, lang: Language = 'en'): string | null {
  const { code } = fieldsOf(error);
  return code !== undefined && code in PASSKEYS_UNAVAILABLE ? MESSAGES[lang].auth.unavailable[PASSKEYS_UNAVAILABLE[code]] : null;
}

/** Calm text for a passkey sign-in that didn't work: every path points back to the password, which always does. */
export function passkeySignInMessage(error: unknown, lang: Language = 'en'): string {
  const text = MESSAGES[lang].auth;
  const unavailable = passkeysUnavailable(error, lang);
  if (unavailable !== null) return text.passkeyUnavailable(unavailable);
  const key = errorKey(error);
  return key === 'general' ? text.passkeyFailed : text.errors[key];
}

/** Calm text for a passkey that couldn't be listed, added or removed in Settings; `fallback` for anything unknown. */
export function passkeySettingsMessage(error: unknown, fallback: string, lang: Language = 'en'): string {
  const unavailable = passkeysUnavailable(error, lang);
  if (unavailable !== null) return unavailable;
  const key = errorKey(error);
  return key === 'general' ? fallback : MESSAGES[lang].auth.errors[key];
}
