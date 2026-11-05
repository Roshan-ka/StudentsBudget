import { BackToSettings } from '@/components/back-to-settings';
import { PageHeading } from '@/components/page-heading';
import { BackupPanel } from '@/features/backup/backup-panel';

/** Settings → Backup and data: export, restore, and delete everything on this phone. */
export default function BackupPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackToSettings />
      <PageHeading id="backup" />
      <BackupPanel />
    </div>
  );
}
