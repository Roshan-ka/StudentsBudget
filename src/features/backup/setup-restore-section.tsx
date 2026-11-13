'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useT } from '@/i18n/use-t';
import { RestoreFromBackup } from './restore-from-backup';

/**
 * The way back in for someone who already has a backup: on /setup, under the first step's buttons, while there is no
 * plan, so a new or wiped phone can restore without setting up first. Hidden once a plan exists (editing the plan
 * included). Quiet since 13-11-2026: its heading for screen readers, and one button that opens the file field.
 */
export function SetupRestoreSection() {
  const { t } = useT();
  // 'loading' (no answer yet) and a saved plan both render nothing.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (plan !== null) return null;

  return (
    <section aria-labelledby="restore-heading" className="flex w-full flex-col items-center">
      <h2 id="restore-heading" className="sr-only">
        {t.backup.restore.setupHeading}
      </h2>
      <RestoreFromBackup compact />
    </section>
  );
}
