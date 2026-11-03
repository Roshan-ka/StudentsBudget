import type { Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';

/** Signing in, or creating a new account. */
export type AuthMode = 'sign-in' | 'create';

/** Supabase's minimum, set in the project's Auth settings; checked here too, so a short password never leaves the phone. */
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks the two fields before anything is sent, saying what is wrong in `lang`. The email is trimmed; the password is
 * taken as typed, since spaces can be part of it.
 */
export function checkCredentials(
  email: string,
  password: string,
  mode: AuthMode,
  lang: Language = 'en',
): { ok: true; email: string } | { ok: false; error: string } {
  const text = MESSAGES[lang].auth;
  const trimmed = email.trim();
  if (trimmed === '') return { ok: false, error: text.check.enterEmail };
  if (!EMAIL_PATTERN.test(trimmed)) return { ok: false, error: text.errors.checkEmail };
  if (password === '') return { ok: false, error: text.check.enterPassword };
  if (mode === 'create' && password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: text.check.shortPassword(MIN_PASSWORD_LENGTH) };
  }
  return { ok: true, email: trimmed };
}

/**
 * Checks an authenticator code before it is sent: six digits. Spaces and dashes are dropped first, since apps show the
 * code as "123 456" and a pasted one keeps the gap.
 */
export function checkAuthenticatorCode(
  text: string,
  lang: Language = 'en',
): { ok: true; code: string } | { ok: false; error: string } {
  const code = text.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(code) ? { ok: true, code } : { ok: false, error: MESSAGES[lang].auth.check.code };
}
