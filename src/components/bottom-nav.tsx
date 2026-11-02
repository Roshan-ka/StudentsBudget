'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { db } from '@/db/db';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';

/** The pages the navigation leads to; each label comes from the dictionary (`shell.nav`). */
export const NAV_ITEMS: { href: string; key: keyof Messages['shell']['nav'] }[] = [
  { href: '/', key: 'home' },
  { href: '/entries', key: 'entries' },
  { href: '/charts', key: 'charts' },
  { href: '/tips', key: 'tips' },
  { href: '/settings', key: 'settings' },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
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
      className="fixed inset-x-0 bottom-0 border-t bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {NAV_ITEMS.map(({ href, key }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 items-center justify-center px-1 text-sm font-medium ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {t.shell.nav[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
