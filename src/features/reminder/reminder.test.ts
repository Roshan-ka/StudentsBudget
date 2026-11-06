import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import {
  changeReminder,
  DEFAULT_REMINDER,
  keyBytes,
  parsePhoneReminder,
  pushSupport,
  QUARTER_HOURS,
  readPhoneReminder,
  REMINDER_PREF,
  reminderSummary,
  turnOffReminder,
  turnOnReminder,
  type BrowserFacts,
  type PushPlatform,
} from './reminder';

// The weekly reminder on this phone (chunk 4): whether the browser can show it, and turning it on, changing it and
// turning it off, with the browser's push and the account played here.

let stored: Record<string, string>;

beforeEach(() => {
  stored = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => {
      stored[key] = value;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/this-phone';
const PLACE = { timeZone: 'Europe/Berlin', lang: 'de' };
// A P-256 public key's length (65 bytes), as base64url.
const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function subscription(endpoint = ENDPOINT) {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'BPhoneKey', auth: 'phone-auth' } }),
    unsubscribe: vi.fn(async () => true),
  };
}
type FakeSubscription = ReturnType<typeof subscription>;

/** The browser's push: the answer to the permission prompt, and the subscription the phone already has. */
function browser(permission: NotificationPermission, existing: FakeSubscription | null = null) {
  let current = existing;
  const subscribe = vi.fn<(options?: PushSubscriptionOptionsInit) => Promise<PushSubscription>>(async () => {
    current = subscription();
    return current as unknown as PushSubscription;
  });
  const registration = vi.fn(async () => ({
    pushManager: {
      getSubscription: async () => current as unknown as PushSubscription | null,
      subscribe,
    },
  }));
  const platform: PushPlatform = { requestPermission: vi.fn(async () => permission), registration };
  return { platform, subscribe, registration, current: () => current };
}

type PostgrestError = { code: string; message: string } | null;

/** The account: what `save_push_subscription` and the delete answer, and what they were sent. */
function account(rpcError: PostgrestError = null, deleteError: PostgrestError = null) {
  const rpc = vi.fn<(name: string, args: Record<string, unknown>) => Promise<{ error: PostgrestError }>>(async () => ({
    error: rpcError,
  }));
  const deletes: [string, string, string][] = [];
  const from = (table: string) => ({
    delete: () => ({
      eq: async (column: string, value: string) => {
        deletes.push([table, column, value]);
        return { error: deleteError };
      },
    }),
  });
  return { db: { rpc, from } as unknown as SupabaseClient, rpc, deletes };
}

const FACTS: BrowserFacts = {
  userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0',
  maxTouchPoints: 5,
  installed: false,
  hasServiceWorker: true,
  hasPushManager: true,
  permission: 'default',
};
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';

describe('pushSupport', () => {
  it('lets a browser with push and no answer yet, or a yes, turn it on', () => {
    expect(pushSupport(FACTS)).toBe('ok');
    expect(pushSupport({ ...FACTS, permission: 'granted' })).toBe('ok');
  });

  it('sends an iPhone or iPad to the Home Screen first, and lets the app from there', () => {
    expect(pushSupport({ ...FACTS, userAgent: IPHONE, hasPushManager: false })).toBe('install-first');
    expect(pushSupport({ ...FACTS, userAgent: IPAD, maxTouchPoints: 5, hasPushManager: false })).toBe('install-first');
    expect(pushSupport({ ...FACTS, userAgent: IPHONE, installed: true })).toBe('ok');
    // A Mac has no touch screen: it is just a browser.
    expect(pushSupport({ ...FACTS, userAgent: IPAD, maxTouchPoints: 0 })).toBe('ok');
  });

  it('says so for a browser without push, and for notifications blocked', () => {
    expect(pushSupport({ ...FACTS, hasPushManager: false })).toBe('no-push');
    expect(pushSupport({ ...FACTS, hasServiceWorker: false })).toBe('no-push');
    expect(pushSupport({ ...FACTS, permission: null })).toBe('no-push');
    expect(pushSupport({ ...FACTS, permission: 'denied' })).toBe('denied');
  });
});

describe('this phone’s copy', () => {
  it('is off on Sunday at 18:00 until something is stored, and refuses what this build can’t read', () => {
    expect(parsePhoneReminder(null)).toEqual(DEFAULT_REMINDER);
    expect(DEFAULT_REMINDER).toEqual({ on: false, weekday: 7, time: '18:00' });
    expect(parsePhoneReminder('{"on":true,"weekday":3,"time":"07:45"}')).toEqual({ on: true, weekday: 3, time: '07:45' });
    for (const bad of ['{"on":true,"weekday":8,"time":"07:45"}', '{"on":true,"weekday":3,"time":"07:40"}', '{"on":"yes"}', 'on', '[]']) {
      expect(parsePhoneReminder(bad)).toEqual(DEFAULT_REMINDER);
    }
  });

  it('offers every quarter hour', () => {
    expect(QUARTER_HOURS).toHaveLength(96);
    expect([QUARTER_HOURS[0], QUARTER_HOURS[1], QUARTER_HOURS[72], QUARTER_HOURS[95]]).toEqual(['00:00', '00:15', '18:00', '23:45']);
  });
});

describe('reminderSummary', () => {
  it('says Off, or the day and time, in each language', () => {
    expect(reminderSummary(DEFAULT_REMINDER, MESSAGES.en.reminder)).toBe('Off');
    const on = { on: true, weekday: 7, time: '18:00' };
    expect(reminderSummary(on, MESSAGES.en.reminder)).toBe('Sundays at 18:00');
    expect(reminderSummary(on, MESSAGES.de.reminder)).toBe('Sonntags um 18:00');
    expect(reminderSummary({ ...on, weekday: 1 }, MESSAGES.fr.reminder)).toBe('Le lundi à 18:00');
    expect(reminderSummary({ ...on, weekday: 3, time: '07:45' }, MESSAGES.es.reminder)).toBe('Los miércoles a las 07:45');
  });
});

describe('keyBytes', () => {
  it('reads the VAPID key into its 65 bytes', () => {
    const bytes = keyBytes(KEY);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
});

describe('turnOnReminder', () => {
  it('asks first, subscribes this phone with the app’s key, saves its row and keeps a copy', async () => {
    const phone = browser('granted');
    const { db, rpc } = account();

    expect(await turnOnReminder(db, { weekday: 7, time: '18:00' }, PLACE, KEY, phone.platform)).toBe('saved');
    expect(phone.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) });
    expect(rpc).toHaveBeenCalledWith('save_push_subscription', {
      p_endpoint: ENDPOINT,
      p_p256dh: 'BPhoneKey',
      p_auth: 'phone-auth',
      p_weekday: 7,
      p_local_time: '18:00',
      p_time_zone: 'Europe/Berlin',
      p_lang: 'de',
    });
    expect(readPhoneReminder()).toEqual({ on: true, weekday: 7, time: '18:00' });
    expect(JSON.parse(stored[REMINDER_PREF])).toEqual({ on: true, weekday: 7, time: '18:00' });
  });

  it('uses the subscription the phone already has', async () => {
    const phone = browser('granted', subscription());
    const { db } = account();
    expect(await turnOnReminder(db, { weekday: 1, time: '08:00' }, PLACE, KEY, phone.platform)).toBe('saved');
    expect(phone.subscribe).not.toHaveBeenCalled();
  });

  it('stops at a closed or refused prompt, before touching push or the account', async () => {
    for (const [answer, result] of [
      ['default', 'dismissed'],
      ['denied', 'denied'],
    ] as const) {
      const phone = browser(answer);
      const { db, rpc } = account();
      expect(await turnOnReminder(db, { weekday: 7, time: '18:00' }, PLACE, KEY, phone.platform)).toBe(result);
      expect(phone.registration).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    }
    expect(readPhoneReminder().on).toBe(false);
  });

  it('tells a push service the app doesn’t send to apart from any other failure, and stays off', async () => {
    const refused = account({
      code: '23514',
      message: 'new row for relation "push_subscriptions" violates check constraint "push_subscriptions_endpoint_check"',
    });
    expect(await turnOnReminder(refused.db, { weekday: 7, time: '18:00' }, PLACE, KEY, browser('granted').platform)).toBe(
      'not-supported',
    );
    const offline = account({ code: '', message: 'TypeError: Failed to fetch' });
    expect(await turnOnReminder(offline.db, { weekday: 7, time: '18:00' }, PLACE, KEY, browser('granted').platform)).toBe(
      'failed',
    );
    const noWorker = browser('granted');
    noWorker.registration.mockRejectedValue(new Error('The service worker is not running'));
    expect(await turnOnReminder(account().db, { weekday: 7, time: '18:00' }, PLACE, KEY, noWorker.platform)).toBe('failed');
    expect(readPhoneReminder().on).toBe(false);
  });
});

describe('changeReminder', () => {
  it('saves a new day and time for the subscription the phone has, without asking again', async () => {
    const phone = browser('granted', subscription());
    const { db, rpc } = account();
    expect(await changeReminder(db, { weekday: 5, time: '20:30' }, PLACE, KEY, phone.platform)).toBe('saved');
    expect(phone.platform.requestPermission).not.toHaveBeenCalled();
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_weekday: 5, p_local_time: '20:30' });
    expect(readPhoneReminder()).toEqual({ on: true, weekday: 5, time: '20:30' });
  });
});

describe('turnOffReminder', () => {
  it('deletes this phone’s row, then drops the subscription, and keeps the day and time for next time', async () => {
    stored[REMINDER_PREF] = JSON.stringify({ on: true, weekday: 5, time: '20:30' });
    const phone = browser('granted', subscription());
    const { db, deletes } = account();

    expect(await turnOffReminder(db, phone.platform)).toBe('off');
    expect(deletes).toEqual([['push_subscriptions', 'endpoint', ENDPOINT]]);
    expect(phone.current()?.unsubscribe).toHaveBeenCalled();
    expect(readPhoneReminder()).toEqual({ on: false, weekday: 5, time: '20:30' });
  });

  it('leaves it all on when the row can’t be deleted, so it never comes to a phone that thinks it’s off', async () => {
    stored[REMINDER_PREF] = JSON.stringify({ on: true, weekday: 7, time: '18:00' });
    const phone = browser('granted', subscription());
    const { db } = account(null, { code: '', message: 'TypeError: Failed to fetch' });

    expect(await turnOffReminder(db, phone.platform)).toBe('failed');
    expect(phone.current()?.unsubscribe).not.toHaveBeenCalled();
    expect(readPhoneReminder().on).toBe(true);
  });

  it('is off at once when the browser has already dropped the subscription', async () => {
    stored[REMINDER_PREF] = JSON.stringify({ on: true, weekday: 7, time: '18:00' });
    const { db, deletes } = account();
    expect(await turnOffReminder(db, browser('granted').platform)).toBe('off');
    expect(deletes).toEqual([]);
    expect(readPhoneReminder().on).toBe(false);
  });
});
