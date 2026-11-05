'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ArchiveIcon, ChevronRightIcon, LandmarkIcon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { accountsSummary } from './summaries';

/** One row of the list: an icon, the page's name, what is set there, and a chevron. The whole row is the link. */
function SettingsLink({
  href,
  icon: Icon,
  title,
  summary,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  summary: ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-outline"
        >
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-muted-foreground">{summary}</span>
        </span>
        <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 rtl:rotate-180" />
      </Link>
    </li>
  );
}

/**
 * The pages of Settings, as one list under the language picker (pain points, chunk 3): each opens its own page, so
 * Settings itself stays short. The summaries read the phone's data, so they appear once it has been read.
 */
export function SettingsLinks() {
  const { t, locale } = useT();
  const accounts = useLiveQuery(
    async () => {
      const [list, entries, rates] = await Promise.all([db.accounts.toArray(), db.entries.toArray(), loadRates()]);
      return accountsSummary(list, entries, rates, t, locale);
    },
    [t, locale],
  );

  return (
    <ul className={cn(cardVariants(), 'gap-0 divide-y-[1.5px] divide-border p-0')}>
      <SettingsLink
        href="/settings/accounts"
        icon={LandmarkIcon}
        title={t.shell.headings.accounts}
        summary={accounts ?? ' '}
      />
      <SettingsLink href="/settings/backup" icon={ArchiveIcon} title={t.shell.headings.backup} summary={t.backup.summary} />
    </ul>
  );
}
