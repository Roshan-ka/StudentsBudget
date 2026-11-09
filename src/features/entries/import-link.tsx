'use client';

import Link from 'next/link';
import { useT } from '@/i18n/use-t';

/**
 * A quiet way from the entries to the bank statement import (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md,
 * chunk 9), for a student who imports instead of typing. Named like the import's own card, so the words match where it
 * leads. Not on Home, which every spec goes through. It sits above quick add: under it, the link moved up into a category
 * chip's place when the chips closed, under a double tap's second tap.
 */
export function ImportLink() {
  const { t } = useT();
  return (
    // At least 44 px high, as every tap target (the start page's text links alike).
    <Link
      href="/settings/import"
      className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline underline-offset-4"
    >
      {t.importExport.import.heading}
    </Link>
  );
}
