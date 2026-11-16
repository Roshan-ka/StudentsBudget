'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { db } from '@/db/db';
import { useT } from '@/i18n/use-t';
import { useAuth } from './use-auth';

/**
 * One quiet line under the first step of a new setup (13-11-2026; before, at the top): a second phone can sign in and
 * get the data the first one keeps in the account, instead of setting up again. Signed out it reads "Have an account?
 * Sign in", as the start page's forms do (16-11-2026). Not shown without a Supabase project, or once there is a plan
 * (Edit plan).
 */
export function SetupAccountLink() {
  const { t } = useT();
  const text = t.account.setupLink;
  const auth = useAuth();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (auth.status === 'off' || plan !== null) return null;
  const linkClass = 'font-medium text-primary underline underline-offset-4';

  // The start page's sign-in links the phone, then goes on to Home with the account's data.
  if (auth.status !== 'signed-in' && auth.status !== 'second-step') {
    return (
      <p className="text-sm text-muted-foreground">
        <Link href="/start/sign-in" className={linkClass}>
          {t.auth.signIn.toSignIn}
        </Link>
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      {text.question}{' '}
      <Link href="/start/sign-in" className={linkClass}>
        {/* Signed in already, for example after Delete everything, which keeps the sign-in. */}
        {auth.status === 'signed-in' ? text.signedIn : text.secondStep}
      </Link>
    </p>
  );
}
