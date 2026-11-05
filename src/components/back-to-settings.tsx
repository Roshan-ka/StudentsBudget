'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db/db';
import { useT } from '@/i18n/use-t';

/**
 * The way back from a page of Settings to its list (pain points, chunk 3). The bottom nav's Settings goes there too.
 * Before a plan is saved it goes back to setup instead: setup's "Sign in to get your data" opens Your account, the
 * bottom nav doesn't show yet, and the Settings list would be a dead end.
 */
export function BackToSettings() {
  const { t } = useT();
  // 'loading' keeps the Settings link, as the page was prerendered.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const toSetup = plan === null;
  return (
    <Link
      href={toSetup ? '/setup' : '/settings'}
      className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
    >
      <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:rotate-180" />
      {toSetup ? t.shell.backToSetup : t.shell.backToSettings}
    </Link>
  );
}
