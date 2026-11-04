// Whether this phone has seen the mic button's note on where speech goes (`entries.quickAdd.micNote`), shown once
// before the first use. Per phone, like the language choice: never synced or backed up.

/** Where this phone keeps the flag (localStorage). */
export const MIC_NOTE_KEY = 'studentsbudget-mic-note';

/** True once the note was shown and accepted here. Blocked storage (a private window) reads as not seen. */
export function micNoteSeen(): boolean {
  try {
    return localStorage.getItem(MIC_NOTE_KEY) === 'seen';
  } catch {
    return false;
  }
}

/** Remembers that the note was accepted. With blocked storage it is simply shown again next time. */
export function markMicNoteSeen(): void {
  try {
    localStorage.setItem(MIC_NOTE_KEY, 'seen');
  } catch {
    // Nothing to do: the note shows again, which is harmless.
  }
}
