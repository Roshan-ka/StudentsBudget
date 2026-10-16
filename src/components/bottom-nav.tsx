'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Later tasks add Settings (5), Entries (9) and Charts (11).
export const NAV_ITEMS: { href: string; label: string }[] = [{ href: '/', label: 'Home' }];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

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
