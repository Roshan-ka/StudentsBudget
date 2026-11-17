'use client';

import type { ReactNode } from 'react';
import { useSettled } from '@/lib/use-settled';

/**
 * `children` once `show` has held while typing paused (Roshan, 17-11-2026, review P7): a line's "Add it automatically"
 * appears after the amount is typed, not at its first digit, so the card doesn't grow and push Next under the thumb
 * mid-typing. It goes at once when `show` turns false, and a line that already shows on the first render stays.
 */
export function WhenSettled({ show, children }: { show: boolean; children: ReactNode }) {
  const settled = useSettled(show);
  return show && settled ? children : null;
}
