import { Suspense } from 'react';
import { PageHeading } from '@/components/page-heading';
import { AddEntryLink } from '@/features/entries/add-entry-link';
import { EntriesList } from '@/features/entries/entries-list';
import { ImportLink } from '@/features/entries/import-link';
import { QuickAddField } from '@/features/entries/quick-add-field';

export default function EntriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <PageHeading id="entries" />
        <AddEntryLink />
      </div>
      <div className="flex flex-col gap-2">
        <QuickAddField />
        <ImportLink />
      </div>
      {/* The list reads ?category= and ?month= with useSearchParams, which needs a Suspense boundary under cacheComponents. */}
      <Suspense fallback={null}>
        <EntriesList />
      </Suspense>
    </div>
  );
}
