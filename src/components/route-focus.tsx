'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** How long a page may take to show its heading (setup reads its data first), in frames. */
const MAX_FRAMES = 90;

/** The heading of the page that shows: hidden pages the router keeps mounted have no boxes. */
function shownHeading(): HTMLElement | null {
  const headings = document.querySelectorAll<HTMLElement>('main [data-page-heading]');
  return [...headings].find((heading) => heading.getClientRects().length > 0) ?? null;
}

/**
 * After a page change the focus goes to the new page's heading (accessibility, chunk 2): Next 16 leaves it where it
 * was, often on a link in the page it just hid, so a keyboard or screen-reader user started again from nowhere. The
 * first load leaves the focus where the browser puts it, and a change of the query alone (a month in Entries) moves
 * nothing.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let frame = 0;
    let frames = 0;
    const focus = () => {
      const heading = shownHeading();
      if (heading !== null) heading.focus();
      else if (frames++ < MAX_FRAMES) frame = requestAnimationFrame(focus);
    };
    focus();
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
