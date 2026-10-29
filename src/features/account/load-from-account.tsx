'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { exportAll, replaceAll, type BackupData } from '@/db/bulk';
import { getSupabase } from '@/lib/supabase/client';
import { downloadContents, loadErrorMessage, planDownload } from '@/sync/download';
import { supabaseStore } from '@/sync/store';
import { accountWantsCode } from './code-check';
import { useAccountTask, type Show } from './use-account-task';

/** Loaded and checked, waiting for "Load": the account's data, and what it holds in words. */
type Pending = { data: BackupData; contents: string };

/**
 * "Load from my account": this phone's data becomes the account's. Everything is read and checked before the phone
 * changes, then replaced in one transaction, so a failed or refused load leaves the phone as it was. It always asks
 * first, saying what the account holds. On a phone without a plan this is how a second phone gets its data.
 */
export function LoadFromAccount({ hasPlan }: { hasPlan: boolean }) {
  const id = useId();
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useAccountTask();
  // Set when the question closes, so focus goes back to the button that opened it (see the button's ref).
  const focusLoadButton = useRef(false);

  // Cleared when the person leaves the page, which stays mounted but hidden: the account may change in the meantime.
  useEffect(
    () => () => {
      setPending(null);
      setMessage(null);
      setError(null);
    },
    [],
  );

  function closeQuestion() {
    focusLoadButton.current = true;
    setPending(null);
  }

  function onError(thrown: unknown, show: Show) {
    console.error('StudentsBudget: could not load from the account', thrown);
    show(() => {
      if (pending !== null) closeQuestion();
      setError(loadErrorMessage(thrown));
    });
  }

  function check() {
    setMessage(null);
    setError(null);
    void run(async (show) => {
      if (!navigator.onLine) {
        show(() => setError("You're offline. Loading needs a connection."));
        return;
      }
      const supabase = getSupabase();
      if (supabase === null) return;
      const result = await planDownload(supabaseStore(supabase), await exportAll());
      if (result.kind === 'empty') {
        // Or the account hides its rows until this session gives its code: then the code step takes over instead.
        if (await accountWantsCode(supabase.auth)) return;
        show(() => setMessage('Your account has nothing saved yet.'));
      } else if (result.kind === 'unfinished') {
        show(() =>
          setError(
            "Your account's last save didn't finish, so nothing changed on this phone. Save again from the phone that has your data.",
          ),
        );
      } else if (result.kind === 'invalid') {
        console.error('StudentsBudget: the account holds data the app cannot load:', result.problem);
        show(() => setError("Your account's data couldn't be read, so nothing changed on this phone."));
      } else {
        show(() => setPending({ data: result.data, contents: downloadContents(result.data) }));
      }
    }, onError);
  }

  function load(waiting: Pending) {
    setError(null);
    void run(async (show) => {
      await replaceAll(waiting.data);
      show(() => {
        closeQuestion();
        setMessage(`Loaded from your account: ${waiting.contents}.`);
      });
    }, onError);
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Load from your account
      </h3>
      <p className="text-muted-foreground">
        {hasPlan
          ? "Replaces everything on this phone with what your account holds. Save first if this phone has changes your account doesn't."
          : 'Saved your data from another phone? Load it onto this one.'}
      </p>
      {pending === null ? (
        <Button
          ref={(button: HTMLButtonElement | null) => {
            if (button && focusLoadButton.current) {
              focusLoadButton.current = false;
              button.focus();
            }
          }}
          type="button"
          variant={hasPlan ? 'outline' : 'default'}
          className="h-10 self-start px-4"
          disabled={busy}
          onClick={check}
        >
          Load from my account
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
          <p id={`${id}-question`} className="text-sm">
            {`This replaces the data on this phone with your account's: ${pending.contents}.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Focused when the question opens, and described by it, so a screen reader reads the question out. */}
            <Button
              type="button"
              className="h-10 px-4"
              autoFocus
              aria-describedby={`${id}-question`}
              disabled={busy}
              onClick={() => load(pending)}
            >
              Load
            </Button>
            <Button type="button" variant="outline" className="h-10 px-4" disabled={busy} onClick={closeQuestion}>
              Cancel
            </Button>
          </div>
        </div>
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
