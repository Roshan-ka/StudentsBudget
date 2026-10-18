import { CheckInView } from '@/features/check-in/check-in-view';

export default function CheckInPage() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Weekly check-in</h2>
      <CheckInView />
    </div>
  );
}
