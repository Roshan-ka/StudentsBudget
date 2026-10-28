# StudentsBudget P2.3a: optional two-step sign-in

> **For agentic workers:** chunks of about 1 hour, done one at a time. Each ends with lint, typecheck, unit tests (its e2e and `npm run build` where it applies), a commit and a report to Roshan, who says when the next one starts.

**Goal:** an account owner can turn on a second sign-in step: after the password, a 6-digit code from an authenticator app (TOTP). With it on, a stolen password alone no longer opens that account's data, because the database refuses it until the code is given.

**Status (2026-10-28):** 2FA.1 written on `feat/two-step-sign-in` (migration, pgTAP, local config, MCP state). Its pgTAP tests run in the CI `db` job once the branch has a PR; this machine has no Docker.

**Cost:**
- Supabase's authenticator-app factor (TOTP) is "free to use and is enabled on all Supabase projects by default" (supabase.com/docs/guides/auth/auth-mfa/totp, checked 28-10-2026).
- SMS codes would cost $75 a month on Pro and above, plus the messages, so they stay out.
- supabase-js 2.118 has the whole API: `auth.mfa.enroll`, `challengeAndVerify`, `getAuthenticatorAssuranceLevel`, `listFactors`, `unenroll`.

**Roshan's choices (28-10-2026):** 2FA for StudentsBudget accounts, optional (each user turns it on in Settings). Test account A stays without it, so the MCP server can still read it.

**Builds on:** [[2026-10-23-p2-1-accounts-and-database|P2.1]] (accounts, the 8 tables, row-level security) and [[2026-10-28-mcp-server|the MCP server]].

## How it works

- **Database, the real lock:** a restrictive row-level-security policy on all 8 tables.
  - An account with a verified factor gets its rows only with an `aal2` session (the code was given).
  - Accounts without a factor are unaffected.
  - The check is `private.has_verified_factor()`, a `security definer` function, so signed-in users need no access to `auth.mfa_factors`.
  - `sync_pull` runs as the caller and follows the same rule.
- **Sign-in:**
  - after the password, the assurance level decides whether the account page asks for the code;
  - until it is given the app treats the user as not fully signed in, so Save and Load stay hidden. They would otherwise see an empty account.
- **Settings:**
  - *turn on:* a QR code, plus an "Open in authenticator app" link (`otpauth://`) and the secret for the phone the app runs on, which can't scan its own screen. The first code confirms it;
  - *turn off:* asks first.
- **MCP server:** password sign-in can't give the code. An account that needs it returns the state `needs-second-step` with a calm note, never a misleading "nothing saved yet".
- **Lost authenticator:**
  - the phone's own data is untouched;
  - Roshan, as project owner, can remove the factor in the Supabase SQL editor;
  - the README and Settings say to keep a second authenticator.

## Chunks

| Chunk | What | Done when |
|---|---|---|
| 2FA.1 | Migration (`private.has_verified_factor()`, a restrictive policy on the 8 tables); pgTAP `two_step.test.sql`; `config.toml` TOTP on for the local stack; MCP `needs-second-step` | pgTAP in the CI `db` job, which this machine can't run without Docker: with a factor, `aal1` sees and writes nothing and `aal2` works; without one, `aal1` works; the existing tests still pass |
| 2FA.2 | The sign-in step: a `second-step` auth state, the code form, Save and Load waiting for `aal2`, calm error texts | Unit tests; Save and Load unreachable at `aal1` |
| 2FA.3 | Settings: turn on (QR, open-in-app link, secret, first code) and turn off; e2e with the MFA endpoints mocked | e2e on `desktop-chrome` and `iphone` |
| 2FA.4 | Real try on the live site with test account B and a real authenticator; docs; two reviewers; Draft PR | Sign-in with the code works on the phone; CI green |
