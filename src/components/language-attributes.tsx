'use client';

import { useLayoutEffect } from 'react';
import { applyLanguageToDocument, getLanguageSnapshot } from '@/i18n/store';
import { useLanguage } from '@/i18n/use-t';

/**
 * Keeps <html lang> and dir on this phone's language after a choice, and after React's development remount clears
 * what the head script set (in production it changes nothing). It reads the phone's language itself rather than the
 * hook's value, which is the default in the first render and would undo the head script for a moment. Renders nothing.
 */
export function LanguageAttributes() {
  const language = useLanguage();
  useLayoutEffect(() => {
    applyLanguageToDocument(getLanguageSnapshot());
  }, [language]);
  return null;
}
