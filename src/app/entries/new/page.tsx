'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeading } from '@/components/page-heading';
import { EntryForm } from '@/features/entries/entry-form';
import { monthOf } from '@/lib/dates';

/**
 * Saving goes back where the person came from (pain points, chunk 6): the check-in when its link opened the form
 * (`?from=check-in`), else the entries of the month the entry was dated in. Only those two: never a URL from the query.
 */
function NewEntry() {
  const router = useRouter();
  const fromCheckIn = useSearchParams().get('from') === 'check-in';

  return (
    <EntryForm
      onSaved={(entry) => router.push(fromCheckIn ? '/check-in' : `/entries?month=${monthOf(entry.date)}`)}
    />
  );
}

export default function NewEntryPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeading id="newEntry" />
      {/* It reads the search params, so it renders inside Suspense (Cache Components). */}
      <Suspense>
        <NewEntry />
      </Suspense>
    </div>
  );
}
