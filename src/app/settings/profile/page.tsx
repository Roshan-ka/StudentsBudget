import { BackToSettings } from '@/components/back-to-settings';
import { PageHeading } from '@/components/page-heading';
import { ProfileSection } from '@/features/profile/profile-section';

/** Settings → Profile: name, university and semester, kept on this phone. */
export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-5">
      <BackToSettings />
      <PageHeading id="profile" htmlId="profile-heading" />
      <ProfileSection />
    </div>
  );
}
