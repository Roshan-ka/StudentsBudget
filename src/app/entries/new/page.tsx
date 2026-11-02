'use client';

import { useRouter } from 'next/navigation';
import { PageHeading } from '@/components/page-heading';
import { EntryForm } from '@/features/entries/entry-form';
import { monthOf } from '@/lib/dates';

export default function NewEntryPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <PageHeading id="newEntry" />
      {/* The list shows one month at a time: open the month the entry was dated in, or it would look lost. */}
      <EntryForm onSaved={(entry) => router.push(`/entries?month=${monthOf(entry.date)}`)} />
    </div>
  );
}
