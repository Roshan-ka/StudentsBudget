import { LanguageSection } from '@/components/language-picker';
import { PageHeading } from '@/components/page-heading';
import { SettingsLinks } from '@/features/settings/settings-links';

/** Settings: the language picker, then a list of its pages (pain points, chunks 3 and 4). */
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeading id="settings" />
      {/* First: someone who can't read the current language looks here for theirs. */}
      <LanguageSection />
      <SettingsLinks />
    </div>
  );
}
