'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { RestoreFromBackup } from './restore-from-backup';

/**
 * The way back in for someone who already has a backup: shown on /setup, below the wizard, while there is no
 * plan, so a new or wiped phone can restore without setting up first. Hidden once a plan exists (editing the
 * plan included).
 */
export function SetupRestoreSection() {
  // 'loading' (no answer yet) and a saved plan both render nothing.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (plan !== null) return null;

  return (
    <section aria-labelledby="restore-heading" className="flex flex-col gap-3 rounded-lg border px-4 py-3">
      <h2 id="restore-heading" className="text-lg font-semibold">
        Have a backup? Restore it
      </h2>
      <p className="text-sm text-muted-foreground">
        Used StudentsBudget before? Choose your backup file to carry on where you left off.
      </p>
      <RestoreFromBackup />
    </section>
  );
}
