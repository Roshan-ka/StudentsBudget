import { RevealView } from '@/features/reveal/reveal-view';

export default function RevealPage() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Guess vs. reality</h2>
      <RevealView />
    </div>
  );
}
