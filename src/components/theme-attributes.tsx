'use client';

import { useLayoutEffect } from 'react';
import { applyThemeToDocument, getThemeChoiceSnapshot, useThemeChoice } from '@/theme/store';
import { PREFERS_DARK } from '@/theme/themes';

/**
 * Keeps <html> on this phone's theme after a choice (here or in another tab) and after React's development remount,
 * and, under Same as phone, follows the phone when its own setting changes while the app is open. It reads the choice
 * itself rather than the hook's value, which is the default in the first render and would undo the head script for a
 * moment. Renders nothing.
 */
export function ThemeAttributes() {
  const choice = useThemeChoice();
  useLayoutEffect(() => {
    const current = getThemeChoiceSnapshot();
    applyThemeToDocument(current);
    if (current !== 'system') return;
    const phone = window.matchMedia(PREFERS_DARK);
    const follow = () => applyThemeToDocument('system');
    phone.addEventListener('change', follow);
    return () => phone.removeEventListener('change', follow);
  }, [choice]);
  return null;
}
