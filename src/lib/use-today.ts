import { useSyncExternalStore } from 'react';
import { todayIso, type IsoDate } from '@/lib/dates';

/** Milliseconds from `now` to the next local midnight. A day with a clock change is 23 or 25 hours long. */
export function msUntilNextMidnight(now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

/**
 * Calls `notify` when the date may have changed: when the app comes back to the front (an installed phone app
 * is resumed, not reloaded, so it can come back days later) and at the next midnight while it stays open.
 * `notify` is cheap when the date is the same, so over-calling it is fine.
 */
function subscribe(notify: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    notify();
    // Always aim at the next midnight from now, so a timer that slept through one is not left behind.
    clearTimeout(timer);
    timer = setTimeout(check, msUntilNextMidnight());
  };

  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  timer = setTimeout(check, msUntilNextMidnight());
  return () => {
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('focus', check);
    clearTimeout(timer);
  };
}

// A string, so two reads on the same day are equal and React does not re-render.
const getSnapshot = (): IsoDate => todayIso();

// No date on the server: the build's date is nobody's today, and reading the clock there breaks the prerender.
const getServerSnapshot = (): IsoDate | null => null;

/** Today's local date, kept current while the app is open. `null` until it runs in the browser. */
export function useToday(): IsoDate | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
