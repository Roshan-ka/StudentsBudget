# P2.4: email codes (sign-up confirmation and "Forgot password")

## Context

StudentsBudget's account (P2.1) has no password reset and no email confirmation; CLAUDE.md lists both under "What P2.1 and P2.2 leave out". Before friends use the app, someone will forget a password, and accounts should prove they own their email.

Roshan picked this as the next feature (04-11-2026) because it is also the test bed the playwright-tester skill lacks: its E2 email-code method is a TODO "against a real app with email codes" (`templates/mailpit.ts`), and StudentsBudget only has TOTP and passkeys. A map of the discount places was parked: the Concept says "A list first", OSM tiles forbid offline use, and the redesign restyles Tips in its chunk 5.

Decided with Roshan:
- **Codes, not links:** a 6-digit code in the email, typed into the app. Links need a redirect page (`detectSessionInUrl` is off) and are what the skill doesn't test.
- **e2e split:** this plan writes the repo's usual mocked e2e (`mockSupabaseAuth`) and contract tests that read the codes from Mailpit. The browser e2e against the local stack with Mailpit is left as a playwright-tester trial task (the skill writes its own Mailpit helper there).

After approval, this plan goes to `docs/superpowers/plans/2026-11-04-email-codes.md`, where the repo keeps its plans.

## What exists (verified)

- **Sign-in UI** (`src/features/account/account-view.tsx`):
  - `SignInForm` (19–170) has modes `sign-in` and `create`. After `signUp`, `data.session === null` (78–82) sets `mode = 'sign-in'` and the notice `text.created`; that branch becomes the confirm step.
  - `AccountView` (373–395) switches only on `useAuth().status` (`off`, `loading`, `signed-in`, `second-step`, `signed-out`), so a code check that creates a session replaces the form by itself.
  - Errors use `<p role="alert">`, notices an `aria-live` line; an `inFlight` ref guards double taps; the hide cleanup (37–44) clears password, error and notice.
- **Code entry:** `SecondStepForm` (176–300) and `two-step.tsx` (284–292) inline the same input (`inputMode="numeric"`, `autoComplete="one-time-code"`). `checkAuthenticatorCode` (`credentials.ts:37–43`) strips spaces and dashes and wants 6 digits, but its text says "from your authenticator app".
- **Auth state:** `authStateOf` (`auth-state.ts:33–43`) gives `second-step` for a verified TOTP factor below aal2. `use-auth.ts` listens to `onAuthStateChange`. supabase-js 2.118's `verifyOtp` emits `PASSWORD_RECOVERY` for `type: 'recovery'`, else `SIGNED_IN`. `EmailOtpType` includes `signup`, `recovery` and `email`.
- **Errors:** `auth-errors.ts` `BY_CODE` (18–46) maps sign-in, MFA and passkey codes to `auth.errors.*`. Not mapped yet: `otp_expired`, `over_email_send_rate_limit`, `same_password`, `email_address_not_authorized`.
- **Texts:** `src/i18n/messages/{en,de,fr,es}/auth.ts` (`auth.signIn`, `auth.check`, `auth.errors`, `auth.secondStep`). `messages.test.ts` checks key parity, `SAME_AS_ENGLISH` and French NNBSP.
- **Local Supabase** (`supabase/config.toml`):
  - `[auth.email]` has `enable_confirmations = false`, `otp_length = 6`, `otp_expiry = 3600` and `max_frequency = "1s"`; no templates (254+ commented out).
  - `[auth.rate_limit] email_sent = 2`.
  - `[local_smtp]` is Mailpit on 54324.
  - Line 4 says the hosted project keeps its own settings in the dashboard and `supabase config push` is never run.
- **Contract tests:**
  - `src/sync/store.contract.test.ts`: `newUser()` (25–35) throws without a session from `signUp`; TOTP via `src/sync/totp.ts` (`totpCode`).
  - `scripts/supabase-test-env.mjs` prints `SUPABASE_TEST_URL` and `SUPABASE_TEST_KEY`.
  - `test:contract` names the one file.
- **e2e mocks:**
  - `mockSupabaseAuth` (`e2e/helpers/supabase.ts:91–270`) answers `/signup` always with a session (141). Calls without a session must come before the 401 gate (172); anything else is a 404.
  - `E2E_TOTP_CODE` is the fixed-code pattern; `skipUnlessAccountsShow` guards specs.
- **CI** (`ci.yml:204–222`): the `db` job starts Supabase with `--exclude studio,mailpit`, then runs `test:db` and `test:contract`. `scripts/ci-affected.mjs:34` flags it for `supabase/`, `src/sync/`, `src/lib/supabase/`, the lockfile and contract-test imports.
- **Hosted email:** Supabase's built-in sender only delivers to the project team's addresses, at about 2 per hour ("best-effort only"); friends need a custom SMTP sender.

## Design

**Flows:**
- **Create account:**
  - `signUp` with `options.data.lang` (the phone's language, for the email).
  - No session: the form switches to a confirm step, "Enter the 6-digit code we sent to <email>", with Confirm, Send a new code and Back.
  - Confirm calls `verifyOtp({ email, token, type })`, using the type the chunk 1 contract test proves (`'email'`, as Supabase's reference example; else `'signup'`). The session then arrives and `useAuth` takes over as today (linking, setup link).
  - With confirmations off (the hosted project until go-live), `signUp` returns a session and nothing changes.
- **Sign-in to an unconfirmed account:** `email_not_confirmed` shows its message with Send a new code, which resends (`auth.resend({ type: 'signup', email })`) and opens the same confirm step.
- **Forgot password** (link under the password field in sign-in mode):
  1. Email: `resetPasswordForEmail(email)`. The step always says "If an account uses this email, we've sent a code", so it never reveals whether an account exists.
  2. Code: `verifyOtp({ email, token, type: 'recovery' })`.
  3. An account with two-step sign-in gets aal1, so `useAuth` shows the existing `SecondStepForm` first. An email code alone never resets such an account.
  4. New password: `updateUser({ password })` with the create-mode rules (`MIN_PASSWORD_LENGTH`). On success, a notice "Password changed", and the account panel as usual.
- **Remembering the reset across the session switch:** a small store, `src/features/account/recovery.ts`. `use-auth.ts` sets it on `PASSWORD_RECOVERY`; it is cleared after the new password is saved and on sign-out. It is kept in `sessionStorage` with try/catch, as `mic-note.ts` does with localStorage, so a reload keeps the new-password step. `AccountView` shows `NewPasswordForm` while signed in and recovering.
- **One code input:** `CodeField` (`src/features/account/code-field.tsx`), taken from the two inlined copies, with its label as a prop. `SecondStepForm` and `two-step.tsx` move onto it. `checkEmailCode` joins `checkAuthenticatorCode` in `credentials.ts` (same rule, its own text), plus `checkEmail` for the email-only step.
- **Errors** (`auth-errors.ts`):
  - `otp_expired` and the wrong-code answer map to `codeWrongOrExpired` ("That code is wrong or has expired. Send a new one.").
  - `over_email_send_rate_limit` maps to `waitForCode`.
  - `same_password` maps to `samePassword`.
  - `email_address_not_authorized` maps to `emailNotSent`.
  - Each in en, de, fr and es; French with `NNBSP`.
- **Hidden pages stay mounted:** the hide cleanup clears the typed code, password and error, but keeps the step and the email, so a person who left to read the email comes back to the code step.
- **Offline:** every handler checks `navigator.onLine` first (`t.auth.offline`), as today.
- **Emails** (`supabase/templates/confirmation.html`, `recovery.html`):
  - The code (`{{ .Token }}`), "valid for 60 minutes", and "ignore this if it wasn't you".
  - The text follows `{{ .Data.lang }}` (en, de, fr, es) with English as the fallback, so accounts made before this feature get English. Native reads as for the app.

**Tests:**
- **Unit:** `checkEmailCode`, `checkEmail`, the new error mappings, and the `recovery.ts` store (set, survive a reload, cleared, blocked storage doesn't throw).
- **Contract** (`src/features/account/email-codes.contract.test.ts`, run against the local stack): codes are read from Mailpit by `src/features/account/mailpit.ts`, which polls Mailpit's API (`/api/v1/search`, `/api/v1/message/{id}`; confirm against the stack's version) for the newest message to an address, with a time limit.
  - The sign-up code confirms and gives a session; a wrong code is refused; a used code is refused the second time.
  - Recovery: the code gives a session; `updateUser` sets the new password; the old one is refused.
  - On an account with TOTP: recovery gives aal1. Pin whether `updateUser` at aal1 is refused, as the passkey case is pinned.
  - The email's language follows `lang` (German), with English when it's missing.
- **e2e** (`e2e/email-codes.spec.ts`, mocked):
  - `mockSupabaseAuth` gains `{ confirmations: true }`, `/verify`, `/recover`, `/resend` and `PUT /user`, with `E2E_EMAIL_CODE` and a fixed "expired" code.
  - Happy and failure paths per flow.
  - One flow in German and one in French (`test.use({ locale })`).
  - The account page at 375 px is covered by `language-tour.spec.ts`.
  - Map: `email-codes` under `/settings/account` in `e2e/affected-map.json`.

## Chunks

Each is about an hour: lint, typecheck, `npm test`, an "As built" note, a commit and its own draft PR from `main`.

1. **Local stack, emails and contract tests (no UI).**
   - `config.toml`:
     - `enable_confirmations = true`;
     - the two templates;
     - `email_sent` raised for the local suite. Check that it applies to Mailpit by running `test:contract`.
   - `newUser()` confirms through Mailpit when `signUp` returns no session.
   - `supabase-test-env.mjs` also prints `SUPABASE_TEST_MAIL_URL`.
   - The contract tests and `test:contract` naming both files.
   - CI: the `db` job drops `mailpit` from `--exclude`; `ci-affected.mjs` flags `db` for `supabase/templates/`.
   - Heavy runs (`supabase:start`, `test:contract`) go through the lane, or a CI run Roshan approves.
   - **As built (2026-11-04):**
     - **`supabase/config.toml`:**
       - `enable_confirmations = true`;
       - `email_sent = 1000` (its comment says it needs custom SMTP, so it may not apply to Mailpit at all; raised in case it does);
       - `[auth.email.template.confirmation]` and `[auth.email.template.recovery]`, both with the subject `StudentsBudget: {{ .Token }}`.
     - **`supabase/templates/confirmation.html` and `recovery.html`:** `{{ $lang := or .Data.lang "en" }}`, then one text per language (de, fr, es, else English). A Go template comment at the top says to paste the file into the hosted dashboard when it changes.
     - **`src/features/account/email-codes.ts`:** `SIGN_UP_CODE` (`'email'`) and `RECOVERY_CODE` (`'recovery'`), shared by the app (chunks 2 and 3) and the contract test. Checked against Supabase Auth's `verify.go`: an `email` code for an unconfirmed user is verified as the sign-up confirmation, and a wrong code answers `otp_expired`. Its `user.go` refuses a new password below aal2 on an account with MFA (`insufficient_aal`).
     - **Where the helpers live:** the Mailpit reader is `src/sync/mailpit.ts` (`mailIds`, `nextMail`, `codeIn`), next to `totp.ts`, rather than in `src/features/account/`, because `store.contract.test.ts` uses it too. `freshCode` moved into `totp.ts` for the same reason.
     - **`store.contract.test.ts`:** `newUser()` confirms with the mailed code when `signUp` gives no session.
     - **`email-codes.contract.test.ts`** (4 tests):
       - no session before the code, `email_not_confirmed` for the password alone, a wrong code and a reused code refused (`otp_expired`);
       - the German and the English sign-up email, and the code in the subject;
       - the French recovery email: its code signs in, and the new password replaces the old one;
       - with TOTP: aal1 after the code, `insufficient_aal` for a new password, then aal2 and the new password.
     - **The test env and CI:** `supabase-test-env.mjs` also prints `SUPABASE_TEST_MAIL_URL` (`MAILPIT_URL`, or `INBUCKET_URL` on older CLIs). `test:contract` is `vitest run .contract.test`. The `db` job keeps Mailpit (`--exclude studio`). `ci-affected.mjs` needed no change: `supabase/` and contract tests already flag `db`.
     - **Not run locally:** this machine has no Docker, so the contract tests first ran in CI's `db` job.
2. **Confirm step in the app.**
   - `CodeField` (and `SecondStepForm` / `two-step.tsx` moved onto it).
   - The confirm step, Send a new code, and the unconfirmed sign-in path.
   - The error mappings and texts in four dictionaries.
   - The mock options and the sign-up half of `email-codes.spec.ts`.
   - **Before merging:** Roshan pastes `confirmation.html` into the hosted dashboard's Confirm signup template. Confirmations stay off there, so nobody's sign-up changes yet.
3. **Forgot password.**
   - The link, the email, code and new-password steps, `recovery.ts` with `use-auth.ts`, and `NewPasswordForm`.
   - Texts, mocks and the recovery half of the spec, including an account with two-step sign-in.
   - **Before merging:** Roshan pastes `recovery.html` into the hosted Reset password template. Until go-live, only team addresses receive it.
4. **Go live and hand the skill its task.**
   - Roshan chooses an SMTP sender; look up current EU options and their limits then, as Supabase names none.
   - In the dashboard: the sender, the email rate limit, "Confirm email" on, a 6-digit OTP.
   - The real try on the phone:
     - sign up with a new address;
     - sign in before confirming;
     - Forgot password, with and without two-step sign-in;
     - in German and French.
   - CLAUDE.md:
     - the outgoing-requests line (sign-up confirmation, resend, recovery, password change);
     - "What P2.1 and P2.2 leave out" drops password reset and email confirmation;
     - the `mockSupabaseAuth` and contract-test notes (Mailpit must run for `test:contract`).
   - A brief for the Playwright-tester session: a trial task for the real-stack e2e of these flows with its Mailpit helper.

## Verification

- **Every chunk:** `npm run lint`, `npm run typecheck`, `npm test`.
- **Chunk 1:** `npm run supabase:start` (with Mailpit), then `npm run test:db` and `test:contract`, through the lane. In CI, the `db` job on the PR.
- **Chunks 2–3:**
  - `email-codes.spec.ts`, `account.spec.ts`, `two-step.spec.ts` and `passkeys.spec.ts` on both browsers.
  - `language-tour.spec.ts` with `E2E_LANGUAGES=all`.
  - Both through the lane, or a CI `changed` run Roshan approves.
  - By hand: `npm run dev` against the local stack, with the codes read in Mailpit at http://127.0.0.1:54324.
- **Chunk 4:** Roshan's real try on the hosted site.

## Left out

- Changing the password or email from Settings while signed in (the new-password form can serve it later).
- Magic-link or email-code sign-in without a password.
- Email codes as a second step.
- Account deletion: the next plan, which reuses the code step.
- The map of discount places (parked).
