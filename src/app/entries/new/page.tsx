'use client';

import { useRouter } from 'next/navigation';
import { EntryForm } from '@/features/entries/entry-form';
import { monthOf } from '@/lib/dates';

export default function NewEntryPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">New entry</h2>
      {/* The list shows one month at a time: open the month the entry was dated in, or it would look lost. */}
      <EntryForm onSaved={(entry) => router.push(`/entries?month=${monthOf(entry.date)}`)} />
    </div>
  );
}
