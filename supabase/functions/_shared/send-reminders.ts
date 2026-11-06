// The weekly reminder's sender (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 3): what the
// `weekly-reminder` Edge Function does each time the cron job calls it, every 15 minutes. Plain TypeScript, with the
// database and the push services passed in, so the app's tests run it as it is.

import { isDue, REMINDER_URL, reminderText } from './reminder.ts';
import type { VapidKeys } from './web-push.ts';

/** A row of `push_subscriptions` as the service role reads it. */
export type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  weekday: number;
  /** 'HH:MM:SS', as Postgres gives a `time`. */
  local_time: string;
  time_zone: string;
  lang: string;
  last_sent_week: string | null;
};

/** The table, as the sender needs it. */
export type ReminderStore = {
  /** Every row, a page at a time. */
  rows(): AsyncIterable<SubscriptionRow>;
  /** Sets `last_sent_week` to `week` unless a run already did; true when this run did. */
  claim(id: string, week: string): Promise<boolean>;
  /** Deletes a row whose address the push service says is gone. */
  remove(id: string): Promise<void>;
};

/** Sends the text to the row's phone and resolves the push service's status. */
export type Push = (row: SubscriptionRow, text: string) => Promise<number>;

export type RunSummary = { due: number; sent: number; gone: number; failed: number };

/** How the push service treats a reminder: kept 12 hours for a phone that is off, and a newer one replaces it. */
export const REMINDER_PUSH = { ttlSeconds: 12 * 60 * 60, topic: 'weekly-reminder', urgency: 'normal' } as const;

/** The name of the header the cron job sends the function's secret in. */
export const SECRET_HEADER = 'x-reminder-secret';

/** How many reminders go out side by side. */
const AT_ONCE = 10;

/**
 * Sends every reminder due at `now`. A reminder is claimed (its week saved) before it goes, so two runs that overlap
 * never send it twice; one whose push fails is not tried again that week, since a late reminder is worth less than a
 * double one. A push service's 404 or 410 means the phone dropped the address: its row is deleted. Problems are logged
 * with the push service's host only, never the address, which works as the phone's key.
 */
export async function sendDueReminders(
  now: Date,
  store: ReminderStore,
  push: Push,
  log: (line: string) => void = console.error,
): Promise<RunSummary> {
  const due: { row: SubscriptionRow; week: string }[] = [];
  for await (const row of store.rows()) {
    const check = isDue(now, {
      weekday: row.weekday,
      localTime: row.local_time,
      timeZone: row.time_zone,
      lastSentWeek: row.last_sent_week,
    });
    if (check.due && check.week) due.push({ row, week: check.week });
  }

  const summary: RunSummary = { due: due.length, sent: 0, gone: 0, failed: 0 };
  const sendOne = async ({ row, week }: { row: SubscriptionRow; week: string }) => {
    const host = hostOf(row.endpoint);
    try {
      if (!(await store.claim(row.id, week))) {
        summary.due -= 1;
        return;
      }
      const text = JSON.stringify({ ...reminderText(row.lang), url: REMINDER_URL, lang: row.lang });
      const status = await push(row, text);
      if (status >= 200 && status < 300) {
        summary.sent += 1;
      } else if (status === 404 || status === 410) {
        await store.remove(row.id);
        summary.gone += 1;
      } else {
        summary.failed += 1;
        log(`weekly-reminder: ${host} answered ${status}`);
      }
    } catch (error) {
      summary.failed += 1;
      log(`weekly-reminder: sending through ${host} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  for (let start = 0; start < due.length; start += AT_ONCE) {
    await Promise.all(due.slice(start, start + AT_ONCE).map(sendOne));
  }
  return summary;
}

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'an unreadable address';
  }
}

/** What the function reads from its environment. */
export type SenderEnv = {
  cronSecret?: string;
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidSubject?: string;
  supabaseUrl?: string;
  /** `SUPABASE_SECRET_KEYS` (a JSON object of named secret keys) or the older `SUPABASE_SERVICE_ROLE_KEY`. */
  secretKeys?: string;
  serviceRoleKey?: string;
};

export type SenderSettings = { vapid: VapidKeys; supabaseUrl: string; adminKey: string };

/** The key that reads every row: the `default` secret key, or the older service-role key. */
export function adminKeyOf(env: Pick<SenderEnv, 'secretKeys' | 'serviceRoleKey'>): string | undefined {
  if (env.secretKeys) {
    try {
      const keys: unknown = JSON.parse(env.secretKeys);
      if (keys && typeof keys === 'object' && 'default' in keys && typeof keys.default === 'string') return keys.default;
    } catch {
      // Not JSON: the older key, if there is one.
    }
  }
  return env.serviceRoleKey || undefined;
}

/**
 * Answers one call: 401 without the cron job's secret, 500 while a setting is missing (named, never its value), and
 * otherwise the run's counts. Only POST, as the cron job sends.
 */
export async function handleRun(
  request: Request,
  env: SenderEnv,
  run: (settings: SenderSettings) => Promise<RunSummary>,
): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
  if (!env.cronSecret || !(await sameSecret(request.headers.get(SECRET_HEADER), env.cronSecret))) {
    return Response.json({ error: 'Not allowed' }, { status: 401 });
  }
  const { vapidPublicKey, vapidPrivateKey, vapidSubject, supabaseUrl } = env;
  const adminKey = adminKeyOf(env);
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject || !supabaseUrl || !adminKey) {
    const settings = {
      VAPID_PUBLIC_KEY: vapidPublicKey,
      VAPID_PRIVATE_KEY: vapidPrivateKey,
      VAPID_SUBJECT: vapidSubject,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SECRET_KEYS: adminKey,
    };
    const missing = Object.entries(settings).filter(([, value]) => !value).map(([name]) => name);
    return Response.json({ error: `Missing settings: ${missing.join(', ')}` }, { status: 500 });
  }
  try {
    const summary = await run({
      vapid: { publicKey: vapidPublicKey, privateKey: vapidPrivateKey, subject: vapidSubject },
      supabaseUrl,
      adminKey,
    });
    return Response.json(summary);
  } catch (error) {
    // Reading the table failed: nothing was claimed after the failure, so the next run (within the window) tries again.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`weekly-reminder: the run stopped: ${message}`);
    return Response.json({ error: 'The run stopped' }, { status: 500 });
  }
}

/** Compares two secrets in a time that doesn't depend on where they differ. */
async function sameSecret(given: string | null, expected: string): Promise<boolean> {
  if (given === null) return false;
  const digest = async (text: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}
