import type { Page } from '@playwright/test';

/** The push address the stand-in subscription has: Google's FCM, one of the services the table takes. */
export const E2E_PUSH_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e-phone';

/** What the stand-in saw, read with `pushRecord(page)`. */
export type PushRecord = { asked: number; subscribed: number; unsubscribed: number; keyLength: number };

/** Where the stand-in keeps the browser's side across the tab's page loads, as a real browser does. */
const STATE_KEY = '__e2ePush';

/**
 * Plays the browser's push on a page before it loads (the weekly reminder): `Notification` answers the permission
 * prompt with `answer`, and the app's service worker registration (which `next dev` never starts) has a push manager
 * that subscribes with `E2E_PUSH_ENDPOINT`. `push: false` is a browser without push; `installed: false` with an iPhone
 * user agent is a Safari tab, not the app on the Home Screen. The answer given, the subscription and the record last
 * across the tab's reloads and page loads (sessionStorage), so the app's start finds them as it would on a phone.
 */
export async function stubPush(
  page: Page,
  options: { answer?: NotificationPermission; push?: boolean; installed?: boolean } = {},
) {
  await page.addInitScript(
    ({ answer, push, installed, endpoint, stateKey }) => {
      type State = {
        record: { asked: number; subscribed: number; unsubscribed: number; keyLength: number };
        permission: NotificationPermission;
        subscribed: boolean;
      };
      let state: State = {
        record: { asked: 0, subscribed: 0, unsubscribed: 0, keyLength: 0 },
        permission: 'default',
        subscribed: false,
      };
      try {
        const kept = sessionStorage.getItem(stateKey);
        if (kept !== null) state = JSON.parse(kept) as State;
      } catch {
        // No storage on this document (about:blank): it starts fresh.
      }
      const keep = () => {
        try {
          sessionStorage.setItem(stateKey, JSON.stringify(state));
        } catch {
          // As above.
        }
      };
      const subscription = () => ({
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: 'BE2EPhoneKey', auth: 'e2e-auth' } }),
        unsubscribe: async () => {
          state.subscribed = false;
          state.record.unsubscribed += 1;
          keep();
          return true;
        },
      });
      const pushManager = {
        getSubscription: async () => (state.subscribed ? subscription() : null),
        subscribe: async (init: { applicationServerKey?: ArrayLike<number> }) => {
          state.record.subscribed += 1;
          state.record.keyLength = init.applicationServerKey?.length ?? 0;
          state.subscribed = true;
          keep();
          return subscription();
        },
      };
      class StandInNotification {
        static get permission() {
          return state.permission;
        }
        static async requestPermission() {
          state.record.asked += 1;
          state.permission = answer;
          keep();
          return answer;
        }
      }
      Object.defineProperty(window, 'Notification', { value: StandInNotification, configurable: true });
      if (push) {
        Object.defineProperty(window, 'PushManager', { value: function PushManager() {}, configurable: true });
        Object.defineProperty(navigator, 'serviceWorker', {
          value: { ready: Promise.resolve({ pushManager }), register: async () => ({}) },
          configurable: true,
        });
      } else {
        Reflect.deleteProperty(window, 'PushManager');
      }
      Object.defineProperty(navigator, 'standalone', { value: installed, configurable: true });
      Object.defineProperty(window, '__e2ePush', { get: () => state.record });
    },
    {
      answer: options.answer ?? 'granted',
      push: options.push ?? true,
      installed: options.installed ?? true,
      endpoint: E2E_PUSH_ENDPOINT,
      stateKey: STATE_KEY,
    },
  );
}

/** What the stand-in saw so far. */
export function pushRecord(page: Page): Promise<PushRecord> {
  return page.evaluate(() => (window as unknown as { __e2ePush: PushRecord }).__e2ePush);
}
