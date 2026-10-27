import { BadgesView } from '@/features/badges/badges-view';

export default function BadgesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Badges</h2>
      <BadgesView />
    </div>
  );
}
