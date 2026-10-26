'use client';

import { useEffect, useRef, useState } from 'react';

/** Runs a state update, but only while the person is still on the visit the task started in. */
export type Show = (update: () => void) => void;

/**
 * Runs a save or a load: one at a time, and with what it shows dropped when the person left the page before it
 * finished. The router keeps the page mounted but hidden and runs its effect cleanups then; a question or result from
 * an earlier visit would be stale on the next one ("Save anyway" would send an old snapshot).
 */
export function useAccountTask() {
  const [busy, setBusy] = useState(false);
  // A ref, because a second tap can arrive before React has rendered the disabled button.
  const inFlight = useRef(false);
  // How often the page was left. A task compares it with the count it started with.
  const leftCount = useRef(0);
  useEffect(
    () => () => {
      leftCount.current += 1;
    },
    [],
  );

  /** Runs `task` unless one is running; a thrown error goes to `onError`. Both update state only through `show`. */
  async function run(task: (show: Show) => Promise<void>, onError: (error: unknown, show: Show) => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const visit = leftCount.current;
    const show: Show = (update) => {
      if (leftCount.current === visit) update();
    };
    try {
      await task(show);
    } catch (thrown) {
      onError(thrown, show);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { busy, run };
}
