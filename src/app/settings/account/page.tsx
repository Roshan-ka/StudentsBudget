import { AccountView } from '@/features/account/account-view';

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Your account</h2>
      <AccountView />
    </div>
  );
}
