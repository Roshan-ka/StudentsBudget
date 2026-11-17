'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardListIcon, PencilIcon } from 'lucide-react';
import { LinkButton } from '@/components/link-button';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import { useT } from '@/i18n/use-t';
import { planSummary } from '@/lib/budget';
import { monthOf, todayIso } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * The top of Settings → Plan, in the accent card (group 4 redesign, Roshan's mockups, 17-11-2026): what comes in and
 * what goes on fixed costs each month, as the plan has them (`planSummary`: paused lines left out), then the way into
 * editing the plan. A part the plan has nothing for is left out, and with neither only the words and Edit plan stay.
 * Before a plan exists the page says so, with the way to setup, as every other page does (review U2, 17-11-2026).
 */
export function EditPlanSection() {
  const { t, locale } = useT();
  const text = t.setup.editPlan;
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  if (plan === 'loading') return null;
  if (plan === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground">{text.noPlan}</p>
        <LinkButton href="/setup" icon={ClipboardListIcon}>
          {t.common.toSetup}
        </LinkButton>
      </div>
    );
  }

  // Rendered on the phone only (the plan comes from Dexie), so today's month is the phone's.
  const { incomeMinor, fixedMinor } = planSummary(plan, monthOf(todayIso()));
  const money = (minor: number) => formatMoney(minor, 'EUR', { whole: true, locale });
  const parts = [
    ...(incomeMinor > 0 ? [text.comesIn(money(incomeMinor))] : []),
    ...(fixedMinor > 0 ? [text.fixedOut(money(fixedMinor))] : []),
  ];

  return (
    // Named by its page's heading (/settings/plan), which has the id.
    <section aria-labelledby="plan-heading" className={cn(cardVariants({ variant: 'accent' }), 'gap-2')}>
      {parts.length > 0 && (
        <>
          <p className="text-sm font-semibold">{text.eachMonth}</p>
          <p className="font-heading text-3xl leading-tight font-extrabold tracking-tight tabular-nums break-words">
            {parts.join(' · ')}
          </p>
        </>
      )}
      <p className="text-sm">{text.body}</p>
      {/* With Home's pencil: "Edit plan" looks the same everywhere. */}
      <LinkButton href="/setup?edit=1" icon={PencilIcon}>
        {text.link}
      </LinkButton>
    </section>
  );
}
