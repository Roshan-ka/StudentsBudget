import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SIGN_UP_CODE } from '@/features/account/email-codes';
import { newId } from '@/lib/new-id';
import { codeIn, nextMail } from './mailpit';

// Users for the contract tests on the local Supabase stack: a client of its own per phone, and a new user confirmed
// with the code from its sign-up email in Mailpit (P2.4). The stack's settings come from `node
// scripts/supabase-test-env.mjs`. Tests only: nothing in the app imports it.

export const STACK_URL = process.env.SUPABASE_TEST_URL;
export const STACK_KEY = process.env.SUPABASE_TEST_KEY;
export const MAIL_URL = process.env.SUPABASE_TEST_MAIL_URL;

/** Every contract-test user's password. */
export const CONTRACT_PASSWORD = 'contract-test-password';

/** A client of its own, as another phone or browser would be: nothing signed in. */
export function stackClient(): SupabaseClient {
  return createClient(STACK_URL ?? '', STACK_KEY ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A new address, unique to the run. */
export const newEmail = () => `contract-${newId()}@example.com`;

/** Signs `email` up, with `data` as user metadata, and confirms it with the mailed code. The client is then signed in. */
export async function confirmedUser(email: string = newEmail(), data?: Record<string, string>): Promise<SupabaseClient> {
  const user = stackClient();
  const signedUp = await user.auth.signUp({ email, password: CONTRACT_PASSWORD, options: { data } });
  if (signedUp.error) throw signedUp.error;
  const { error } = await user.auth.verifyOtp({ email, token: codeIn(await nextMail(email)), type: SIGN_UP_CODE });
  if (error) throw error;
  return user;
}
