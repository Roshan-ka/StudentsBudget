// The `weekly-reminder` Edge Function (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 3): the cron job
// (migration 20261106084903_weekly_reminder_schedule.sql) calls it every 15 minutes with its secret, and it sends the
// reminders due then. Only the wiring is here: the table through supabase-js with the project's secret key, and the
// push services through `sendPush`. What it does is in ../_shared/, which the app's tests run
// (src/features/reminder/sender.test.ts and web-push.test.ts).
//
// Settings: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (`supabase secrets set`), and
// SUPABASE_URL with SUPABASE_SECRET_KEYS, which Supabase puts there. `verify_jwt` is off (supabase/config.toml): the
// cron job's secret is the check.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  handleRun,
  REMINDER_PUSH,
  sendDueReminders,
  type ReminderStore,
  type SubscriptionRow,
} from '../_shared/send-reminders.ts';
import { sendPush } from '../_shared/web-push.ts';

// The two things this file takes from Deno, declared here so the app's typecheck reads it too.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

/** The API answers at most 1,000 rows a call. */
const PAGE = 1000;
const COLUMNS = 'id, endpoint, p256dh, auth, weekday, local_time, time_zone, lang, last_sent_week';

function tableStore(db: SupabaseClient): ReminderStore {
  const table = () => db.from('push_subscriptions');
  return {
    async *rows() {
      let after: string | null = null;
      for (;;) {
        let query = table().select(COLUMNS).order('id').limit(PAGE);
        if (after !== null) query = query.gt('id', after);
        const { data, error } = await query;
        if (error) throw new Error(`Reading the reminders failed: ${error.message}`);
        const rows = (data ?? []) as SubscriptionRow[];
        yield* rows;
        if (rows.length < PAGE) return;
        after = rows[rows.length - 1].id;
      }
    },
    async claim(id, week) {
      // Only when no run has saved this week yet: weeks only move on, so an earlier one or none.
      const { data, error } = await table()
        .update({ last_sent_week: week })
        .eq('id', id)
        .or(`last_sent_week.is.null,last_sent_week.lt.${week}`)
        .select('id');
      if (error) throw new Error(`Saving the week failed: ${error.message}`);
      return (data ?? []).length === 1;
    },
    async remove(id) {
      const { error } = await table().delete().eq('id', id);
      if (error) throw new Error(`Deleting a gone address failed: ${error.message}`);
    },
  };
}

Deno.serve((request) =>
  handleRun(
    request,
    {
      cronSecret: Deno.env.get('CRON_SECRET'),
      vapidPublicKey: Deno.env.get('VAPID_PUBLIC_KEY'),
      vapidPrivateKey: Deno.env.get('VAPID_PRIVATE_KEY'),
      vapidSubject: Deno.env.get('VAPID_SUBJECT'),
      supabaseUrl: Deno.env.get('SUPABASE_URL'),
      secretKeys: Deno.env.get('SUPABASE_SECRET_KEYS'),
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    },
    ({ vapid, supabaseUrl, adminKey }) => {
      const db = createClient(supabaseUrl, adminKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      return sendDueReminders(new Date(), tableStore(db), (row, text) =>
        sendPush(row, text, vapid, REMINDER_PUSH, new Date()),
      );
    },
  ),
);
