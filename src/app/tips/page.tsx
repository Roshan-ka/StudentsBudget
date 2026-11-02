import { PageHeading } from '@/components/page-heading';
import { TipsView } from '@/features/tips/tips-view';

export default function TipsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading id="tips" />
      <TipsView />
    </div>
  );
}
