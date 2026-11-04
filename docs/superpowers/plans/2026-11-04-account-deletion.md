# P2.5: deleting the account

## Context

The Concept promises, from P2 on, "Export my data" and "Delete everything" for the account. The GDPR requires the second: a person can have their account and its data erased. CLAUDE.md still lists account deletion under "What P2.1 and P2.2 leave out". Rows are never hard-deleted today: a delete writes a tombstone, so nothing a person removes ever leaves the account.

Roshan asked for this plan on 04-11-2026, after the email codes (P2.4), and skipped the questions. Every choice below is Claude's, said plainly so he can change it before approving.

## Claude's choices (to check)

- **The account goes; the phone's data stays.** StudentsBudget is local-first, so the phone's data belongs to the person. Deleting the account removes the account and every row it holds, and unlinks this phone. The phone's entries stay. Settings already has "Delete everything" for the phone (Backup), and the deletion screen points to it.
- **Real deletion, not tombstones.** The account's rows go with the user: every user table and `private.sync_meta` cascade from `auth.users`, so deleting the user is enough.
- **Proof that it's the owner:** the password, plus the authenticator code for an account with two-step sign-in, plus a typed word ("DELETE", in the phone's language, as Backup's "Delete everything" asks). No emailed code: the hosted project has no email sender yet (P2.4's go-live waits), so an emailed step would lock friends out of deleting. The authenticator step reuses `CodeField` and the second-step check.
- **A backup first, offered, not forced:** the screen links to the backup export ("Download a backup first").
- **Other phones linked to the account** keep their data. Their session ends once the user is gone, and their link is cleared the next time they sign in or sync and the server says the user no longer exists. So they can link to a new account later instead of being blocked as "linked to another account".

## What exists (verified)

- **Cascades:** every user-data table's `user_id ... references auth.users (id) on delete cascade` (the `user_data` migration), and `private.sync_meta.user_id` does the same (`20261026132206_sync.sql`).
- **The second-step rule:** `private.has_verified_factor()` (`20261029103500_two_step_totp_only.sql`) and the restrictive aal2 policy. The deletion function uses the same rule.
- **The phone:**
  - `deleteEverything()` (`src/db/bulk.ts`) and Backup's typed word (`backup-panel.tsx:142`: "the word to type is the phone's language's");
  - `syncState` and `outbox` in Dexie;
  - `linkPhone`, `applyLink` and `linkWithChoice` (`src/sync/link.ts`). Nothing unlinks today.
- **Account UI:**
  - `SignedInPanel`, `SignInSecurity` and `AccountLink` in `account-view.tsx`;
  - `CodeField`, `checkAuthenticatorCode` and `mfa.challengeAndVerify` (the second step);
  - `checkCredentials`.

## Design

**Server (a new migration, `delete_my_account`):**
- `public.delete_my_account()`, `security definer`, `set search_path = ''`, executable only by `authenticated`. It deletes `auth.users` where `id = (select auth.uid())`, and the cascades take every row.
- It refuses unless the session is aal2 when `private.has_verified_factor()` is true: the same rule as the restrictive policy, so a stolen password alone can't delete an account that has two-step sign-in.
- **pgTAP:**
  - a user deletes themselves, and their rows are gone from every table;
  - another user's rows stay;
  - `anon` can't run it;
  - aal1 with a verified factor is refused.

**Contract test** (`src/features/account/account-deletion.contract.test.ts`):
- a confirmed user with rows deletes the account;
- the password no longer signs in;
- another user is untouched;
- an aal1 session of a two-step account is refused;
- what the API answers a deleted user's still-held session (refresh and a table read), so the other-phones handling uses the real error code.

**App (Settings → Your account → a "Delete my account" card, last):**
1. A short text: what goes (the account and everything it keeps), what stays (this phone's data), and that other phones keep theirs. A "Download a backup first" link goes to Backup.
2. The password, and the authenticator code when the account has two-step sign-in. Checking them signs in again with `signInWithPassword`, which gives aal1, then `challengeAndVerify` for aal2.
3. The typed word, then the button. It calls `supabase.rpc('delete_my_account')`.
4. Then the phone unlinks: a new `unlinkPhone()` in `src/sync/link.ts` clears `syncState` and the `outbox` in one transaction, signs out locally, and shows "Your account is deleted. Everything on this phone stays."

**Other phones:** when a refresh or a sync gets the deleted-user answer (the code the contract test finds), `unlinkPhone()` runs, and the sign-in form shows "That account no longer exists".

**Texts** in en, de, fr and es; the typed word in each language.

**e2e** (`e2e/account-deletion.spec.ts`, mocked):
- `mockSupabaseData` answers `/rest/v1/rpc/delete_my_account`;
- a plain account deletes and keeps its entries;
- a two-step account needs the code;
- a wrong password, and a wrong word;
- one flow in German.

## Chunks

Each is about an hour: lint, typecheck, the touched unit tests (the full suite runs in CI), an "As built" note, a commit and its own draft PR from `main`.

1. **Server.** The migration, pgTAP, and the contract test, including the deleted-user answer. Verified by CI's `db` job.
   - **As built (2026-11-04):**
     - **`20261104131626_delete_my_account.sql`:** `public.delete_my_account()` (plpgsql, `security definer`, `search_path = ''`).
       - It raises `42501` ("not signed in") without a user, and `42501` ("the second step is owed") when `private.has_verified_factor()` is true and the JWT's `aal` isn't `aal2`.
       - It then deletes the caller from `auth.users`.
       - Only `authenticated` may run it.
     - **`supabase/tests/account_deletion.test.sql`** (11 checks):
       - who may run it;
       - aal1 refused for A, who has a factor, with every row of A left;
       - B deletes: B gone from `auth.users`, and 0 rows of B in the 8 tables and `private.sync_meta`;
       - C keeps all 9;
       - A deletes at aal2, and A's factor goes too.
     - **`account-deletion.contract.test.ts`** (3 tests):
       - the deletion with a bystander's rows kept, and `invalid_credentials` afterwards;
       - a second phone's held session: `getUser` → `user_not_found` and `refreshSession` → `refresh_token_not_found`. Read from Supabase Auth's source, then pinned here for chunk 3;
       - a password-only session of a two-step account refused (`42501`), then deleted at aal2.
     - **Shared helpers:** `src/sync/contract-users.ts` (`stackClient`, `newEmail`, `confirmedUser`, `CONTRACT_PASSWORD`), now also used by `email-codes.contract.test.ts` in place of its own copies.
2. **The card.** The UI, `unlinkPhone()`, texts, mocks and the spec.
   - **As built (2026-11-04):**
     - **The check runs on a client of its own:** `checkingSupabase()` (`src/lib/supabase/client.ts`), with its session in memory only. Signing in again on the tab's client would swap its session, and an account with two-step sign-in would drop back to the code step. The check client signs in with the password, gives the authenticator's code (`challengeAndVerify`) when the account has a verified factor, and then calls `delete_my_account`.
     - **When the code field shows:** the card reads two-step sign-in from this tab's session in an effect. If another phone turned it on since, the check finds the factor and asks for the code (`codeNeeded`); so does a `42501` from the database.
     - **`src/features/account/delete-account.tsx`:** `DeleteAccountCard`, last on the account page, styled as a card like the security ones (`SECURITY_CARD`, a trash icon).
       - It reuses Backup's word and "Type … to confirm" (`backup.delete`), so each language has one word to type.
       - The "Export a backup first" link goes to `/settings#backup-heading`.
       - The button stays disabled until the word matches.
     - **After the deletion:**
       - `unlinkPhone()` (`src/sync/link.ts`, with a test) clears `syncState` and the `outbox` under the sync lock;
       - `markAccountDeleted()` (`account-deleted.ts`, memory only, dropped by the next `SIGNED_IN` in `use-auth.ts`) makes the signed-out view say "Your account is deleted. Everything on this phone stays." above the sign-in form;
       - the tab signs out locally.
     - **Texts:** `auth.deleteAccount`, in en, de, fr and es.
     - **Mocks:** `mockSupabaseData` answers `rpc/delete_my_account` by emptying the tables; with `twoStep`, it refuses a token below aal2 (`42501`), as the database does.
     - **`e2e/account-deletion.spec.ts`** (3 tests), listed under `/settings/account`:
       - the button waits for the word, and a wrong password deletes nothing;
       - the deletion empties the account, unlinks the phone and keeps the plan;
       - a two-step account asks for the code;
       - the flow in German.
3. **Other phones and docs.**
   - Unlink on the deleted-user answer.
   - CLAUDE.md:
     - account deletion leaves "left out";
     - the schema rule notes that deleting the account is the one hard delete;
     - the outgoing requests.
   - The real try on the hosted project with a throwaway account (needs `db push` of the migration, which Roshan runs).

## Verification

- **Every chunk:** `npm run lint`, `npm run typecheck`, the touched unit tests; the full suite and e2e in CI.
- **Chunk 1:** CI's `db` job (`test:db`, `test:contract`).
- **Chunk 3:** Roshan's try: delete a throwaway account on the phone, check it can't sign in, and check a second phone linked to it unlinks.

## Left out

- **"Export my data" from the account itself.** The phone's backup file already holds everything the account holds.
- **Deleting with an emailed code,** once the email sender is live (P2.4 go-live).
- **A grace period or undo.** The deletion is immediate, and the text says so.
