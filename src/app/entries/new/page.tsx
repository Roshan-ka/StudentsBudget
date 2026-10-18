'use client';

import { useRouter } from 'next/navigation';
import { EntryForm } from '@/features/entries/entry-form';

export default function NewEntryPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">New entry</h2>
      <EntryForm onSaved={() => router.push('/entries')} />
    </div>
  );
}
