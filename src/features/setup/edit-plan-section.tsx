'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { PencilIcon } from 'lucide-react';
import { LinkButton } from '@/components/link-button';
import { cardVariants } from '@/components/ui/card';
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
    // Named by its page's heading (/settings/plan), which has the id.
    <section aria-labelledby="plan-heading" className={cardVariants()}>
      <p className="text-muted-foreground">{text.body}</p>
      {/* With Home's pencil: "Edit plan" looks the same everywhere. */}
      <LinkButton href="/setup?edit=1" icon={PencilIcon}>
        {text.link}
      </LinkButton>
    </section>
  );
}
