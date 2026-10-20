import { TipsView } from '@/features/tips/tips-view';

export default function TipsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Regensburg tips</h2>
      <TipsView />
    </div>
  );
}
