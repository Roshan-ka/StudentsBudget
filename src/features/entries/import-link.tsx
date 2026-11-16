'use client';

import { ImportIcon } from 'lucide-react';
import { LinkButton } from '@/components/link-button';
import { useT } from '@/i18n/use-t';

/**
 * The way from the entries to the bank statement import (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md,
 * chunk 9), for a student who imports instead of typing. Named like the import's own card, so the words match where it
 * leads. Not on Home, which every spec goes through. An outline button at the foot of Entries, after the list (Roshan's
 * group 2 mockups, 16-11-2026). It used to sit above quick add because, under it, the button moved up into a category
 * chip's place when the chips closed, under a double tap's second tap; quick add now keeps its height for a moment after
 * a pick (`KEEP_SPACE_MS` in quick-add-field.tsx), so nothing under it moves while a second tap can land.
 */
export function ImportLink() {
  const { t } = useT();
  return (
    <LinkButton href="/settings/import" icon={ImportIcon}>
      {t.importExport.import.heading}
    </LinkButton>
  );
}
