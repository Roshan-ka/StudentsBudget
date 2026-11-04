'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { useT } from '@/i18n/use-t';
import { useSyncStatus } from './sync-status';
import { useAuth } from './use-auth';

/** The first card in Settings: the way to /settings/account. Hidden when the build has no Supabase project. */
export function AccountSection() {
  const { t } = useT();
  const text = t.account.card;
  const auth = useAuth();
  // The signed-in user's: a phone linked to another account says so.
  const syncStatus = useSyncStatus(auth.status === 'signed-in' ? auth.userId : undefined);
  if (auth.status === 'off') return null;

  return (
    <section aria-labelledby="account-heading" className={cardVariants()}>
      <h3 id="account-heading" className="text-xl leading-tight font-extrabold">
        {text.heading}
      </h3>
      <p className="break-words text-muted-foreground">
        {auth.status === 'signed-in'
          ? text.signedIn(auth.email)
          : auth.status === 'second-step'
            ? text.secondStep(auth.email)
            : text.signedOut}
      </p>
      {/* While this phone is linked to the account: how its sync stands. */}
      {auth.status === 'signed-in' && syncStatus !== null && <p className="text-sm text-muted-foreground">{syncStatus}</p>}
      <Link href="/settings/account" className={buttonVariants({ variant: 'outline', className: 'self-start px-4' })}>
        {auth.status === 'signed-in' ? text.manage : auth.status === 'second-step' ? text.finish : text.signIn}
      </Link>
    </section>
  );
}
