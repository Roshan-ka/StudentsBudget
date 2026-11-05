import type { Page } from '@playwright/test';
import { PRIVACY_NOTES } from '../../src/features/privacy/notes';

/**
 * Marks every one-time data-protection note as accepted before the page loads, so a spec about something else isn't
 * stopped by one. The notes themselves are tested in privacy-notes.spec.ts (the mic's in dictation.spec.ts).
 */
export async function acceptPrivacyNotes(page: Page) {
  await page.addInitScript((keys) => {
    for (const key of keys) localStorage.setItem(key, 'seen');
  }, Object.values(PRIVACY_NOTES));
}
