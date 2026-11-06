import { describe, expect, it, vi } from 'vitest';
import {
  adminKeyOf,
  handleRun,
  SECRET_HEADER,
  sendDueReminders,
  type ReminderStore,
  type RunSummary,
  type SubscriptionRow,
} from '../../../supabase/functions/_shared/send-reminders';

// The weekly reminder's sender (chunk 3), with the table and the push services played here: what is due goes once, a
// gone address is deleted, a failure is logged without the address, and a call without the cron job's secret does nothing.

// Sunday 8 November 2026, 18:05 in Berlin (winter time, UTC+1).
const SUNDAY_EVENING = new Date('2026-11-08T17:05:00Z');
const THIS_WEEK = '2026-11-02';

let ids = 0;
function row(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  ids += 1;
  return {
    id: `row-${ids}`,
    endpoint: `https://fcm.googleapis.com/fcm/send/secret-${ids}`,
    p256dh: 'p256dh',
    auth: 'auth',
    weekday: 7,
    local_time: '18:00:00',
    time_zone: 'Europe/Berlin',
    lang: 'en',
    last_sent_week: null,
    ...overrides,
  };
}

/** The table in memory, claimed as the real one is: once per week. */
function memoryStore(rows: SubscriptionRow[]): ReminderStore & { all: SubscriptionRow[] } {
  const all = rows;
  return {
    all,
    async *rows() {
      // Two pages, as the real store reads them.
      yield* all.slice(0, 1);
      yield* all.slice(1);
    },
    async claim(id, week) {
      const found = all.find((r) => r.id === id);
      if (!found || (found.last_sent_week !== null && found.last_sent_week >= week)) return false;
      found.last_sent_week = week;
      return true;
    },
    async remove(id) {
      all.splice(
        all.findIndex((r) => r.id === id),
        1,
      );
    },
  };
}

describe('sendDueReminders', () => {
  it('sends a due reminder once, in its language, to the check-in, and saves the week', async () => {
    const due = row({ lang: 'de' });
    const store = memoryStore([due]);
    const push = vi.fn(async () => 201);

    expect(await sendDueReminders(SUNDAY_EVENING, store, push)).toEqual({ due: 1, sent: 1, gone: 0, failed: 0 });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]).toEqual([
      due,
      JSON.stringify({ title: 'StudentsBudget', body: 'Zeit für deinen wöchentlichen Check-in.', url: '/check-in', lang: 'de' }),
    ]);
    expect(store.all[0].last_sent_week).toBe(THIS_WEEK);

    // The next run in the same window, and one that overlaps it, send nothing.
    expect(await sendDueReminders(SUNDAY_EVENING, store, push)).toEqual({ due: 0, sent: 0, gone: 0, failed: 0 });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('sends once when two runs overlap', async () => {
    const store = memoryStore([row()]);
    const push = vi.fn(async () => 201);
    const runs = await Promise.all([sendDueReminders(SUNDAY_EVENING, store, push), sendDueReminders(SUNDAY_EVENING, store, push)]);
    expect(runs.map((run) => run.sent).sort()).toEqual([0, 1]);
    expect(runs.map((run) => run.due).sort()).toEqual([0, 1]);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('leaves what isn’t due: another day, a later time, a week already sent, an unknown zone', async () => {
    const store = memoryStore([
      row({ weekday: 6 }),
      row({ local_time: '18:15:00' }),
      row({ last_sent_week: THIS_WEEK }),
      row({ time_zone: 'Mars/Olympus' }),
    ]);
    const push = vi.fn(async () => 201);
    expect(await sendDueReminders(SUNDAY_EVENING, store, push)).toEqual({ due: 0, sent: 0, gone: 0, failed: 0 });
    expect(push).not.toHaveBeenCalled();
  });

  it('reads each row on its own clock', async () => {
    // 18:05 in Berlin is 12:05 in New York (still winter time there on 8 November).
    const store = memoryStore([row({ time_zone: 'America/New_York', local_time: '12:00:00' })]);
    const push = vi.fn(async () => 201);
    expect((await sendDueReminders(SUNDAY_EVENING, store, push)).sent).toBe(1);
  });

  it('deletes a row whose address the push service says is gone', async () => {
    const store = memoryStore([row(), row(), row()]);
    const answers = [410, 404, 201];
    const push = vi.fn(async () => answers.shift() ?? 201);

    expect(await sendDueReminders(SUNDAY_EVENING, store, push)).toEqual({ due: 3, sent: 1, gone: 2, failed: 0 });
    expect(store.all).toHaveLength(1);
  });

  it('logs a failure with the push service’s host only, and doesn’t try that phone again this week', async () => {
    const failing = row();
    const throwing = row({ endpoint: 'https://web.push.apple.com/secret-apple' });
    const store = memoryStore([failing, throwing]);
    const lines: string[] = [];
    const push = vi.fn(async (target: SubscriptionRow) => {
      if (target.id === throwing.id) throw new Error('network down');
      return 500;
    });

    expect(await sendDueReminders(SUNDAY_EVENING, store, push, (line) => lines.push(line))).toEqual({
      due: 2,
      sent: 0,
      gone: 0,
      failed: 2,
    });
    expect(lines).toEqual([
      'weekly-reminder: fcm.googleapis.com answered 500',
      'weekly-reminder: sending through web.push.apple.com failed: network down',
    ]);
    expect(lines.join(' ')).not.toContain('secret');
    expect(store.all.map((r) => r.last_sent_week)).toEqual([THIS_WEEK, THIS_WEEK]);

    expect((await sendDueReminders(SUNDAY_EVENING, store, push)).due).toBe(0);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('sends ten at a time', async () => {
    const store = memoryStore(Array.from({ length: 25 }, () => row()));
    let inFlight = 0;
    let most = 0;
    const push = vi.fn(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return 201;
    });

    expect((await sendDueReminders(SUNDAY_EVENING, store, push)).sent).toBe(25);
    expect(most).toBe(10);
  });
});

describe('handleRun', () => {
  const ENV = {
    cronSecret: 'cron-secret',
    vapidPublicKey: 'public',
    vapidPrivateKey: 'private',
    vapidSubject: 'mailto:reminder@example.com',
    supabaseUrl: 'https://project.supabase.co',
    secretKeys: JSON.stringify({ default: 'sb_secret_default' }),
  };
  const SUMMARY: RunSummary = { due: 1, sent: 1, gone: 0, failed: 0 };
  const call = (headers: Record<string, string> = { [SECRET_HEADER]: 'cron-secret' }, method = 'POST') =>
    new Request('https://project.supabase.co/functions/v1/weekly-reminder', { method, headers });

  it('runs with the settings, and answers the counts', async () => {
    const run = vi.fn(async () => SUMMARY);
    const response = await handleRun(call(), ENV, run);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SUMMARY);
    expect(run).toHaveBeenCalledWith({
      vapid: { publicKey: 'public', privateKey: 'private', subject: 'mailto:reminder@example.com' },
      supabaseUrl: 'https://project.supabase.co',
      adminKey: 'sb_secret_default',
    });
  });

  it('does nothing without the cron job’s secret, or before one is set', async () => {
    const run = vi.fn(async () => SUMMARY);
    expect((await handleRun(call({}), ENV, run)).status).toBe(401);
    expect((await handleRun(call({ [SECRET_HEADER]: 'cron-secreT' }), ENV, run)).status).toBe(401);
    expect((await handleRun(call({ [SECRET_HEADER]: '' }), { ...ENV, cronSecret: '' }, run)).status).toBe(401);
    expect((await handleRun(call(), ENV, run)).status).toBe(200);
    expect((await handleRun(call(undefined, 'GET'), ENV, run)).status).toBe(405);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('names a missing setting, never a value', async () => {
    const run = vi.fn(async () => SUMMARY);
    const response = await handleRun(call(), { ...ENV, vapidPrivateKey: undefined, secretKeys: undefined }, run);
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: 'Missing settings: VAPID_PRIVATE_KEY, SUPABASE_SECRET_KEYS' });
    expect(text).not.toContain('public');
    expect(run).not.toHaveBeenCalled();
  });

  it('answers 500 when the run stops, without its details', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await handleRun(call(), ENV, async () => {
      throw new Error('relation does not exist');
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'The run stopped' });
    expect(quiet).toHaveBeenCalledWith('weekly-reminder: the run stopped: relation does not exist');
    quiet.mockRestore();
  });
});

describe('adminKeyOf', () => {
  it('takes the default secret key, else the older service-role key', () => {
    expect(adminKeyOf({ secretKeys: '{"default":"sb_secret_a","other":"sb_secret_b"}', serviceRoleKey: 'legacy' })).toBe('sb_secret_a');
    expect(adminKeyOf({ secretKeys: '{"other":"sb_secret_b"}', serviceRoleKey: 'legacy' })).toBe('legacy');
    expect(adminKeyOf({ secretKeys: 'not json', serviceRoleKey: 'legacy' })).toBe('legacy');
    expect(adminKeyOf({})).toBeUndefined();
  });
});
