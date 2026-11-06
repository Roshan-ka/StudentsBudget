import type { Page } from '@playwright/test';

/**
 * WebKit's report of a Next prefetch that a full page load cut off: "Fetch API cannot load http://…/?_rsc=… due to
 * access control checks.", uncaught. A restore ends with `window.location.replace('/')` just as the bottom navigation
 * appears and prefetches its links; Chrome reports the same cut-off as an abort, which Next ignores. Only a production
 * build prefetches, so the specs met it once they ran against one.
 */
const CUT_OFF_PREFETCH = /\?_rsc=\S+ due to access control checks\.?$/;

/** The page's uncaught errors as they come, less WebKit's reports of prefetches a full page load cut off. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    if (!CUT_OFF_PREFETCH.test(error.message)) errors.push(error.message);
  });
  return errors;
}
