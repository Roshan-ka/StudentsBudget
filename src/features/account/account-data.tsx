'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '@/db/db';
import { LoadFromAccount } from './load-from-account';
import { SaveToAccount } from './save-to-account';

/**
 * Saving and loading, signed in. A phone with a plan saves first; a phone without one (a second phone, or a fresh
 * install) is offered the load first, since it has nothing to save yet.
 */
export function AccountData() {
  // 'loading' (no answer yet) and null (no plan) differ: the order depends on the answer.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  // The order is set once per visit, from the first answer: a load that brings a plan must not swap the sections
  // under the person's finger, or move "Loaded …" away from where they tapped.
  const [loadFirst, setLoadFirst] = useState<boolean | null>(null);
  if (plan !== 'loading' && loadFirst === null) setLoadFirst(plan === null);
  // The router keeps the page mounted but hidden after the person leaves: the next visit sets the order again.
  useEffect(() => () => setLoadFirst(null), []);

  if (plan === 'loading' || loadFirst === null) return null;
  const hasPlan = plan !== null;
  const save = <SaveToAccount key="save" hasPlan={hasPlan} />;
  const load = <LoadFromAccount key="load" hasPlan={hasPlan} />;
  return <>{loadFirst ? [load, save] : [save, load]}</>;
}
