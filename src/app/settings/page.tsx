import { AccountsPanel } from '@/features/accounts/accounts-panel';
import { RatesPanel } from '@/features/accounts/rates-panel';
import { TransferSection } from '@/features/accounts/transfer-form';
import { EditPlanSection } from '@/features/setup/edit-plan-section';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Settings</h2>
      <EditPlanSection />
      <AccountsPanel />
      <TransferSection />
      <RatesPanel />
    </div>
  );
}
