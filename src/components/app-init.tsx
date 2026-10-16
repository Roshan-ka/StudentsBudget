'use client';

import { useEffect } from 'react';
import { requestPersistence } from '@/db/db';
import { refreshRates } from '@/db/rates';
import { ensureSeeded } from '@/db/repo';
import { todayIso } from '@/lib/dates';

async function refreshExchangeRates() {
  try {
    await refreshRates(todayIso());
  } catch (error) {
    console.error('StudentsBudget: could not refresh the exchange rates', error);
  }
}

/** Prepares the local database on mount and keeps the exchange rates current. Renders nothing. */
export function AppInit() {
  useEffect(() => {
    // An installed iPhone app can stay suspended for days without remounting, so check again on return.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void refreshExchangeRates();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    async function init() {
      try {
        await ensureSeeded();
      } catch (error) {
        console.error('StudentsBudget: could not seed the local database', error);
      }
      // Before the persistence request: some browsers hold that promise open until the person answers a prompt.
      await refreshExchangeRates();
      try {
        await requestPersistence();
      } catch (error) {
        console.error('StudentsBudget: could not request persistent storage', error);
      }
    }
    void init();

    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return null;
}
