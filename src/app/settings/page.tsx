import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { AccountsPanel } from '@/features/accounts/accounts-panel';
import { RatesPanel } from '@/features/accounts/rates-panel';
import { TransferSection } from '@/features/accounts/transfer-form';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Settings</h2>
      <section aria-labelledby="plan-heading" className="flex flex-col gap-3">
        <h3 id="plan-heading" className="text-lg font-semibold">
          Plan
        </h3>
        <p className="text-muted-foreground">
          Change your rent, income, costs or envelopes. Accounts are below, and your guesses stay as you made them.
        </p>
        <Link href="/setup?edit=1" className={buttonVariants({ variant: 'outline', className: 'h-10 self-start px-4' })}>
          Edit plan
        </Link>
      </section>
      <AccountsPanel />
      <TransferSection />
      <RatesPanel />
    </div>
  );
}
