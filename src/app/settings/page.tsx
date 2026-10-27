import { AccountSection } from '@/features/account/account-section';
import { AccountsPanel } from '@/features/accounts/accounts-panel';
import { RatesPanel } from '@/features/accounts/rates-panel';
import { TransferSection } from '@/features/accounts/transfer-form';
import { BackupPanel } from '@/features/backup/backup-panel';
import { ProfileSection } from '@/features/profile/profile-section';
import { RecurringEditor } from '@/features/recurring/recurring-editor';
import { EditPlanSection } from '@/features/setup/edit-plan-section';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Settings</h2>
      <AccountSection />
      <ProfileSection />
      <EditPlanSection />
      <RecurringEditor />
      <AccountsPanel />
      <TransferSection />
      <RatesPanel />
      <BackupPanel />
    </div>
  );
}
