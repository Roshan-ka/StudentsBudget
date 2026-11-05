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
 *
 * Next writes the layout's title ("StudentsBudget") when it applies a page's metadata, and in WebKit that comes
 * after this effect, so the page puts its own back whenever the title changes while it shows.
 */
export function usePageTitle(heading: string): void {
  useEffect(() => {
    const wanted = pageTitle(heading);
    const apply = () => {
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    // The title element may be replaced as well as rewritten, and where Next streams it is its own business.
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [heading]);
}
