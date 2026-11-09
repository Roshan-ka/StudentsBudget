import { PageHeading } from '@/components/page-heading';
import { AskView } from '@/features/ask/ask-view';

/** Ask (the AI phase, chunk 10): questions about the student's own budget, outside the bottom navigation. */
export default function AskPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeading id="ask" />
      <AskView />
    </div>
  );
}
