import { getLanguageSnapshot } from '@/i18n/store';
import { getSupabase } from '@/lib/supabase/client';
import { followPhone, phoneTimeZone, readPhoneReminder, remindersInBuild } from './reminder';

// The quiet update of the weekly reminder (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 5): AppInit calls
// it as the app opens, on each return to it (an installed app can stay suspended for days, across a time zone) and on
// a language change. It is the app's one write without a tap, and it sends nothing while the phone's zone and language
// are those last saved (`followPhone`).

let running: Promise<void> | null = null;
let again = false;

/**
 * Brings the account's row up to the phone's time zone and language, quietly. Does nothing unless this build sends
 * reminders, this phone's is on, and someone is signed in; a refusal (offline, the code still owed) waits for the next
 * call. One at a time: a call while one runs makes it run once more after, with the phone as it is then. Never throws.
 */
export function keepReminderInStep(): Promise<void> {
  if (!remindersInBuild() || !readPhoneReminder().on) return Promise.resolve();
  if (running !== null) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await followOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function followOnce(): Promise<void> {
  const supabase = getSupabase();
  if (supabase === null) return;
  try {
    // Read from this phone's storage: a signed-out phone sends nothing.
    const { data } = await supabase.auth.getSession();
    if (data.session === null) return;
    await followPhone(supabase, { timeZone: phoneTimeZone(), lang: getLanguageSnapshot() });
  } catch (error) {
    console.error('StudentsBudget: could not bring the weekly reminder up to date', error);
  }
}
