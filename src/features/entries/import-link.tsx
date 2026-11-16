'use client';

import { FileUpIcon } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';

/**
 * The way from the entries to the bank statement import (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md,
 * chunk 9), for a student who imports instead of typing. Named like the import's own card, so the words match where it
 * leads. Not on Home, which every spec goes through. It sits above quick add: under it, the link moved up into a category
 * chip's place when the chips closed, under a double tap's second tap. An outline button since the receipt scan, beside
 * "Scan a receipt" (Roshan, mockups round 2, 16-11-2026: features as buttons, not text links).
 */
export function ImportLink() {
  const { t } = useT();
  return (
    <Link href="/settings/import" className={cn(buttonVariants({ variant: 'outline' }), 'h-full')}>
      <FileUpIcon aria-hidden="true" className="size-[18px]" />
      {t.importExport.import.heading}
    </Link>
  );
}
