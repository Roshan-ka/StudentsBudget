'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { db } from '@/db/db';

export default function Home() {
  const router = useRouter();
  // 'loading' (no answer yet) must differ from null (no plan), or a saved plan would bounce to setup on every load.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);

  useEffect(() => {
    if (plan !== null) return;
    // The router keeps a page it has left mounted but hidden, so `plan` can still be the null from before
    // setup when the person comes back. Ask the database again before sending them away.
    let cancelled = false;
    db.plan.get('current').then(
      (saved) => {
        if (!cancelled && !saved) router.replace('/setup');
      },
      (error: unknown) => console.error('StudentsBudget: could not read the saved plan', error),
    );
    return () => {
      cancelled = true;
    };
  }, [plan, router]);

  if (plan === 'loading' || plan === null) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold">Home</h2>
      <p className="mt-2 text-muted-foreground">Your budget will show up here.</p>
    </section>
  );
}
