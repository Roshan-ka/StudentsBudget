'use client';

import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';

/**
 * The way to the full entry form, in the phone's language: the Entries page around it renders on the server. The
 * page's filled main button with its icon (Roshan's group 2 mockups, 16-11-2026), at the end of the heading's line.
 */
export function AddEntryLink() {
  const { t } = useT();
  return (
    <Link href="/entries/new" className={cn(buttonVariants(), 'w-fit max-w-full')}>
      <PlusIcon aria-hidden="true" />
      {t.entries.addEntry}
    </Link>
  );
}
