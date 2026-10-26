'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { exportAll } from '@/db/bulk';
import { db } from '@/db/db';
import { getSupabase } from '@/lib/supabase/client';
import { supabaseStore } from '@/sync/store';
import { applyUpload, planUpload, saveErrorMessage, staleSummary, uploadSummary, type UploadPlan } from '@/sync/upload';

/** A save waiting for "Save anyway": what would go from the account, and the save itself. */
type Pending = { plan: UploadPlan; stale: string };

/**
 * "Save to my account": the account's copy becomes exactly this phone's data. When that would delete rows the account
 * has and this phone does not (saved from another phone, or deleted here since), it says how many and asks first.
 */
export function SaveToAccount() {
  // 'loading' (no answer yet) and null (no plan) differ: without a plan there is nothing worth saving yet.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A ref, because a second tap can arrive before React has rendered the disabled button.
  const inFlight = useRef(false);

  // The router keeps this page mounted but hidden after the person leaves: a question or a result left here would be
  // stale on the next visit.
  useEffect(
    () => () => {
      setPending(null);
      setMessage(null);
      setError(null);
    },
    [],
  );

  async function runOnce(task: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await task();
    } catch (thrown) {
      console.error('StudentsBudget: could not save to the account', thrown);
      setPending(null);
      setError(saveErrorMessage(thrown));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function save() {
    void runOnce(async () => {
      if (!navigator.onLine) {
        setError("You're offline. Saving needs a connection.");
        return;
      }
      const supabase = getSupabase();
      if (supabase === null) return;
      const store = supabaseStore(supabase);
      // One snapshot of every table, so the account gets a consistent copy.
      const upload = await planUpload(store, await exportAll());
      const stale = staleSummary(upload);
      if (stale !== null) {
        setPending({ plan: upload, stale });
        return;
      }
      await applyUpload(store, upload);
      setMessage(uploadSummary(upload));
    });
  }

  function saveAnyway(waiting: Pending) {
    void runOnce(async () => {
      const supabase = getSupabase();
      if (supabase === null) return;
      await applyUpload(supabaseStore(supabase), waiting.plan);
      setPending(null);
      setMessage(uploadSummary(waiting.plan));
    });
  }

  if (plan === 'loading') return null;

  return (
    <section aria-labelledby="save-heading" className="flex flex-col gap-3">
      <h3 id="save-heading" className="text-lg font-semibold">
        Save to your account
      </h3>
      {plan === null ? (
        <p className="text-muted-foreground">Set up your plan on this phone first; then you can save it here.</p>
      ) : (
        <>
          <p className="text-muted-foreground">
            Your account then holds a copy of everything on this phone. It doesn&apos;t update by itself yet: save again
            after changes.
          </p>
          {pending === null ? (
            <Button type="button" className="h-10 self-start px-4" disabled={busy} onClick={save}>
              Save to my account
            </Button>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
              <p className="text-sm">
                {`Your account has ${pending.stale} that this phone doesn't. Saving makes your account match this phone, so they go.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="h-10 px-4" disabled={busy} onClick={() => saveAnyway(pending)}>
                  Save anyway
                </Button>
                <Button type="button" variant="outline" className="h-10 px-4" disabled={busy} onClick={() => setPending(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {/* Always rendered, so a screen reader is already listening when the text appears. */}
      <p aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
        {message ?? ''}
      </p>
    </section>
  );
}
