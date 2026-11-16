import { Suspense } from 'react';
import { PageHeading } from '@/components/page-heading';
import { cardVariants } from '@/components/ui/card';
import { AddEntryLink } from '@/features/entries/add-entry-link';
import { EntriesList } from '@/features/entries/entries-list';
import { ImportLink } from '@/features/entries/import-link';
import { QuickAddField } from '@/features/entries/quick-add-field';
import { ScanReceipt } from '@/features/receipts/scan-receipt';

/** Entries in the group 2 look (Roshan's mockups, 16-11-2026). */
export default function EntriesPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Add entry goes under the heading where the two don't fit side by side (large text). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeading id="entries" />
        <AddEntryLink />
      </div>
      {/* Quick add in a card, with "Scan a receipt" (and a scan's card) under it. Quick add keeps its height for a moment
          after an amount or a category is picked, so its buttons closing never moves the scan button, the list or the
          import button under a double tap's second tap (seen on the iPhone). */}
      <div className={cardVariants()}>
        <QuickAddField />
        <ScanReceipt />
      </div>
      {/* The list reads ?category= and ?month= with useSearchParams, which needs a Suspense boundary under cacheComponents. */}
      <Suspense fallback={null}>
        <EntriesList />
      </Suspense>
      {/* The bank statement import, at the page's foot, after the list. */}
      <div className="border-t-[1.5px] border-dashed border-outline pt-4">
        <ImportLink />
      </div>
    </div>
  );
}
