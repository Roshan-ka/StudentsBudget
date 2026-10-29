# StudentsBudget P2.3b: passkeys and recovery codes

> **For agentic workers:** chunks of about 1 hour, done one at a time. Each ends with lint, typecheck, unit tests (its e2e and `npm run build` where it applies), a commit and a report to Roshan, who says when the next one starts.

**Goal:** more ways to sign in safely, next to the authenticator app from [[2026-10-28-p2-3a-two-step-sign-in|P2.3a]]:
- a **passkey** (Face ID, fingerprint or the phone's PIN) signs in instead of the password;
- **recovery codes** open the account when the authenticator app is lost.

**Status (2026-10-29):** 3b.0 (the spike) done on `feat/passkeys-and-recovery-codes`, PR #9: passkeys work on the local stack; recovery codes are switched off on the server and have no config switch (see Findings). Its contract tests run in the CI `db` job (this machine has no Docker) and report their findings as notices on the run.

**Roshan's choices (29-10-2026):**
- passkey + recovery codes;
- the passkey **instead of the password**, not as the second step;
- no email code.

**Why no email code:**
- Supabase Auth has no email factor for two-step sign-in, so it would need server code of our own, and the database rule couldn't rely on it.
- Supabase's built-in email "will refuse to deliver messages to addresses that are not part of the project's team", at 2 an hour, and isn't for production (supabase.com/docs/guides/auth/auth-smtp, checked 29-10-2026). Real users would need an email provider with a verified domain, and `vercel.app` can't be verified.

**Cost:** none found. Passkeys are part of Supabase Auth (beta since 28-05-2026: "The API may change without notice", supabase.com/docs/guides/auth/passkeys, checked 29-10-2026). Recovery codes are an experimental supabase-js API (`auth.experimental.recoveryCodes`).

**Builds on:** [[2026-10-28-p2-3a-two-step-sign-in|P2.3a]] (the authenticator app, `private.has_verified_factor()`, the restrictive policy on the 8 tables).

## Findings (3b.0)

| Question | Answer | Source |
|---|---|---|
| Hosted Auth version | GoTrue v2.197.0 | `GET /auth/v1/health`, 29-10-2026 |
| Passkeys on the hosted project | Off (`passkeys_enabled: false`); Roshan turns them on in 3b.4 | `GET /auth/v1/settings` |
| Sign-ups confirmed (`registerPasskey` needs a confirmed user) | Yes: `mailer_autoconfirm: true` | `GET /auth/v1/settings` |
| Level of a passkey sign-in | aal1, with `amr` method `passkey`. With two-step sign-in on, the code step still follows, as after a password | supabase/auth issue #2832 (users' reports, no maintainer answer yet) |
| Are recovery codes a factor? | Yes: a `recovery_code` factor in `user.factors` and `mfa.listFactors()` | supabase-js 2.118 types (`MFARecoveryCodesGenerateParams`) |
| Does a passkey or recovery-code factor hide rows? | Answered by design, whatever the storage: 3b.1 makes `private.has_verified_factor()` count verified **TOTP** factors only, the only kind the app's second step answers | 3b.1 |
| Local stack's Auth version | GoTrue v2.197.0, the same as hosted | contract test "P2.3b spike", PR #9 run 40857011402 |
| Recovery codes on a real stack | **Off on the server:** every `generate` (no authenticator, aal1, aal2) answers 422 `mfa_recovery_codes_enroll_not_enabled`. The CLI has no `config.toml` key to turn them on (supabase.com/docs/guides/local-development/cli/config, checked 29-10-2026), and supabase-js's `experimental.recoveryCodes` only lets the client call the API. The rest (one use, aal2, what remains after the authenticator goes) can't be tested until a server allows them | same run |
| Can a new, auto-confirmed user start a passkey registration? | Yes: the server sends creation options (relying party `StudentsBudget` / `localhost`, user name the email) | same run |
| A new user's factors | Empty; `listFactors()` keeps `webauthn` and `recovery_code` lists of their own next to `totp` | same run |
| Password only, with an authenticator on | 0 rows; level aal1, next aal2 (the P2.3a lock holds) | same run |

## Chunks

| Chunk | What | Done when |
|---|---|---|
| 3b.0 | Spike: contract tests that report findings as notices; local `[auth.passkey]` and `[auth.webauthn]` on; the answers above | Every question answered with its source |
| 3b.1 | Migration: `private.has_verified_factor()` counts only verified `totp` factors; pgTAP (a recovery-code factor alone hides nothing); the MCP server's `needsSecondStep` counts only TOTP too; the spike's notices become assertions | CI `db` job green |
| 3b.2 | Recovery codes: offered once after turning two-step on (grouped, Copy, Download as .txt, "8 of 10 unused"); "Make new codes" asks first; the code step gets "Use a recovery code instead"; a note after a recovery sign-in; removed with two-step sign-in where the API allows | Unit tests; e2e with the endpoints mocked |
| 3b.3 | Passkeys: a Passkeys card (add, list with the date added, remove with a confirm); "Sign in with a passkey" on the sign-in form where the browser has `PublicKeyCredential`; a cancelled prompt shows nothing | e2e on `desktop-chrome` with Chrome's virtual authenticator and the `/passkeys/*` endpoints mocked; `iphone` checks the password path |
| 3b.4 | "Sign-in and security" layout; Roshan turns passkeys on in the Dashboard (RP ID `students-budget.vercel.app`); real try on the iPhone (Safari and the Home Screen app) with test account B; README and CLAUDE.md; two reviewers; Draft PR | Works on the phone; CI green |

## Risks

- Both features are beta or experimental on Supabase's side. supabase-js is pinned, the hosted server isn't. The password always stays, so the worst case is a passkey button that fails calmly.
- The RP ID ties passkeys to `students-budget.vercel.app`: a custom domain later makes existing passkeys unusable, and Vercel preview URLs and the LAN `npm run start:https` setup can't use them.
- Recovery codes are shown once. Without the app and the codes, Roshan still removes the factor by hand.
