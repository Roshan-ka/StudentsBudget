'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { db } from '@/db/db';
import { HomeScreen } from '@/features/home/home';

export default function Home() {
  const router = useRouter();
  // 'loading' (no answer yet) must differ from null (no plan), or a saved plan would bounce to setup on every load.
  // The profile's name is read with the plan, so the greeting is there in the first paint and does not push Quick
  // add down a moment later.
  const loaded = useLiveQuery(
    () =>
      Promise.all([db.plan.get('current'), db.profile.get('current')]).then(([p, profile]) => ({
        plan: p ?? null,
        name: profile?.name.trim() ?? '',
      })),
    [],
    'loading' as const,
  );
  const plan = loaded === 'loading' ? 'loading' : loaded.plan;

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

  if (loaded === 'loading' || loaded.plan === null) return null;

  return <HomeScreen plan={loaded.plan} name={loaded.name} />;
}
