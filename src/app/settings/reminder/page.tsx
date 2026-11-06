import { BackToSettings } from '@/components/back-to-settings';
import { PageHeading } from '@/components/page-heading';
import { ReminderView } from '@/features/reminder/reminder-view';

/** Settings → Weekly reminder: a weekly line on this phone that it's time for the check-in (weekly reminder, chunk 4). */
export default function ReminderPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackToSettings />
      <PageHeading id="reminder" />
      <ReminderView />
    </div>
  );
}
