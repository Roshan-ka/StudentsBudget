'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from './use-auth';

/** The first card in Settings: the way to /settings/account. Hidden when the build has no Supabase project. */
export function AccountSection() {
  const auth = useAuth();
  if (auth.status === 'off') return null;

  return (
    <section aria-labelledby="account-heading" className="flex flex-col gap-3">
      <h3 id="account-heading" className="text-lg font-semibold">
        Your account
      </h3>
      <p className="break-words text-muted-foreground">
        {auth.status === 'signed-in'
          ? `Signed in as ${auth.email}.`
          : auth.status === 'second-step'
            ? `${auth.email}: the code from your authenticator app is still to come.`
            : 'Optional: sign in or create an account. Without one, everything stays on this phone.'}
      </p>
      <Link href="/settings/account" className={buttonVariants({ variant: 'outline', className: 'h-10 self-start px-4' })}>
        {auth.status === 'signed-in' ? 'Manage account' : auth.status === 'second-step' ? 'Finish signing in' : 'Sign in'}
      </Link>
    </section>
  );
}
