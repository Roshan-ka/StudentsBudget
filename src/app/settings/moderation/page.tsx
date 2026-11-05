import { BackToSettings } from '@/components/back-to-settings';
import { PageHeading } from '@/components/page-heading';
import { ModerationView } from '@/features/hacks/moderation-view';

/** Settings → Moderation: the hacks students reported, for the app's moderator only (the hacks feed, chunk 7). */
export default function ModerationPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackToSettings />
      <PageHeading id="moderation" />
      <ModerationView />
    </div>
  );
}
