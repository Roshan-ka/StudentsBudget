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
- **Texts:** `common.privacy` (label, Continue, Cancel, and one text per note) in en, de, fr and es. French with `NNBSP`. (Built as `auth.privacy`, moved to `common` in chunk 2, when the notes reached setup, Settings and Tips.)
- **Tests:**
  - `notes.test.ts`: the flags, the mic's kept key, unique keys, blocked storage.
  - `e2e/privacy-notes.spec.ts` (under `/settings/account` in the affected map): the account note (Cancel sends no sign-up, Continue signs up, the next account goes straight on), in German too, and the passkey note on Chromium (Cancel makes no registration, Continue adds one).
  - `acceptPrivacyNotes` (`e2e/helpers/privacy.ts`) in `account`, `email-codes` and `passkeys` specs, so they aren't stopped by a note.

## Chunk 2, as built (2026-11-05)

- **Exchange rates** (`rates` in `PRIVACY_NOTES`): shown where an account in another currency is committed, after the form's own checks, in place of the buttons. Continue goes on from the same tap.
  - Settings → Accounts (`accounts-panel.tsx`): Save of a newly chosen currency other than the euro. An existing account that keeps its currency doesn't ask: nothing new is sent.
  - Setup (`setup-wizard.tsx`): Next from the accounts step when any account isn't in euros. The draft starts with Home bank in INR, so most new setups see it once. Edit plan has no accounts step.
  - Frankfurter is asked for nothing new before Continue: the account isn't saved until then, and the fetch only covers saved accounts.
- **Discount votes** (`votes`): signed in, the first tap on "Still works" or "Doesn't work anymore" shows the note under that discount. Continue saves the vote; Cancel puts the focus back on the button. Signed out, votes stay on the phone and need no note.
- **Texts:** `common.privacy.rates` and `.votes` in four languages.
- **Tests:** `privacy-notes.spec.ts` (now also under `/tips`; `/settings` and `/setup` run every spec) covers both places of the rates note and the vote note. `fillSetup` and the `setup`, `overdrawn`, `accounts` and `discount-confirmations` specs accept the notes up front.

**Known edges, left for the privacy page:**
- Votes given while signed out reach the account at the first link without the votes note. The account note already says a copy of the synced data is kept.
- Phones that had an account in another currency before this chunk keep fetching its rate without having seen the note.
