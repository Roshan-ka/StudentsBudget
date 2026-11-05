import type { Page } from '@playwright/test';
import { PRIVACY_NOTES, type PrivacyNoteId } from '../../src/features/privacy/notes';

/**
 * Marks one-time data-protection notes as accepted before the page loads, so a spec about something else isn't stopped
 * by one: the notes named, or every note. The notes themselves are tested in privacy-notes.spec.ts (the mic's in
 * dictation.spec.ts, so a helper it uses must not accept that one).
 */
export async function acceptPrivacyNotes(page: Page, ids?: PrivacyNoteId[]) {
  const keys = ids ? ids.map((id) => PRIVACY_NOTES[id]) : Object.values(PRIVACY_NOTES);
  await page.addInitScript((list) => {
    for (const key of list) localStorage.setItem(key, 'seen');
  }, keys);
}
