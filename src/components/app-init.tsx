'use client';

import { useEffect } from 'react';
import { requestPersistence } from '@/db/db';
import { refreshRates } from '@/db/rates';
import { ensureSeeded } from '@/db/repo';
import { postDueRecurring } from '@/features/recurring/post-due';
import { todayIso } from '@/lib/dates';
import { registerServiceWorker } from '@/lib/sw-register';

async function refreshExchangeRates() {
  try {
    await refreshRates(todayIso());
  } catch (error) {
    console.error('StudentsBudget: could not refresh the exchange rates', error);
  }
}

async function postRecurring() {
  try {
    await postDueRecurring(todayIso());
  } catch (error) {
    console.error('StudentsBudget: could not add the fixed costs and income that are due', error);
  }
}

/**
 * Fixed costs and income that are due are added once the rate refresh has settled, whether it worked or not, so a
 * foreign-currency line converts with today's rate when there is one. A line still without a rate waits for the next run.
 */
async function refreshThenPost() {
  await refreshExchangeRates();
  await postRecurring();
}

async function startServiceWorker() {
  try {
    await registerServiceWorker({
      production: process.env.NODE_ENV === 'production',
      supported: 'serviceWorker' in navigator,
      // Set in next.config.ts and inlined at build time.
      version: process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'local',
    });
  } catch (error) {
    console.error('StudentsBudget: could not start the service worker', error);
  }
}

/**
 * Prepares the local database on mount, keeps the exchange rates current, adds the fixed costs and income that are
 * due, and starts the service worker that opens the app offline (production builds only). Renders nothing.
 */
export function AppInit() {
  useEffect(() => {
    // An installed iPhone app can stay suspended for days without remounting, so check again on return.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void refreshThenPost();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    async function init() {
      try {
        await ensureSeeded();
      } catch (error) {
        console.error('StudentsBudget: could not seed the local database', error);
      }
      // Neither waits for the other: a hung connection holds the rates (and the posting after them) for the 10 s
      // fetch timeout, and some browsers hold the persistence promise open until the person answers a prompt.
      void refreshThenPost();
      try {
        await requestPersistence();
      } catch (error) {
        console.error('StudentsBudget: could not request persistent storage', error);
      }
    }
    void init();
    void startServiceWorker();

    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return null;
}
