import { Suspense } from 'react';
import { InstallHint } from '@/features/setup/install-hint';
import { SetupWizard } from '@/features/setup/setup-wizard';

export default function SetupPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* The language is the globe in the header (StartLanguageMenu). The account line and the restore sit under the
          wizard's first step (13-11-2026). */}
      <InstallHint />
      {/* The wizard reads ?edit=1 with useSearchParams, which needs a Suspense boundary under cacheComponents. */}
      <Suspense fallback={null}>
        <SetupWizard />
      </Suspense>
    </div>
  );
}
