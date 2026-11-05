import { useEffect, useState } from 'react';

/** How long typing must pause before a live total changes. */
const SETTLE_MS = 600;

/**
 * `value` once it has stopped changing for a moment: for a total in a live region that follows what is typed, so a
 * screen reader reads it once the typing pauses, not after every key (accessibility, chunk 6). The first render
 * shows `value` at once.
 */
export function useSettled<T>(value: T): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);
  return settled;
}
