// One-time data-protection notes (docs/superpowers/plans/2026-11-05-privacy-notes.md): a feature that sends data to
// someone else says so once per phone, before its first use, and goes on only after Continue. Per phone, like the
// language choice: never synced or backed up. Blocked storage (a private window) just shows a note again.

/**
 * Each note, and where this phone keeps whether it was accepted (localStorage). The mic's key is older than the others
 * and is kept, so a phone that accepted the mic's note isn't asked again.
 */
export const PRIVACY_NOTES = {
  mic: 'studentsbudget-mic-note',
  account: 'studentsbudget-account-note',
  passkey: 'studentsbudget-passkey-note',
} as const;

export type PrivacyNoteId = keyof typeof PRIVACY_NOTES;

/** True once the note was accepted on this phone. Blocked storage reads as not accepted. */
export function noteSeen(id: PrivacyNoteId): boolean {
  try {
    return localStorage.getItem(PRIVACY_NOTES[id]) === 'seen';
  } catch {
    return false;
  }
}

/** Remembers that the note was accepted. With blocked storage it is simply shown again next time. */
export function markNoteSeen(id: PrivacyNoteId): void {
  try {
    localStorage.setItem(PRIVACY_NOTES[id], 'seen');
  } catch {
    // Nothing to do: the note shows again, which is harmless.
  }
}
