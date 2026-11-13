'use client';

import { CalendarDaysIcon, ListChecksIcon, MapPinIcon, ZapIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageHeading } from '@/components/page-heading';
import { StatusLine } from '@/components/status-line';
import { buttonVariants } from '@/components/ui/button';
import { db } from '@/db/db';
import { useAuth } from '@/features/account/use-auth';
import { categoryTint } from '@/features/charts/colors';
import { LegalLinks } from '@/features/legal/legal-page';
import { useT } from '@/i18n/use-t';
import { forgetSignedOut, useJustSignedOut } from './signed-out';

/**
 * What the app does, one line each, with a tinted tile (Roshan, from the round 3 mockups, 13-11-2026). The tints are
 * categories' (`categoryTint`), whose contrast tokens.test.ts already holds in both themes.
 */
const FEATURES = [
  { id: 'plan', icon: ListChecksIcon, tint: 'rent' },
  { id: 'log', icon: ZapIcon, tint: 'food' },
  { id: 'week', icon: CalendarDaysIcon, tint: 'going-out' },
  { id: 'tips', icon: MapPinIcon, tint: 'eating-out' },
] as const;

/**
 * The start page (06-11-2026; redesigned 13-11-2026 from Roshan's round 3 mockups): what the app is, what it does,
 * then create an account, sign in, or go on without one. It is for a phone with no plan and nobody signed in; anyone
 * else goes on to Home, which sends a phone without a plan where it belongs (firstRunPath). The language is the globe
 * in the header (`StartLanguageMenu`).
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
    <div className="flex flex-col gap-6">
      {signedOut && (
        <StatusLine className="rounded-lg bg-accent px-4 py-3 text-sm font-medium">{text.signedOut}</StatusLine>
      )}
      {/* "Welcome" names the page in the title and takes the focus after a page change; the headline says the rest. */}
      <PageHeading id="start" visuallyHidden />
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <MapPinIcon aria-hidden="true" className="size-4 shrink-0" />
          {text.place}
        </p>
        <p className="font-heading text-[30px] leading-tight font-extrabold tracking-tight text-balance">
          {text.headline}
        </p>
        <p className="text-muted-foreground">{text.pitch}</p>
      </div>

      {/* Each feature its own card, in its tint (Roshan, 13-11-2026), as Home's envelopes are. */}
      <ul className="flex flex-col gap-2.5">
        {FEATURES.map(({ id, icon: Icon, tint }) => (
          <li
            key={id}
            className="flex min-h-14 items-center gap-3 rounded-lg border-[1.5px] border-outline px-3 py-2 text-card-foreground shadow-offset"
            style={{ backgroundColor: categoryTint(tint) }}
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-md border-[1.5px] border-outline bg-card/80"
            >
              <Icon className="size-[18px]" />
            </span>
            <span className="font-semibold">{text.features[id]}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <Link
          href="/start/new-account"
          onClick={forgetSignedOut}
          className={buttonVariants({ size: 'lg', className: 'w-full' })}
        >
          {text.create}
        </Link>
        <Link
          href="/start/sign-in"
          onClick={forgetSignedOut}
          className={buttonVariants({ size: 'lg', variant: 'outline', className: 'w-full' })}
        >
          {text.signIn}
        </Link>
        {/* Quiet, at least 44 px high: the guest's way, with no note (Roshan, 13-11-2026). */}
        <Link
          href="/setup"
          onClick={forgetSignedOut}
          className="mx-auto inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
        >
          {text.guest}
        </Link>
      </div>

      <div className="flex justify-center">
        <LegalLinks />
      </div>
    </div>
  );
}
