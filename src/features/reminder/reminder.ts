import type { SupabaseClient } from '@supabase/supabase-js';
import type { Messages } from '@/i18n/messages';
import { readPref, usePref, writePref } from '@/lib/phone-pref';
import { isSupabaseConfigured } from '@/lib/supabase/env';

// The weekly reminder on this phone (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 4): whether the browser
// can show one, turning it on (the permission, the push subscription, the account's row through
// `save_push_subscription`), changing its day or time, and turning it off. This phone keeps a copy of what it chose
// (localStorage, like the other per-phone choices: not synced, not backed up), so Settings can say "Off" or "Sundays at
// 18:00" without asking the account. Since chunk 5 the copy also holds the time zone and language last saved, so the
// app can keep the account's row in step with the phone without asking it (`followPhone`), and signing out turns the
// reminder off (`reminderOffBeforeSignOut`, then `forgetReminderOnPhone`).

/** Where this phone keeps its reminder. */
export const REMINDER_PREF = 'studentsbudget-reminder';

/** A day (1–7, Monday = 1) and a quarter hour ('HH:MM') on this phone's clock. */
export type ReminderChoice = { weekday: number; time: string };
/** This phone's copy: on or off, the day and time, and the zone and language last saved with them (none before then). */
export type PhoneReminder = ReminderChoice & { on: boolean; timeZone?: string; lang?: string };

/** Off, and Sunday at 18:00 once turned on (Roshan, 05-11-2026). */
export const DEFAULT_REMINDER: PhoneReminder = { on: false, weekday: 7, time: '18:00' };

/** Every quarter hour of a day, '00:00' to '23:45': the times the table takes. */
export const QUARTER_HOURS: readonly string[] = Array.from(
  { length: 96 },
  (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
);

/** The stored reminder, or the default for none or anything this build can't read. */
export function parsePhoneReminder(value: string | null): PhoneReminder {
  if (value === null) return DEFAULT_REMINDER;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_REMINDER;
    const { on, weekday, time, timeZone, lang } = parsed as Record<string, unknown>;
    if (
      typeof on === 'boolean' &&
      typeof weekday === 'number' &&
      Number.isInteger(weekday) &&
      weekday >= 1 &&
      weekday <= 7 &&
      typeof time === 'string' &&
      QUARTER_HOURS.includes(time)
    ) {
      return {
        on,
        weekday,
        time,
        ...(typeof timeZone === 'string' && { timeZone }),
        ...(typeof lang === 'string' && { lang }),
      };
    }
  } catch {
    // Not JSON: the default.
  }
  return DEFAULT_REMINDER;
}

export function readPhoneReminder(): PhoneReminder {
  return parsePhoneReminder(readPref(REMINDER_PREF));
}

/** This phone's reminder as a hook: the default in the first render (pages hydrate as built), the stored one after. */
export function usePhoneReminder(): PhoneReminder {
  return parsePhoneReminder(usePref(REMINDER_PREF));
}

function savePhoneReminder(reminder: PhoneReminder): void {
  writePref(REMINDER_PREF, JSON.stringify(reminder));
}

/** What Settings says of this phone's reminder: "Off", or "Sundays at 18:00". */
export function reminderSummary(reminder: PhoneReminder, text: Messages['reminder']): string {
  return reminder.on ? text.summaryOn(text.everyDay[reminder.weekday - 1], reminder.time) : text.summaryOff;
}

/** The VAPID public key this build's reminders are sent with, or null: without it there is nothing to turn on. */
export function vapidPublicKey(): string | null {
  // Written out in full, so Next puts the value in the build.
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

/** Whether this build can send reminders at all: a Supabase project and a VAPID key. Safe during render. */
export function remindersInBuild(): boolean {
  return isSupabaseConfigured() && vapidPublicKey() !== null;
}

/**
 * Whether this browser can show the reminder: `ok`; `install-first` on an iPhone or iPad whose Safari tab has no push
 * (Apple allows it only to an app added to the Home Screen); `no-push` for a browser without it; `denied` when
 * notifications are blocked for the app.
 */
export type PushSupport = 'ok' | 'install-first' | 'no-push' | 'denied';

/** What `pushSupport` needs to know about the browser. */
export type BrowserFacts = {
  userAgent: string;
  maxTouchPoints: number;
  /** Opened from the Home Screen: `display-mode: standalone`, or Safari's own `navigator.standalone`. */
  installed: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  permission: NotificationPermission | null;
};

export function pushSupport(facts: BrowserFacts): PushSupport {
  // iPadOS asks for the desktop site, so an iPad says Macintosh; only it has a touch screen among them.
  const apple = /iPhone|iPad|iPod/.test(facts.userAgent) || (facts.userAgent.includes('Macintosh') && facts.maxTouchPoints > 1);
  if (apple && !facts.installed) return 'install-first';
  if (!facts.hasServiceWorker || !facts.hasPushManager || facts.permission === null) return 'no-push';
  if (facts.permission === 'denied') return 'denied';
  return 'ok';
}

/** The browser's facts, read in an effect or an event handler (never while rendering: the page is prerendered). */
export function browserFacts(): BrowserFacts {
  const safari = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    installed: window.matchMedia?.('(display-mode: standalone)').matches === true || safari.standalone === true,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    permission: 'Notification' in window ? Notification.permission : null,
  };
}

/** The phone's time zone and the app's language, saved with the reminder so it comes on the phone's clock, in its words. */
export type ReminderPlace = { timeZone: string; lang: string };

export function phoneTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
}

/** The browser's side of push, passed in so tests can play it. */
export type PushPlatform = {
  requestPermission(): Promise<NotificationPermission>;
  /** The app's service worker registration, once it is active. */
  registration(): Promise<{ pushManager: Pick<PushManager, 'getSubscription' | 'subscribe'> }>;
};

/** How long to wait for the service worker. It is there in every production build; `next dev` never registers it. */
const WORKER_TIMEOUT_MS = 10_000;

export const browserPush: PushPlatform = {
  requestPermission: () => Notification.requestPermission(),
  registration: () =>
    Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('The service worker is not running')), WORKER_TIMEOUT_MS),
      ),
    ]),
};

type Db = Pick<SupabaseClient, 'rpc' | 'from'>;

/**
 * What turning on or saving came to: `saved`; `dismissed` when the permission prompt was closed, `denied` when it was
 * refused; `not-supported` when the browser's push service isn't one the app sends to (the table's check);
 * `failed` for anything else (offline, say).
 */
export type SaveResult = 'saved' | 'dismissed' | 'denied' | 'not-supported' | 'failed';

/** The VAPID public key as the bytes `pushManager.subscribe` takes. */
export function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * Turns the reminder on: asks for permission first, from the tap itself (Safari allows the prompt only there, so
 * nothing is awaited before it), then subscribes this phone and saves its row.
 */
export async function turnOnReminder(
  db: Db,
  choice: ReminderChoice,
  place: ReminderPlace,
  key: string,
  push: PushPlatform = browserPush,
): Promise<SaveResult> {
  let permission: NotificationPermission;
  try {
    permission = await push.requestPermission();
  } catch {
    return 'failed';
  }
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'dismissed';
  return subscribeAndSave(db, choice, place, key, push);
}

/** Saves a new day or time (or a moved zone or language) for the reminder that is on. */
export function changeReminder(
  db: Db,
  choice: ReminderChoice,
  place: ReminderPlace,
  key: string,
  push: PushPlatform = browserPush,
): Promise<SaveResult> {
  return subscribeAndSave(db, choice, place, key, push);
}

async function subscribeAndSave(
  db: Db,
  choice: ReminderChoice,
  place: ReminderPlace,
  key: string,
  push: PushPlatform,
): Promise<SaveResult> {
  try {
    const { pushManager } = await push.registration();
    // The phone keeps one subscription for the app: an earlier one is used again.
    const subscription =
      (await pushManager.getSubscription()) ??
      (await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    const result = await saveRow(db, subscription, choice, place);
    if (result === 'saved') savePhoneReminder({ on: true, weekday: choice.weekday, time: choice.time, ...place });
    return result;
  } catch {
    return 'failed';
  }
}

/** Saves this phone's row for `subscription`. The phone's copy is the caller's, once the account has it. */
async function saveRow(
  db: Db,
  subscription: PushSubscription,
  choice: ReminderChoice,
  place: ReminderPlace,
): Promise<SaveResult> {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) return 'failed';
  const { error } = await db.rpc('save_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_weekday: choice.weekday,
    p_local_time: choice.time,
    p_time_zone: place.timeZone,
    p_lang: place.lang,
  });
  if (error) {
    // The table refuses an address at a push service it doesn't know.
    return error.code === '23514' && error.message.includes('endpoint') ? 'not-supported' : 'failed';
  }
  return 'saved';
}

/** What `followPhone` came to: `off` and `same` send nothing. */
export type FollowResult = 'off' | 'same' | 'saved' | 'failed';

/**
 * Keeps the account's row in step with the phone (chunk 5): while this phone's reminder is on, a time zone or language
 * other than the one last saved is saved, with the day and time as they are. Only for the subscription the phone has:
 * it never subscribes anew or asks for anything, so it can run without a tap. Never throws.
 */
export async function followPhone(db: Db, place: ReminderPlace, push: PushPlatform = browserPush): Promise<FollowResult> {
  const reminder = readPhoneReminder();
  if (!reminder.on) return 'off';
  if (reminder.timeZone === place.timeZone && reminder.lang === place.lang) return 'same';
  try {
    const { pushManager } = await push.registration();
    const subscription = await pushManager.getSubscription();
    if (subscription === null) return 'failed';
    if ((await saveRow(db, subscription, reminder, place)) !== 'saved') return 'failed';
    // Turned off, or signed out, while it was saving: the copy stays off (the row goes with the 410 of its next send).
    const now = readPhoneReminder();
    if (now.on) savePhoneReminder({ ...now, ...place });
    return 'saved';
  } catch {
    return 'failed';
  }
}

/**
 * Turns the reminder off: deletes this phone's row, then drops the subscription. A row that can't be deleted (offline)
 * leaves everything on, so the reminder never keeps coming to a phone that thinks it is off.
 */
export async function turnOffReminder(db: Db, push: PushPlatform = browserPush): Promise<'off' | 'failed'> {
  try {
    const { pushManager } = await push.registration();
    const subscription = await pushManager.getSubscription();
    if (subscription !== null) {
      const { error } = await db.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      if (error) return 'failed';
      await subscription.unsubscribe();
    }
  } catch {
    return 'failed';
  }
  savePhoneReminder({ ...readPhoneReminder(), on: false });
  return 'off';
}

/** How long signing out waits for the row's delete: as long as for its last sync, which runs beside it. */
const SIGN_OUT_MS = 8_000;

/**
 * Before signing out (chunk 5): while this phone's reminder is on, its row is deleted and its subscription dropped, as
 * Turn off does, waiting a few seconds at most. Whatever doesn't make it, `forgetReminderOnPhone` finishes once the
 * phone is signed out. Never throws.
 */
export async function reminderOffBeforeSignOut(db: Db, push: PushPlatform = browserPush): Promise<void> {
  if (!readPhoneReminder().on) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, SIGN_OUT_MS));
  await Promise.race([turnOffReminder(db, push), timeout]);
}

/**
 * Once this phone is signed out (`useAuth`'s SIGNED_OUT: a sign-out here or in another tab, a session that ended, a
 * deleted account): the reminder goes off here, and its subscription is dropped, so nothing more arrives. A row the
 * account still holds for it goes at its next send, when the push service answers that the address is gone. Never
 * throws.
 */
export async function forgetReminderOnPhone(push: PushPlatform = browserPush): Promise<void> {
  const reminder = readPhoneReminder();
  if (!reminder.on) return;
  // Off first, so a second call (each page's useAuth hears the event) finds nothing to do.
  savePhoneReminder({ ...reminder, on: false });
  try {
    const { pushManager } = await push.registration();
    await (await pushManager.getSubscription())?.unsubscribe();
  } catch (error) {
    console.error('StudentsBudget: could not drop the weekly reminder’s subscription after signing out', error);
  }
}
