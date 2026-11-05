import { useEffect } from 'react';

/** The app's name, after each page's own in the browser's title. */
export const APP_NAME = 'StudentsBudget';

/** "Settings · StudentsBudget": the page first, so a tab or a screen reader names it before the app. */
export function pageTitle(heading: string): string {
  return `${heading} · ${APP_NAME}`;
}

/**
 * Puts the page's heading in the browser's title while the page shows (accessibility, chunk 2). Next's route
 * announcer speaks a new title after a page change, and with one title for every page it never spoke. A page the
 * router keeps mounted but hidden sets it again when it shows, and a change of language follows.
 */
export function usePageTitle(heading: string): void {
  useEffect(() => {
    document.title = pageTitle(heading);
  }, [heading]);
}
