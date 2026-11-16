'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeftIcon } from 'lucide-react';
import { LinkButton } from '@/components/link-button';
import { db } from '@/db/db';
import { useT } from '@/i18n/use-t';

/**
 * The way back from a page of Settings to its list (pain points, chunk 3). The bottom nav's Settings goes there too.
 * Before a plan is saved it goes back to setup instead: the bottom nav doesn't show yet, and the Settings list would be
 * a dead end. An outlined button, as every way to another page (16-11-2026: buttons, never text links).
 */
export function BackToSettings() {
  const { t } = useT();
  // 'loading' keeps the Settings link, as the page was prerendered.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const toSetup = plan === null;
  return (
    <LinkButton href={toSetup ? '/setup' : '/settings'} icon={ChevronLeftIcon} iconClassName="rtl:rotate-180">
      {toSetup ? t.shell.backToSetup : t.shell.backToSettings}
    </LinkButton>
  );
}
