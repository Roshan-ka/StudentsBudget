'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { db } from '@/db/db';

/** The way into editing the plan. Shown only once a plan exists: before that there is nothing to edit. */
export function EditPlanSection() {
  // 'loading' (no answer yet) and null (no plan) both render nothing.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (plan === 'loading' || plan === null) return null;

  return (
    <section aria-labelledby="plan-heading" className="flex flex-col gap-3">
      <h3 id="plan-heading" className="text-lg font-semibold">
        Plan
      </h3>
      <p className="text-muted-foreground">
        Change your envelopes and one-off costs, or go through the whole plan again. Accounts are below, and your
        guesses stay as you made them.
      </p>
      <Link href="/setup?edit=1" className={buttonVariants({ variant: 'outline', className: 'h-10 self-start px-4' })}>
        Edit plan
      </Link>
    </section>
  );
}
