import { BackToSettings } from '@/components/back-to-settings';
import { PageHeading } from '@/components/page-heading';
import { AppearanceSection } from '@/components/theme-picker';

/** Settings → Appearance: Light, Dark or Same as phone. */
export default function AppearancePage() {
  return (
    <div className="flex flex-col gap-5">
      <BackToSettings />
      <PageHeading id="appearance" htmlId="appearance-heading" />
      <AppearanceSection />
    </div>
  );
}
