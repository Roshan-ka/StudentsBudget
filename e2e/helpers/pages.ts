import type { Locator, Page } from '@playwright/test';
import type { Messages } from '../../src/i18n/messages';

/** A page's level-2 heading by its exact name. */
export const heading = (page: Page, name: string) => page.getByRole('heading', { level: 2, name, exact: true });

/**
 * Each page after setup, and what shows it is drawn in the phone's language: its heading, or Home's first region.
 * The tours walk it (`language-tour.spec.ts`, `reflow.spec.ts`); a new page belongs here as well as in the map.
 */
export const PAGES: { path: string; shown: (page: Page, t: Messages) => Locator }[] = [
  { path: '/', shown: (page, t) => page.getByRole('region', { name: t.home.leftThisMonth.heading, exact: true }) },
  { path: '/entries', shown: (page, t) => heading(page, t.shell.headings.entries) },
  { path: '/entries/new', shown: (page, t) => heading(page, t.shell.headings.newEntry) },
  { path: '/charts', shown: (page, t) => heading(page, t.shell.headings.charts) },
  { path: '/tips', shown: (page, t) => heading(page, t.shell.headings.tips) },
  { path: '/badges', shown: (page, t) => heading(page, t.shell.headings.badges) },
  { path: '/check-in', shown: (page, t) => heading(page, t.shell.headings.checkIn) },
  { path: '/reveal', shown: (page, t) => heading(page, t.shell.headings.reveal) },
  { path: '/settings', shown: (page, t) => heading(page, t.shell.headings.settings) },
  { path: '/settings/accounts', shown: (page, t) => heading(page, t.shell.headings.accounts) },
  { path: '/settings/backup', shown: (page, t) => heading(page, t.shell.headings.backup) },
  { path: '/settings/plan', shown: (page, t) => heading(page, t.shell.headings.plan) },
  { path: '/settings/profile', shown: (page, t) => heading(page, t.shell.headings.profile) },
  { path: '/settings/appearance', shown: (page, t) => heading(page, t.shell.headings.appearance) },
  { path: '/settings/account', shown: (page, t) => heading(page, t.shell.headings.account) },
  { path: '/settings/moderation', shown: (page, t) => heading(page, t.shell.headings.moderation) },
  { path: '/settings/reminder', shown: (page, t) => heading(page, t.shell.headings.reminder) },
];
