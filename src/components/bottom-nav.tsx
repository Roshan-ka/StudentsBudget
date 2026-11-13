'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChartPieIcon,
  HouseIcon,
  LightbulbIcon,
  ReceiptTextIcon,
  SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { db } from '@/db/db';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';

/** The pages the navigation leads to; each label comes from the dictionary (`shell.nav`), each icon only decorates. */
export const NAV_ITEMS: { href: string; key: keyof Messages['shell']['nav']; icon: LucideIcon }[] = [
  { href: '/', key: 'home', icon: HouseIcon },
  { href: '/entries', key: 'entries', icon: ReceiptTextIcon },
  { href: '/charts', key: 'charts', icon: ChartPieIcon },
  { href: '/tips', key: 'tips', icon: LightbulbIcon },
  { href: '/settings', key: 'settings', icon: SettingsIcon },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether a path is one of the navigation's pages or below one (Settings' pages): where Ask's bubble shows. */
export function onNavPage(pathname: string): boolean {
  return NAV_ITEMS.some(({ href }) => isActive(pathname, href));
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  // 'loading' (no answer yet) and null (no plan) both hide the nav: until setup is saved, there is
  // nothing to navigate to, and a tap on Home or Settings would leave a half-finished setup behind.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (plan === 'loading' || plan === null) return null;

  return (
    <nav
      aria-label={t.shell.navLabel}
      className="fixed inset-x-0 bottom-0 border-t-[1.5px] border-outline bg-nav pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            // min-w-0 and a label that may break: a longer label in another language, or text at 200 %, wraps inside
            // its fifth of the width instead of pushing the bar wider than the phone (labels are kept to 9 characters,
            // tested). The page is said by aria-current and the bold label, not by the pill's colour alone.
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5 text-center text-[12.5px] leading-tight [overflow-wrap:anywhere]',
                  active ? 'font-bold text-foreground' : 'font-semibold text-nav-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-7 w-12 max-w-full items-center justify-center rounded-full border-[1.5px]',
                    active ? 'border-outline bg-accent' : 'border-transparent',
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {t.shell.nav[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
