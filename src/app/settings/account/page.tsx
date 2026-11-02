import { PageHeading } from '@/components/page-heading';
import { AccountView } from '@/features/account/account-view';

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading id="account" />
      <AccountView />
    </div>
  );
}
