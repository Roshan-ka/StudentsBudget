import { forgetStudentDiscounts } from '@/features/discounts/student-discounts';
import { forgetFeedCache } from '@/features/hacks/feed';
import { forgetReminderOnPhone } from '@/features/reminder/reminder';
import { getSupabase } from '@/lib/supabase/client';
import { forgetPendingWipe } from './pending-wipe';
import { endRecovery } from './recovery';

/**
 * What goes with the account once nobody is signed in on this phone: a password reset in progress, the hacks feed and
 * the students' discounts kept for the account (so the next person never sees them), and the weekly reminder (nothing more arrives on a signed-out
 * phone). Each does nothing when there is nothing to forget.
 */
export function forgetAccountOnPhone(): void {
  endRecovery();
  forgetFeedCache();
  forgetStudentDiscounts();
  void forgetReminderOnPhone();
}

/**
 * Follows the session for the whole app, once, from `AppInit` in the layout, which never hides (review, 09-11-2026). A
 * page's own `useAuth` stops listening while the page is hidden, so a session that ended then (an account deleted on
 * another phone, a sign-out in another tab) told no one, and the reminder stayed on with no row behind it. A start
 * without a session counts too: the end may have come while the app was closed. A new sign-in drops a wipe a sign-out
 * still owed: the link then asks what to keep. Returns the unsubscribe.
 */
export function followSessionForPhone(): () => void {
  const supabase = getSupabase();
  if (supabase === null) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && session === null)) forgetAccountOnPhone();
    if (event === 'SIGNED_IN') forgetPendingWipe();
  });
  return () => data.subscription.unsubscribe();
}
