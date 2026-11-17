'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { db } from '@/db/db';
import { useAuth } from '@/features/account/use-auth';
import { HomeScreen } from '@/features/home/home';
import { firstRunPathSoon, sessionMayBeStored } from '@/features/start/first-run';

export default function Home() {
  const router = useRouter();
  // 'loading' (no answer yet) must differ from null (no plan), or a saved plan would bounce to setup on every load.
  // The profile is read with the plan, so the greeting is there in the first paint and does not push Quick add down
  // a moment later, and the badges' gold never shows the default semester first.
  const loaded = useLiveQuery(
    () =>
      Promise.all([db.plan.get('current'), db.profile.get('current')]).then(([p, profile]) => ({
        plan: p ?? null,
        profile: profile ?? null,
      })),
    [],
    'loading' as const,
  );
  const plan = loaded === 'loading' ? 'loading' : loaded.plan;
  // Without a plan, where to go depends on who is signed in (firstRunPath): the start page, its code step, or setup.
  const auth = useAuth();

  useEffect(() => {
    if (plan !== null) return;
    // With no session on the phone the start page needs no wait for supabase-js (review P4): read here, never while
    // rendering, so the page stays static.
    const path = firstRunPathSoon(auth.status, sessionMayBeStored());
    if (path === null) return;
    // The router keeps a page it has left mounted but hidden, so `plan` can still be the null from before
    // setup when the person comes back. Ask the database again before sending them away.
    let cancelled = false;
    db.plan.get('current').then(
      (saved) => {
        if (!cancelled && !saved) router.replace(path);
      },
      (error: unknown) => console.error('StudentsBudget: could not read the saved plan', error),
    );
    return () => {
      cancelled = true;
    };
  }, [plan, auth.status, router]);

  if (loaded === 'loading' || loaded.plan === null) return null;

  return <HomeScreen plan={loaded.plan} profile={loaded.profile} />;
}
