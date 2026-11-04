# Change password

## Context

"Forgot password" by emailed code (P2.4) is built, but the hosted project has no email sender yet, and a free one (a dedicated Gmail account as Supabase's SMTP sender) waits for Roshan. Until then, a friend who forgets the password has no way back. A passkey already signs in without the password, so a "Change password" card that doesn't ask for the old password after a passkey sign-in becomes that way back. Roshan approved this as the next step on 04-11-2026, with the recommended rule.

## The rule

The current password is asked when this session signed in with it, or when that can't be told. A session that signed in another way (a passkey, an emailed code) sets a new one without the old.

## As built (2026-11-04), one chunk

- **`auth-state.ts`:**
  - `signInMethodsOf(accessToken)` reads the token's `amr` claim, as supabase-js's `getAuthenticatorAssuranceLevel` does, without a network call;
  - `asksCurrentPassword(methods)` is the rule;
  - `claimsOf` is now shared with `assuranceLevelOf`.
- **`change-password.tsx`:** `PasswordSection`, the first card in Sign-in and security (`security.tsx`), styled as the others.
  - "Change password" opens the form and reads the session's methods then.
  - The current password is checked on `checkingSupabase()` (P2.5), so the tab's session isn't swapped.
  - `updateUser({ password })` runs on the tab's client. An account with two-step sign-in is already at aal2 when signed in, as Supabase Auth wants.
  - Errors use `checkNewPassword` and `authErrorMessage` (`same_password`, `weak_password`), plus `wrongCurrent` for a wrong current password.
  - Success says "Password changed." in the card's status line.
- **Texts:** `auth.changePassword`, in en, de, fr and es. The intro says a passkey sign-in can set a new password without the old one.
- **Tests:**
  - `mockSupabaseAuth`'s sessions now carry `amr`: 'password', 'otp' for the emailed codes, 'webauthn' for a passkey, plus 'totp' after the code;
  - unit tests for the methods and the rule;
  - `e2e/change-password.spec.ts` covers the password path (wrong current, the same password, then a new one that signs in), listed under `/settings/account`.
- **Left out:** an e2e of the passkey path, which needs Chromium's virtual authenticator. The rule it depends on is unit-tested.
