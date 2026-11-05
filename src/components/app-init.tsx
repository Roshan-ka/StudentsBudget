'use client';

import { useEffect } from 'react';
import { requestPersistence } from '@/db/db';
import { refreshRates } from '@/db/rates';
import { ensureSeeded } from '@/db/repo';
import { recordCompletedWeeks } from '@/features/badges/week-results';
import { postDueRecurring } from '@/features/recurring/post-due';
import { todayIso } from '@/lib/dates';
import { registerServiceWorker } from '@/lib/sw-register';

/** Set on `<html>` once the app has started (see `init` below). e2e/helpers/app.ts waits on the same name. */
const APP_READY_ATTRIBUTE = 'data-app-ready';

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

async function recordWeeks() {
  try {
    await recordCompletedWeeks(todayIso());
  } catch (error) {
    console.error('StudentsBudget: could not save the weeks that are over', error);
  }
}

/**
 * Fixed costs and income that are due are added once the rate refresh has settled, whether it worked or not, so a
 * foreign-currency line converts with today's rate when there is one. A line still without a rate waits for the next run.
 * The weeks that are over are saved after that, for the badges.
 */
async function refreshThenPost() {
  await refreshExchangeRates();
  await postRecurring();
  await recordWeeks();
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
 * due, saves the weeks that are over, and starts the service worker that opens the app offline (production builds
 * only). Renders nothing.
 */
export function AppInit() {
  useEffect(() => {
    // An installed iPhone app can stay suspended for days without remounting, so check again on return.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void refreshThenPost();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // The effect of a dev remount (StrictMode) must not mark the page once it has been cleaned up.
    let live = true;

    async function init() {
      try {
        await ensureSeeded();
      } catch (error) {
        console.error('StudentsBudget: could not seed the local database', error);
      }
      // The app's ready signal for the e2e specs (`waitForApp`, e2e/helpers/app.ts): React has hydrated the layout and
      // the database is open, its schema created and its categories seeded. A bare data attribute, so nothing a person
      // or a screen reader meets changes, and no style reads it.
      if (live) document.documentElement.setAttribute(APP_READY_ATTRIBUTE, '');
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

    return () => {
      live = false;
      document.documentElement.removeAttribute(APP_READY_ATTRIBUTE);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
