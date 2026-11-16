'use client';

import { PlusIcon } from 'lucide-react';
import { LinkButton } from '@/components/link-button';
import { useT } from '@/i18n/use-t';

/**
 * The way to the full entry form, in the phone's language: the Entries page around it renders on the server. An
 * outlined button with its icon, as every way on (16-11-2026).
 */
export function AddEntryLink() {
  const { t } = useT();
  return (
    <LinkButton href="/entries/new" icon={PlusIcon}>
      {t.entries.addEntry}
    </LinkButton>
  );
}
