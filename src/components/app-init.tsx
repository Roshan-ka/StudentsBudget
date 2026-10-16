'use client';

import { useEffect } from 'react';
import { requestPersistence } from '@/db/db';
import { ensureSeeded } from '@/db/repo';

/** Prepares the local database once on mount. Renders nothing. */
export function AppInit() {
  useEffect(() => {
    async function init() {
      try {
        await ensureSeeded();
      } catch (error) {
        console.error('StudentsBudget: could not seed the local database', error);
      }
      try {
        await requestPersistence();
      } catch (error) {
        console.error('StudentsBudget: could not request persistent storage', error);
      }
    }
    void init();
  }, []);

  return null;
}
