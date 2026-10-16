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
        await requestPersistence();
      } catch (error) {
        console.error('StudentsBudget: could not prepare the local database', error);
      }
    }
    void init();
  }, []);

  return null;
}
