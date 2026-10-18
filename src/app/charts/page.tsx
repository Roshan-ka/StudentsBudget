import { ChartsView } from '@/features/charts/charts-view';

export default function ChartsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Charts</h2>
      <ChartsView />
    </div>
  );
}
