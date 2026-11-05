import { LanguageSection } from '@/components/language-picker';
import { PageHeading } from '@/components/page-heading';
import { AppearanceSection } from '@/components/theme-picker';
import { AccountSection } from '@/features/account/account-section';
import { ProfileSection } from '@/features/profile/profile-section';
import { RecurringEditor } from '@/features/recurring/recurring-editor';
import { SettingsLinks } from '@/features/settings/settings-links';
import { EditPlanSection } from '@/features/setup/edit-plan-section';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeading id="settings" />
      {/* First: someone who can't read the current language looks here for theirs. */}
      <LanguageSection />
      {/* The pages of Settings (pain points, chunks 3 and 4); the sections below move to pages of their own next. */}
      <SettingsLinks />
      <AppearanceSection />
      <AccountSection />
      <ProfileSection />
      <EditPlanSection />
      <RecurringEditor />
    </div>
  );
}
