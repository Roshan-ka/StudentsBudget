import { PageHeading } from '@/components/page-heading';
import { RevealView } from '@/features/reveal/reveal-view';

export default function RevealPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading id="reveal" />
      <RevealView />
    </div>
  );
}
