'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { exportAll } from '@/db/bulk';
import { getSupabase } from '@/lib/supabase/client';
import { supabaseStore } from '@/sync/store';
import { applyUpload, planUpload, saveErrorMessage, staleSummary, uploadSummary, type UploadPlan } from '@/sync/upload';
import { useAccountTask, type Show } from './use-account-task';

/** A save waiting for "Save anyway": what would go from the account, and the save itself. */
type Pending = { plan: UploadPlan; stale: string };

/**
 * "Save to my account": the account's copy becomes exactly this phone's data. When that would delete rows the account
 * has and this phone does not (saved from another phone, or deleted here since), it says how many and asks first.
 * Without a plan on the phone there is nothing worth saving yet.
 */
export function SaveToAccount({ hasPlan }: { hasPlan: boolean }) {
  const id = useId();
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useAccountTask();
  // Set when the question closes, so focus goes back to the button that opened it (see the button's ref).
  const focusSaveButton = useRef(false);

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

  function closeQuestion() {
    focusSaveButton.current = true;
    setPending(null);
  }

  function onError(thrown: unknown, show: Show) {
    console.error('StudentsBudget: could not save to the account', thrown);
    show(() => {
      if (pending !== null) closeQuestion();
      setError(saveErrorMessage(thrown));
    });
  }

  function save() {
    setMessage(null);
    setError(null);
    void run(async (show) => {
      if (!navigator.onLine) {
        show(() => setError("You're offline. Saving needs a connection."));
        return;
      }
      const supabase = getSupabase();
      if (supabase === null) return;
      const store = supabaseStore(supabase);
      // One snapshot of every table, so the account gets a consistent copy.
      const upload = await planUpload(store, await exportAll());
      const stale = staleSummary(upload);
      if (stale !== null) {
        show(() => setPending({ plan: upload, stale }));
        return;
      }
      await applyUpload(store, upload);
      show(() => setMessage(uploadSummary(upload)));
    }, onError);
  }

  function saveAnyway(waiting: Pending) {
    setError(null);
    void run(async (show) => {
      const supabase = getSupabase();
      if (supabase === null) return;
      await applyUpload(supabaseStore(supabase), waiting.plan);
      show(() => {
        closeQuestion();
        setMessage(uploadSummary(waiting.plan));
      });
    }, onError);
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Save to your account
      </h3>
      {!hasPlan ? (
        <>
          <p className="text-muted-foreground">Set up your plan on this phone first; then you can save it here.</p>
          <Link href="/setup" className={buttonVariants({ variant: 'outline', className: 'h-10 self-start px-4' })}>
            Set up this phone
          </Link>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">
            Your account then holds a copy of everything on this phone. It doesn&apos;t update by itself yet: save again
            after changes. Using two phones? Load on this one first, or a save from here replaces what the other one
            saved.
          </p>
          {pending === null ? (
            <Button
              ref={(button: HTMLButtonElement | null) => {
                if (button && focusSaveButton.current) {
                  focusSaveButton.current = false;
                  button.focus();
                }
              }}
              type="button"
              className="h-10 self-start px-4"
              disabled={busy}
              onClick={save}
            >
              Save to my account
            </Button>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
              <p id={`${id}-question`} className="text-sm">
                {`Your account has ${pending.stale} that this phone doesn't. Saving makes your account match this phone, so they go.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Focused when the question opens, and described by it, so a screen reader reads the question out. */}
                <Button
                  type="button"
                  className="h-10 px-4"
                  autoFocus
                  aria-describedby={`${id}-question`}
                  disabled={busy}
                  onClick={() => saveAnyway(pending)}
                >
                  Save anyway
                </Button>
                <Button type="button" variant="outline" className="h-10 px-4" disabled={busy} onClick={closeQuestion}>
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
