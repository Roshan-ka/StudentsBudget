import Link from 'next/link';
import { Suspense } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { EntriesList } from '@/features/entries/entries-list';
import { QuickAddField } from '@/features/entries/quick-add-field';
import { cn } from '@/lib/utils';

export default function EntriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Entries</h2>
        <Link href="/entries/new" className={cn(buttonVariants({ variant: 'outline' }), 'h-10 px-4')}>
          Add entry
        </Link>
      </div>
      <QuickAddField />
      {/* The list reads ?category= and ?month= with useSearchParams, which needs a Suspense boundary under cacheComponents. */}
      <Suspense fallback={null}>
        <EntriesList />
      </Suspense>
    </div>
  );
}
