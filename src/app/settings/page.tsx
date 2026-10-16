import { AccountsPanel } from '@/features/accounts/accounts-panel';
import { RatesPanel } from '@/features/accounts/rates-panel';
import { TransferSection } from '@/features/accounts/transfer-form';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Settings</h2>
      <AccountsPanel />
      <TransferSection />
      <RatesPanel />
    </div>
  );
}
