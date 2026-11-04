'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';

/** The way to the full entry form, in the phone's language: the Entries page around it renders on the server. */
export function AddEntryLink() {
  const { t } = useT();
  return (
    <Link href="/entries/new" className={cn(buttonVariants({ variant: 'outline' }), 'px-4')}>
      {t.entries.addEntry}
    </Link>
  );
}
