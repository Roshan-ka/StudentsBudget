'use client';

import { useEffect } from 'react';
import { requestPersistence } from '@/db/db';
import { refreshRates } from '@/db/rates';
import { ensureSeeded } from '@/db/repo';
import { startAutoSync, visitAutoSync } from '@/features/account/auto-sync';
import { finishPendingWipe, wipePending } from '@/features/account/pending-wipe';
import { inStartOrder } from '@/features/account/start-order';
import { followSessionForPhone } from '@/features/account/signed-out-effects';
import { recordCompletedWeeks } from '@/features/badges/week-results';
import { MAP_SET } from '@/features/discounts/map/map-set';
import { postDueRecurring } from '@/features/recurring/post-due';
import { keepReminderInStep } from '@/features/reminder/in-step';
import { markSignedOut } from '@/features/start/signed-out';
import { subscribeToLanguage } from '@/i18n/store';
import { todayIso } from '@/lib/dates';
import { msUntilNextMidnight } from '@/lib/use-today';
import { getSupabase } from '@/lib/supabase/client';
import type { VisitReason } from '@/sync/auto-runner';
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
 * One visit, in the start order (`inStartOrder`, automatic sync, chunk 5): a linked phone syncs first (for at most
 * 8 s), then the rates are refreshed, then the fixed costs and income that are due are added once the refresh has
 * settled, whether it worked or not, so a foreign-currency line converts with today's rate when there is one (a line
 * still without a rate waits for the next run). The weeks that are over are saved last, for the badges, and only after
 * this visit's sync succeeded, or on a phone with no link.
 */
async function refreshThenPost(reason: VisitReason) {
  try {
    await inStartOrder(
      visitAutoSync(reason),
      { rates: refreshExchangeRates, recurring: postRecurring, weeks: recordWeeks },
      { setTimer: (callback, ms) => window.setTimeout(callback, ms), clearTimer: (handle) => window.clearTimeout(handle as number) },
    );
  } catch (error) {
    console.error('StudentsBudget: could not finish the start of this visit', error);
  }
}

/**
 * A wipe a sign-out still owes this phone (`pending-wipe.ts`): done now, while nobody is signed in, and then the start
 * page opens as after a sign-out. Returns true when the page is on its way there.
 */
async function finishSignOut(): Promise<boolean> {
  const supabase = getSupabase();
  if (supabase === null || !wipePending()) return false;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session !== null) return false;
  } catch (error) {
    console.error('StudentsBudget: could not read the session', error);
    return false;
  }
  if ((await finishPendingWipe()) !== 'done') return false;
  markSignedOut();
  window.location.replace('/start');
  return true;
}

async function startServiceWorker() {
  try {
    await registerServiceWorker({
      production: process.env.NODE_ENV === 'production',
      supported: 'serviceWorker' in navigator,
      // Set in next.config.ts and inlined at build time.
      version: process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'local',
      mapSet: MAP_SET.id,
    });
  } catch (error) {
    console.error('StudentsBudget: could not start the service worker', error);
  }
}

/**
 * Prepares the local database on mount, keeps the exchange rates current, adds the fixed costs and income that are
 * due, saves the weeks that are over, keeps this phone's weekly reminder on its time zone and language, starts the
 * automatic sync of a linked phone, and starts the service worker that opens the app offline (production builds
 * only). Renders nothing.
 */
export function AppInit() {
  useEffect(() => {
    // An installed iPhone app can stay suspended for days without remounting, so check again on return.
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      // A linked phone syncs first on each return (automatic sync, docs/superpowers/plans/2026-11-10-automatic-sync.md).
      void refreshThenPost('return');
      void keepReminderInStep();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    // A desktop tab can stay visible overnight, as useToday knows: the window coming back to the front and each
    // midnight post what came due and record the week that ended too (review, 09-11-2026). Cheap when nothing is due:
    // the rates are fetched at most once a day, and posting and recording are idempotent.
    function onFocus() {
      void refreshThenPost('focus');
    }
    window.addEventListener('focus', onFocus);
    let midnight: ReturnType<typeof setTimeout> | undefined;
    function atMidnight() {
      void refreshThenPost('midnight');
      midnight = setTimeout(atMidnight, msUntilNextMidnight());
    }
    midnight = setTimeout(atMidnight, msUntilNextMidnight());
    // A language picked here or in another tab: the reminder comes in it from then on.
    const stopFollowingLanguage = subscribeToLanguage(() => void keepReminderInStep());
    // What goes with the account when the session ends, heard here for every page, hidden ones included.
    const stopFollowingSession = followSessionForPhone();

    // The effect of a dev remount (StrictMode) must not mark the page once it has been cleaned up.
    let live = true;
    let stopAutoSync = () => {};

    async function init() {
      // A sign-out whose wipe failed or never finished clears the phone first.
      if (await finishSignOut()) return;
      try {
        await ensureSeeded();
      } catch (error) {
        console.error('StudentsBudget: could not seed the local database', error);
      }
      // The app's ready signal for the e2e specs (`waitForApp`, e2e/helpers/app.ts): React has hydrated the layout and
      // the database is open, its schema created and its categories seeded. A bare data attribute, so nothing a person
      // or a screen reader meets changes, and no style reads it.
      if (live) document.documentElement.setAttribute(APP_READY_ATTRIBUTE, '');
      // A linked phone syncs by itself from here on: on opening, returning, reconnecting, after a change and every
      // minute while visible. After the ready signal, so nothing it waits for holds the page back.
      if (live) stopAutoSync = startAutoSync();
      // Neither waits for the other: the opening sync (8 s at most) and a hung connection (the rates' 10 s fetch
      // timeout) hold the posting back, and some browsers hold the persistence promise open until the person answers a
      // prompt.
      void refreshThenPost('open');
      void keepReminderInStep();
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
      stopAutoSync();
      document.documentElement.removeAttribute(APP_READY_ATTRIBUTE);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      clearTimeout(midnight);
      stopFollowingLanguage();
      stopFollowingSession();
    };
  }, []);

  return null;
}
