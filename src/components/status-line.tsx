'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** How long a new status line stays empty: long enough for a screen reader to start listening to it. */
const FILL_DELAY_MS = 150;

/**
 * A status line that shows up with its news ("Transfer saved."), and is read out. A screen reader reads the changes of
 * a live region it already knows, not one that arrives with its text, so the line mounts empty and takes its text a
 * moment later (accessibility, chunk 6).
 *
 * It is there only while it has something to say. A page never holds an empty status line, so the specs' unscoped
 * `getByRole('status')` still finds the one that speaks. A line that lives for the whole page stays a plain
 * `role="status"` element, as quick add's does.
 */
export function StatusLine({ children, className }: { children: ReactNode; className?: string }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setFilled(true), FILL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <p role="status" className={className}>
      {filled ? children : null}
    </p>
  );
}
