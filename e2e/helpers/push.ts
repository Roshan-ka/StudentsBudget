import type { Page } from '@playwright/test';

/** The push address the stand-in subscription has: Google's FCM, one of the services the table takes. */
export const E2E_PUSH_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e-phone';

/** What the stand-in saw, read with `pushRecord(page)`. */
export type PushRecord = { asked: number; subscribed: number; unsubscribed: number; keyLength: number };

/**
 * Plays the browser's push on a page before it loads (the weekly reminder): `Notification` answers the permission
 * prompt with `answer`, and the app's service worker registration (which `next dev` never starts) has a push manager
 * that subscribes with `E2E_PUSH_ENDPOINT`. `push: false` is a browser without push; `installed: false` with an iPhone
 * user agent is a Safari tab, not the app on the Home Screen.
 */
export async function stubPush(
  page: Page,
  options: { answer?: NotificationPermission; push?: boolean; installed?: boolean } = {},
) {
  await page.addInitScript(
    ({ answer, push, installed, endpoint }) => {
      const record = { asked: 0, subscribed: 0, unsubscribed: 0, keyLength: 0 };
      let permission: NotificationPermission = 'default';
      let current: object | null = null;
      const subscription = () => ({
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: 'BE2EPhoneKey', auth: 'e2e-auth' } }),
        unsubscribe: async () => {
          current = null;
          record.unsubscribed += 1;
          return true;
        },
      });
      const pushManager = {
        getSubscription: async () => current,
        subscribe: async (init: { applicationServerKey?: ArrayLike<number> }) => {
          record.subscribed += 1;
          record.keyLength = init.applicationServerKey?.length ?? 0;
          current = subscription();
          return current;
        },
      };
      class StandInNotification {
        static get permission() {
          return permission;
        }
        static async requestPermission() {
          record.asked += 1;
          permission = answer;
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
      Object.defineProperty(window, '__e2ePush', { value: record });
    },
    { answer: options.answer ?? 'granted', push: options.push ?? true, installed: options.installed ?? true, endpoint: E2E_PUSH_ENDPOINT },
  );
}

/** What the stand-in saw so far. */
export function pushRecord(page: Page): Promise<PushRecord> {
  return page.evaluate(() => (window as unknown as { __e2ePush: PushRecord }).__e2ePush);
}
