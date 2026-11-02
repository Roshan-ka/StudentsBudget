import { PageHeading } from '@/components/page-heading';
import { CheckInView } from '@/features/check-in/check-in-view';

export default function CheckInPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading id="checkIn" />
      <CheckInView />
    </div>
  );
}
