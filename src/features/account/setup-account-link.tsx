'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { db } from '@/db/db';
import { useAuth } from './use-auth';

/**
 * One line at the top of a new setup: a second phone can sign in and get the data the first one keeps in the account,
 * instead of setting up again. Not shown without a Supabase project, or once there is a plan (Edit plan).
 */
export function SetupAccountLink() {
  const auth = useAuth();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (auth.status === 'off' || plan !== null) return null;

  return (
    <p className="text-sm text-muted-foreground">
      Using StudentsBudget on another phone?{' '}
      <Link href="/settings/account" className="font-medium text-primary underline underline-offset-4">
        {/* Signed in already, for example after Delete everything, which keeps the sign-in. */}
        {auth.status === 'signed-in'
          ? 'Get your data from your account'
          : auth.status === 'second-step'
            ? 'Finish signing in to get your data'
            : 'Sign in to get your data'}
      </Link>
    </p>
  );
}
