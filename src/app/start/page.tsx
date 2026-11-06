import { LanguagePicker } from '@/components/language-picker';
import { InstallHint } from '@/features/setup/install-hint';
import { StartView } from '@/features/start/start-view';

export default function StartPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* The first screen of a new phone: the language comes first, and on iOS Safari the hint to install first. */}
      <LanguagePicker />
      <InstallHint />
      <StartView />
    </div>
  );
}
