'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { CloudDownloadIcon, LogInIcon } from 'lucide-react';
import { LinkButton } from '@/components/link-button';
import { db } from '@/db/db';
import { useT } from '@/i18n/use-t';
import { useAuth } from './use-auth';

/**
 * One quiet line under the first step of a new setup (13-11-2026; before, at the top): a second phone can sign in and
 * get the data the first one keeps in the account, instead of setting up again. Signed out it reads "Have an account?
 * Sign in", as the start page's forms do (16-11-2026). Not shown without a Supabase project, or once there is a plan
 * (Edit plan). An outlined button, never a text link (16-11-2026); signed in, the question first, then its button.
 */
export function SetupAccountLink() {
  const { t } = useT();
  const text = t.account.setupLink;
  const auth = useAuth();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (auth.status === 'off' || plan !== null) return null;

  // The start page's sign-in links the phone, then goes on to Home with the account's data.
  if (auth.status !== 'signed-in' && auth.status !== 'second-step') {
    return (
      <LinkButton href="/start/sign-in" icon={LogInIcon}>
        {t.auth.signIn.toSignIn}
      </LinkButton>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-muted-foreground">{text.question}</p>
      {/* Signed in already, for example after Delete everything, which keeps the sign-in. */}
      <LinkButton href="/start/sign-in" icon={auth.status === 'signed-in' ? CloudDownloadIcon : LogInIcon}>
        {auth.status === 'signed-in' ? text.signedIn : text.secondStep}
      </LinkButton>
    </div>
  );
}
