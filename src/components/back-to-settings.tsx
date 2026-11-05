'use client';

import { ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/i18n/use-t';

/** The way back from a page of Settings to its list (pain points, chunk 3). The bottom nav's Settings goes there too. */
export function BackToSettings() {
  const { t } = useT();
  return (
    <Link
      href="/settings"
      className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4"
    >
      <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:rotate-180" />
      {t.shell.backToSettings}
    </Link>
  );
}
