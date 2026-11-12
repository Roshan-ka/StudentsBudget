'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageHeading } from '@/components/page-heading';
import { StatusLine } from '@/components/status-line';
import { buttonVariants } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import { useAuth } from '@/features/account/use-auth';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { forgetSignedOut, useJustSignedOut } from './signed-out';

const WIDE = 'w-full';
const OUTLINE = buttonVariants({ size: 'lg', variant: 'outline', className: WIDE });

/**
 * The start page (06-11-2026): sign in, create an account, or go on without one. It is for a phone with no plan and
 * nobody signed in; anyone else goes on to Home, which sends a phone without a plan where it belongs (firstRunPath).
 */
export function StartView() {
  const router = useRouter();
  const { t } = useT();
  const text = t.account.start;
  const auth = useAuth();
  const signedOut = useJustSignedOut();

  useEffect(() => {
    if (auth.status === 'loading') return;
    if (auth.status !== 'signed-out') {
      router.replace('/');
      return;
    }
    // A plan read once, in an effect: a phone that has one skips the choice.
    let cancelled = false;
    db.plan.get('current').then(
      (plan) => {
        if (!cancelled && plan) router.replace('/');
      },
      (error: unknown) => console.error('StudentsBudget: could not read the saved plan', error),
    );
    return () => {
      cancelled = true;
    };
  }, [auth.status, router]);

  return (
    <div className="flex flex-col gap-4">
      {signedOut && (
        <StatusLine className="rounded-lg bg-accent px-4 py-3 text-sm font-medium">{text.signedOut}</StatusLine>
      )}
      <PageHeading id="start" />
      <p className="text-muted-foreground">{text.pitch}</p>
      <section aria-label={text.withAccount} className={cn(cardVariants(), 'gap-3')}>
        <Link href="/start/sign-in" onClick={forgetSignedOut} className={buttonVariants({ size: 'lg', className: WIDE })}>
          {text.signIn}
        </Link>
        <Link href="/start/new-account" onClick={forgetSignedOut} className={OUTLINE}>
          {text.create}
        </Link>
        <p className="text-sm text-muted-foreground">{text.accountWhy}</p>
      </section>
      <section aria-label={text.withoutAccount} className={cn(cardVariants(), 'gap-3')}>
        <Link href="/setup" onClick={forgetSignedOut} className={OUTLINE}>
          {text.guest}
        </Link>
        <p className="text-sm text-muted-foreground">{text.guestNote}</p>
      </section>
    </div>
  );
}
