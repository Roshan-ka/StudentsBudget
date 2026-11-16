import { PageHeading } from '@/components/page-heading';
import { SettingsLinks } from '@/features/settings/settings-links';

/**
 * Settings: a list of its pages (pain points, chunks 3 and 4). The language is the globe in every page's header since
 * 16-11-2026 (Roshan), so Settings has no language section any more.
 */
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeading id="settings" />
      <SettingsLinks />
    </div>
  );
}
