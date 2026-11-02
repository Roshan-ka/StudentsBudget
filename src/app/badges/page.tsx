import { PageHeading } from '@/components/page-heading';
import { BadgesView } from '@/features/badges/badges-view';

export default function BadgesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading id="badges" />
      <BadgesView />
    </div>
  );
}
