import { Suspense } from 'react';
import { SetupRestoreSection } from '@/features/backup/setup-restore-section';
import { InstallHint } from '@/features/setup/install-hint';
import { SetupWizard } from '@/features/setup/setup-wizard';

export default function SetupPage() {
  return (
    <div className="flex flex-col gap-4">
      <InstallHint />
      <SetupRestoreSection />
      {/* The wizard reads ?edit=1 with useSearchParams, which needs a Suspense boundary under cacheComponents. */}
      <Suspense fallback={null}>
        <SetupWizard />
      </Suspense>
    </div>
  );
}
