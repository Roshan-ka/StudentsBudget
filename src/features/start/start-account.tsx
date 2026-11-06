'use client';

import { ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { PageHeading } from '@/components/page-heading';
import { db } from '@/db/db';
import { AccountLink } from '@/features/account/account-link';
import { NewPasswordForm, SecondStepForm, SignInForm } from '@/features/account/account-view';
import type { AuthMode } from '@/features/account/credentials';
import { useRecovery } from '@/features/account/recovery';
import { useAuth } from '@/features/account/use-auth';
import { useT } from '@/i18n/use-t';

/**
 * The start page's "I have an account" and "Create an account" (06-11-2026): the account forms of Settings → Your
 * account, the code steps and passkeys included. Once signed in, the phone links as it does there; a plan that came
 * down from the account opens Home, an empty account goes on to setup.
 */
export function StartAccount({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { t } = useT();
  const auth = useAuth();
  const recovery = useRecovery();

  // A build without accounts has nothing to sign in to.
  useEffect(() => {
    if (auth.status === 'off') router.replace('/setup');
  }, [auth.status, router]);

  const goOn = useCallback(() => {
    db.plan.get('current').then(
      (plan) => router.replace(plan ? '/' : '/setup'),
      (error: unknown) => console.error('StudentsBudget: could not read the saved plan', error),
    );
  }, [router]);

  let content = null;
  switch (auth.status) {
    case 'off':
      break;
    case 'loading':
      content = <p className="text-muted-foreground">{t.auth.view.checking}</p>;
      break;
    case 'second-step':
      content = <SecondStepForm email={auth.email} factorId={auth.factorId} />;
      break;
    case 'signed-out':
      content = (
        <>
          <SignInForm initialMode={mode} />
          <p className="text-sm text-muted-foreground">{t.account.start.afterSignIn}</p>
        </>
      );
      break;
    case 'signed-in':
      // Signed in with a "Forgot password" code: the new password comes first, as on the account page.
      content = recovery === 'pending' ? <NewPasswordForm email={auth.email} /> : <AccountLink onLinked={goOn} />;
      break;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/start" className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-primary">
        <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:rotate-180" />
        {t.account.start.back}
      </Link>
      <PageHeading id="account" />
      {content}
    </div>
  );
}
