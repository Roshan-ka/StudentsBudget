'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArchiveIcon,
  ChevronRightIcon,
  CloudIcon,
  LandmarkIcon,
  ListChecksIcon,
  MonitorSmartphoneIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { useSyncStatus } from '@/features/account/sync-status';
import { useAuth } from '@/features/account/use-auth';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { useThemeChoice } from '@/theme/store';
import { accountsSummary, profileSummary } from './summaries';

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

const THEME_ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorSmartphoneIcon } as const;

/**
 * The way to the account: what it stands at, and how this phone's sync stands while it is linked. Hidden when the build
 * has no Supabase project.
 */
function AccountLink() {
  const { t } = useT();
  const text = t.account.card;
  const auth = useAuth();
  // The signed-in user's: a phone linked to another account says so.
  const syncStatus = useSyncStatus(auth.status === 'signed-in' ? auth.userId : undefined);
  if (auth.status === 'off') return null;
  const status =
    auth.status === 'signed-in'
      ? text.signedIn(auth.email)
      : auth.status === 'second-step'
        ? text.secondStep(auth.email)
        : text.signedOut;
  return (
    <SettingsLink
      href="/settings/account"
      icon={CloudIcon}
      title={text.heading}
      summary={
        <>
          <span className="block break-words">{status}</span>
          {auth.status === 'signed-in' && syncStatus !== null && <span className="block">{syncStatus}</span>}
        </>
      }
    />
  );
}

/**
 * The pages of Settings, as one list under the language picker (pain points, chunk 3): each opens its own page, so
 * Settings itself stays short. The summaries read the phone's data, so they appear once it has been read.
 */
export function SettingsLinks() {
  const { t, locale } = useT();
  const choice = useThemeChoice();
  // 'loading' renders no Plan row yet; without a plan there is nothing to edit there.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const profile = useLiveQuery(() => db.profile.get('current'), []);
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
      {plan !== 'loading' && plan !== null && (
        <SettingsLink
          href="/settings/plan"
          icon={ListChecksIcon}
          title={t.shell.headings.plan}
          summary={t.setup.editPlan.summary}
        />
      )}
      <SettingsLink
        href="/settings/profile"
        icon={UserIcon}
        title={t.shell.headings.profile}
        summary={profileSummary(profile, t)}
      />
      <SettingsLink
        href="/settings/appearance"
        icon={THEME_ICONS[choice]}
        title={t.shell.headings.appearance}
        summary={t.theme.choices[choice]}
      />
      <AccountLink />
      <SettingsLink href="/settings/backup" icon={ArchiveIcon} title={t.shell.headings.backup} summary={t.backup.summary} />
    </ul>
  );
}
