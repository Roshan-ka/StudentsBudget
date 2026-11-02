import { PageHeading } from '@/components/page-heading';
import { ChartsView } from '@/features/charts/charts-view';

export default function ChartsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading id="charts" />
      <ChartsView />
    </div>
  );
}
