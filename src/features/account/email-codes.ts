import type { EmailOtpType } from '@supabase/supabase-js';

// The two emails that carry a 6-digit code (P2.4, docs/superpowers/plans/2026-11-04-email-codes.md), and the type
// `verifyOtp` checks each code as. email-codes.contract.test.ts proves both against the local stack, so the app and the
// test can't drift apart.

/** The code in the sign-up email (supabase/templates/confirmation.html). */
export const SIGN_UP_CODE: EmailOtpType = 'email';

/** The code in the "Forgot password" email (supabase/templates/recovery.html). */
export const RECOVERY_CODE: EmailOtpType = 'recovery';
