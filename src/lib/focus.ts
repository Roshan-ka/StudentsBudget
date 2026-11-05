import { useEffect, useRef, useState, type RefObject } from 'react';

// Focus that follows a part of the page as it opens, closes or goes (accessibility plan, chunk 3:
// docs/superpowers/plans/2026-11-05-accessibility.md). Without it, focus fell to <body> whenever a panel replaced the
// button that opened it, and a keyboard or screen-reader user started again from the top.

/** The controls a part's first focus can go to. */
const FOCUSABLE =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]';

/**
 * A ref that takes the focus once its element has mounted: a part that opened on a tap. With `first`, the focus goes
 * to the element's first control instead (a form that opens on its fields); without, to the element itself, which
 * then needs `tabIndex={-1}` (a heading, a question).
 */
export function useFocusOnMount<T extends HTMLElement>(first = false): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const target = first ? (element.querySelector<HTMLElement>(FOCUSABLE) ?? element) : element;
    target.focus();
  }, [first]);
  return ref;
}

/** The bookkeeping of `useFocusAfter`, apart from React so it can be tested. */
export function createFocusAfter() {
  let pending: string | null = null;
  return {
    /** The focus goes to the element `refFor(key)` gives, once it is there: call it before the change. */
    mark(key: string) {
      pending = key;
    },
    /**
     * The ref for an element that may take the focus. A fresh callback each render, so React calls it on every
     * commit: an element that stays mounted (a list's heading) takes a mark as well as one that mounts anew.
     */
    refFor(key: string) {
      return (element: HTMLElement | null) => {
        if (element === null || pending !== key) return;
        pending = null;
        element.focus();
      };
    },
  };
}

/**
 * Focus that waits for its element: `mark(key)` just before a change that removes what had the focus (a panel closes,
 * a row is deleted), and `refFor(key)` on what should take it (the button that opened the panel, the next row). The
 * element takes the focus in the first commit it is part of after the mark.
 */
export function useFocusAfter() {
  const [focus] = useState(createFocusAfter);
  return focus;
}
