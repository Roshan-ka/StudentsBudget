'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArchiveIcon,
  BellIcon,
  ClipboardListIcon,
  CloudIcon,
  FileSpreadsheetIcon,
  InfoIcon,
  LandmarkIcon,
  ListChecksIcon,
  MonitorSmartphoneIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { useSyncStatus } from '@/features/account/sync-status';
import { useAuth } from '@/features/account/use-auth';
import { categoryTint } from '@/features/charts/colors';
import { amIModerator } from '@/features/hacks/moderation';
import { RowCardLink } from '@/features/home/row-card';
import { reminderSummary, remindersInBuild, usePhoneReminder } from '@/features/reminder/reminder';
import { useT } from '@/i18n/use-t';
import { getSupabase } from '@/lib/supabase/client';
import { useThemeChoice } from '@/theme/store';
import { accountsSummary, profileSummary } from './summaries';

/** The tile of the legal pages: no category of their own, so the neutral muted fill. */
const NEUTRAL_TINT = 'var(--muted)';

/**
 * One row of the list as its own card, as on Home (Roshan's group 2 mockups, 16-11-2026): a tinted tile, the page's
 * name, what is set there, and a chevron. The whole card is the link.
 */
function SettingsLink({
  href,
  icon,
  tint,
  title,
  summary,
}: {
  href: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  summary: ReactNode;
}) {
  return (
    <li>
      <RowCardLink href={href} icon={icon} tint={tint}>
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{summary}</span>
      </RowCardLink>
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
      tint={categoryTint('eating-out')}
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
 * The way to the moderation page (the hacks feed, chunk 7): only for the app's moderator, as the database says once
 * the account is signed in. Nobody else sees the row.
 */
function ModerationLink() {
  const { t } = useT();
  const auth = useAuth();
  const userId = auth.status === 'signed-in' ? auth.userId : null;
  // The answer, and for whom: an answer for another account never shows the row.
  const [moderator, setModerator] = useState<{ userId: string; yes: boolean } | null>(null);

  useEffect(() => {
    if (userId === null) return;
    const supabase = getSupabase();
    if (supabase === null) return;
    let current = true;
    void amIModerator(supabase).then((yes) => {
      if (current) setModerator({ userId, yes: yes === true });
    });
    return () => {
      current = false;
    };
  }, [userId]);

  if (userId === null || moderator?.userId !== userId || !moderator.yes) return null;
  return (
    <SettingsLink
      href="/settings/moderation"
      icon={ShieldCheckIcon}
      tint={categoryTint('other')}
      title={t.shell.headings.moderation}
      summary={t.tips.hacks.moderation.summary}
    />
  );
}

/**
 * The way to the weekly reminder (weekly reminder, chunk 4), with what this phone chose: "Off" or "Sundays at 18:00",
 * from the phone's own copy, so it shows offline too. Hidden in a build that can't send reminders.
 */
function ReminderLink() {
  const { t } = useT();
  const reminder = usePhoneReminder();
  if (!remindersInBuild()) return null;
  return (
    <SettingsLink
      href="/settings/reminder"
      icon={BellIcon}
      tint={categoryTint('transport')}
      title={t.shell.headings.reminder}
      summary={reminderSummary(reminder, t.reminder)}
    />
  );
}

/**
 * The pages of Settings, as one list (pain points, chunk 3): each opens its own page, so
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
    <ul className="flex flex-col gap-3">
      {/* Before a plan is saved the bottom nav doesn't show, so this is the way back to setup. */}
      {plan === null && (
        <SettingsLink
          href="/setup"
          icon={ClipboardListIcon}
          tint="var(--accent)"
          title={t.setup.setupRow.title}
          summary={t.setup.setupRow.summary}
        />
      )}
      <SettingsLink
        href="/settings/accounts"
        icon={LandmarkIcon}
        tint={categoryTint('rent')}
        title={t.shell.headings.accounts}
        summary={accounts ?? ' '}
      />
      {plan !== 'loading' && plan !== null && (
        <SettingsLink
          href="/settings/plan"
          icon={ListChecksIcon}
          tint="var(--accent)"
          title={t.shell.headings.plan}
          summary={t.setup.editPlan.summary}
        />
      )}
      <SettingsLink
        href="/settings/profile"
        icon={UserIcon}
        tint={categoryTint('food')}
        title={t.shell.headings.profile}
        summary={profileSummary(profile, t)}
      />
      <SettingsLink
        href="/settings/appearance"
        icon={THEME_ICONS[choice]}
        tint={categoryTint('going-out')}
        title={t.shell.headings.appearance}
        summary={t.theme.choices[choice]}
      />
      <AccountLink />
      <ReminderLink />
      <ModerationLink />
      <SettingsLink
        href="/settings/import"
        icon={FileSpreadsheetIcon}
        tint={categoryTint('shopping')}
        title={t.shell.headings.importExport}
        summary={t.importExport.summary}
      />
      <SettingsLink
        href="/settings/backup"
        icon={ArchiveIcon}
        tint={categoryTint('one-off')}
        title={t.shell.headings.backup}
        summary={t.backup.summary}
      />
      {/* The legal pages (legal pages, chunk 1): last, as on most apps. */}
      <SettingsLink
        href="/privacy"
        icon={ShieldCheckIcon}
        tint={NEUTRAL_TINT}
        title={t.shell.headings.privacy}
        summary={t.common.legal.privacySummary}
      />
      <SettingsLink
        href="/impressum"
        icon={InfoIcon}
        tint={NEUTRAL_TINT}
        title={t.shell.headings.impressum}
        summary={t.common.legal.impressumSummary}
      />
    </ul>
  );
}
