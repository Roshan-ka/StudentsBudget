import { BackToSettings } from '@/components/back-to-settings';
import { PageHeading } from '@/components/page-heading';
import { AccountsPanel } from '@/features/accounts/accounts-panel';
import { RatesPanel } from '@/features/accounts/rates-panel';
import { TransferSection } from '@/features/accounts/transfer-form';

/** Settings → Accounts and transfers: the accounts, moving money between them, and the rates of other currencies. */
export default function AccountsPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackToSettings />
      <PageHeading id="accounts" />
      <AccountsPanel />
      <TransferSection />
      <RatesPanel />
    </div>
  );
}
