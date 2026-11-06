'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { db } from '@/db/db';
import { useT } from '@/i18n/use-t';
import { useAuth } from './use-auth';

/**
 * One line at the top of a new setup: a second phone can sign in and get the data the first one keeps in the account,
 * instead of setting up again. Not shown without a Supabase project, or once there is a plan (Edit plan).
 */
export function SetupAccountLink() {
  const { t } = useT();
  const text = t.account.setupLink;
  const auth = useAuth();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (auth.status === 'off' || plan !== null) return null;

  return (
    <p className="text-sm text-muted-foreground">
      {text.question}{' '}
      {/* The start page's sign-in links the phone, then goes on to Home with the account's data. */}
      <Link href="/start/sign-in" className="font-medium text-primary underline underline-offset-4">
        {/* Signed in already, for example after Delete everything, which keeps the sign-in. */}
        {auth.status === 'signed-in'
          ? text.signedIn
          : auth.status === 'second-step'
            ? text.secondStep
            : text.signedOut}
      </Link>
    </p>
  );
}
