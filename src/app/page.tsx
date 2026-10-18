'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { db } from '@/db/db';
import { HomeScreen } from '@/features/home/home';

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

  return <HomeScreen plan={plan} />;
}
