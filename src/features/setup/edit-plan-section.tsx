'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { db } from '@/db/db';
import { useT } from '@/i18n/use-t';

/** The way into editing the plan. Shown only once a plan exists: before that there is nothing to edit. */
export function EditPlanSection() {
  const { t } = useT();
  const text = t.setup.editPlan;
  // 'loading' (no answer yet) and null (no plan) both render nothing.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (plan === 'loading' || plan === null) return null;

  return (
    <section aria-labelledby="plan-heading" className="flex flex-col gap-3">
      <h3 id="plan-heading" className="text-lg font-semibold">
        {text.heading}
      </h3>
      <p className="text-muted-foreground">{text.body}</p>
      <Link href="/setup?edit=1" className={buttonVariants({ variant: 'outline', className: 'self-start px-4' })}>
        {text.link}
      </Link>
    </section>
  );
}
