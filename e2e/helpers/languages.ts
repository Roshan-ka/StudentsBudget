import type { Page } from '@playwright/test';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, OFFERED, type Language } from '../../src/i18n/languages';

/**
 * The languages besides the default that this run tours (language-tour.spec.ts), from E2E_LANGUAGES, which ci.yml
 * sets from the run's `languages` option: `all` tours every offered one; `default`, or nothing (a laptop), none. The
 * language switch itself (language.spec.ts) runs either way.
 */
export function tourLanguages(): Language[] {
  return process.env.E2E_LANGUAGES === 'all' ? OFFERED.filter((code) => code !== DEFAULT_LANGUAGE) : [];
}

/** Chooses `code` on this phone, as the picker would, and reloads the page in it. */
export async function chooseLanguage(page: Page, code: Language) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [LANGUAGE_STORAGE_KEY, code]);
  await page.reload();
}
