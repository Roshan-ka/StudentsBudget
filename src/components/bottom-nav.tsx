'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { db } from '@/db/db';

export const NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/entries', label: 'Entries' },
  { href: '/charts', label: 'Charts' },
  { href: '/settings', label: 'Settings' },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  // 'loading' (no answer yet) and null (no plan) both hide the nav: until setup is saved, there is
  // nothing to navigate to, and a tap on Home or Settings would leave a half-finished setup behind.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (plan === 'loading' || plan === null) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 border-t bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 items-center justify-center px-4 text-sm font-medium ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
