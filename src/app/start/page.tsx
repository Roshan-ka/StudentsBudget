import { InstallHint } from '@/features/setup/install-hint';
import { StartView } from '@/features/start/start-view';

export default function StartPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* The first screen of a new phone. The language is the globe in the header (StartLanguageMenu); on iOS Safari the
          hint to install first comes before the rest. */}
      <InstallHint />
      <StartView />
    </div>
  );
}
