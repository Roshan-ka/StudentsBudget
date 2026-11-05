# Data-protection notes

## Context

The legal pages (Impressum and privacy) wait until the website is finished. Until then, Roshan wants each feature that sends data to someone else to say so once, before its first use, as the mic's note already says that Chrome sends the recording to Google (Roshan, 05-11-2026). The discount map waits too.

## The rule

A feature that sends data to someone else shows a one-time note, inline, before its first use on a phone: what goes to whom. Continue remembers it on this phone and goes on from the same tap; Cancel sends nothing. A note states only what is certain. Per phone, like the language choice: never synced or backed up.

## The notes

| Feature | Who gets what | When the note shows | Chunk |
|---|---|---|---|
| Mic | The browser's speech service (Google in Chrome) gets the recording | First tap on the mic | 1 (moved onto the shared note) |
| Creating an account | Supabase (Frankfurt, EU) keeps the email, the password as a hash, the phone's language and a copy of the synced data; codes come by email | The first "Create account" on this phone, after the form's own checks | 1 |
| Passkeys | The phone's password manager keeps the passkey and may sync it; the account keeps only the public key | The first "Add a passkey" | 1 |
| Exchange rates | Frankfurter (the ECB's rates) gets the currency codes and the phone's IP, only for non-euro accounts | The first non-euro currency | 2 |
| Discount votes, signed in | A vote counts in the totals other students see; nobody sees who voted | The first vote while signed in | 2 |

Not noted, on purpose: the source links (plain links to other sites), the backup and calendar files (they stay on the phone) and the hosting. They belong on the privacy page.

## Chunk 1, as built (2026-11-05)

- **`src/features/privacy/notes.ts`:** `PRIVACY_NOTES` (one localStorage key per note; the mic keeps its older `studentsbudget-mic-note`, so no phone sees it twice), `noteSeen` and `markNoteSeen`. Blocked storage reads as not seen and never throws.
- **`privacy-note.tsx`:** `PrivacyNote`, the inline card the mic had (a labelled group with the text, Continue and Cancel). Continue marks the note seen, then goes on.
- **Mic:** `quick-add-field.tsx` uses `PrivacyNote`; `mic-note.ts` is gone.
- **Account:** `SignInForm` (`account-view.tsx`) runs its checks first (credentials, offline), then shows the note in place of the Create button. Continue creates the account (`submit(true)`, so blocked storage can't loop the note); switching to Sign in or leaving the page closes it.
- **Passkey:** `PasskeysSection` (`passkeys.tsx`) shows the note in place of "Add a passkey". Continue starts the registration from the same tap; Cancel puts the focus back on Add.
- **Texts:** `auth.privacy` (label, Continue, Cancel, the account and passkey texts) in en, de, fr and es. French with `NNBSP`.
- **Tests:**
  - `notes.test.ts`: the flags, the mic's kept key, unique keys, blocked storage.
  - `e2e/privacy-notes.spec.ts` (under `/settings/account` in the affected map): the account note (Cancel sends no sign-up, Continue signs up, the next account goes straight on), in German too, and the passkey note on Chromium (Cancel makes no registration, Continue adds one).
  - `acceptPrivacyNotes` (`e2e/helpers/privacy.ts`) in `account`, `email-codes` and `passkeys` specs, so they aren't stopped by a note.

## Chunk 2

The exchange-rate note (wherever a non-euro currency is first chosen: setup, Settings, Edit plan) and the discount-vote note (the first vote while signed in), with their keys in `PRIVACY_NOTES`, texts in four languages, and e2e for each.
