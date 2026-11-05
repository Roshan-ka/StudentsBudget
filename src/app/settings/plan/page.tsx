import { BackToSettings } from '@/components/back-to-settings';
import { PageHeading } from '@/components/page-heading';
import { RecurringEditor } from '@/features/recurring/recurring-editor';
import { EditPlanSection } from '@/features/setup/edit-plan-section';

/** Settings → Plan: the way into editing the plan, and the fixed costs and income that repeat. */
export default function PlanPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackToSettings />
      <PageHeading id="plan" htmlId="plan-heading" />
      <EditPlanSection />
      <RecurringEditor />
    </div>
  );
}
