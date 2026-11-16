import { BackToSettings } from '@/components/back-to-settings';
import { PageHeading } from '@/components/page-heading';
import { BackupIntro, BackupPanel } from '@/features/backup/backup-panel';

/** Settings → Backup and data: export, restore, and delete everything on this phone, a card each. */
export default function BackupPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackToSettings />
      {/* The intro's one line sits right under the heading (Roshan's mockups, 16-11-2026). */}
      <div className="flex flex-col gap-2">
        <PageHeading id="backup" />
        <BackupIntro />
      </div>
      <BackupPanel />
    </div>
  );
}
