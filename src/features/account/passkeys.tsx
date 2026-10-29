'use client';

import { KeyRoundIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { formatDate, todayIso } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase/client';
import { authErrorMessage, OFFLINE_MESSAGE, passkeyCancelled, passkeyErrorMessage } from './auth-errors';

// Passkeys (P2.3b): a passkey signs in instead of the password, with Face ID, a fingerprint or the phone's PIN. A beta
// in Supabase Auth; the password always stays. A passkey session is like a password one (aal1), so an account with
// two-step sign-in still asks for the authenticator code after it (useAuth, authStateOf).

const OFFLINE = "You're offline. Passkeys need a connection.";

// Whether the browser can use passkeys (WebAuthn) doesn't change while the page is open. The server snapshot is used
// for the server render and for hydration, so they agree; the browser's answer replaces it right after.
const subscribe = () => () => {};
const supportedOnClient = () => typeof window.PublicKeyCredential === 'function';
const supportedOnServer = () => false;

/** True where the browser can use passkeys. */
export function usePasskeySupport(): boolean {
  return useSyncExternalStore(subscribe, supportedOnClient, supportedOnServer);
}

/** "Sign in with a passkey", above the email and password. Shown only where the browser can use passkeys. */
export function PasskeySignIn() {
  const supported = usePasskeySupport();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // As in SignInForm: the message goes when the person leaves the page.
  useEffect(() => () => setError(null), []);

  async function signIn() {
    if (inFlight.current) return;
    setError(null);
    if (!navigator.onLine) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    const supabase = getSupabase();
    if (supabase === null) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPasskey();
      // A closed prompt needs no words. Signed in, useAuth hears it from supabase-js.
      if (signInError && !passkeyCancelled(signInError)) setError(passkeyErrorMessage(signInError));
    } catch (thrown) {
      console.error('StudentsBudget: could not sign in with a passkey', thrown);
      setError(passkeyErrorMessage(thrown));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!supported) return null;
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" className="h-10 self-start px-4" disabled={busy} onClick={() => void signIn()}>
        <KeyRoundIcon aria-hidden="true" />
        Sign in with a passkey
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">Or with your email and password:</p>
    </div>
  );
}

/** A passkey as the account lists it. */
type Passkey = { id: string; friendly_name?: string; created_at: string; last_used_at?: string };

/** The account's timestamp as a local day: "19-10-2026". */
function dayOf(timestamp: string): string {
  return formatDate(todayIso(new Date(timestamp)));
}

function nameOf(passkey: Passkey): string {
  return passkey.friendly_name?.trim() || 'Passkey';
}

/** The control that takes the focus when the list shows again, since the one that had it is gone. */
type FocusTarget = 'add' | `remove:${string}`;

/** Settings → Your account → Passkeys: add one, see them, remove one. Only shown signed in. */
export function PasskeysSection() {
  const id = useId();
  const supported = usePasskeySupport();
  // 'unknown': the account's passkeys couldn't be read.
  const [passkeys, setPasskeys] = useState<Passkey[] | 'loading' | 'unknown'>('loading');
  // The passkey whose removal waits for "Remove" in its question.
  const [removing, setRemoving] = useState<Passkey | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Said out loud by a screen reader when it changes.
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // Counts "Try again" taps: each one reads the account's passkeys once more.
  const [attempt, setAttempt] = useState(0);
  const focusNext = useRef<FocusTarget | null>(null);

  // Read when the page shows, and again when it shows after being hidden: another phone may have added or removed one.
  useEffect(() => {
    let current = true;
    const supabase = getSupabase();
    if (supabase === null) return;
    void supabase.auth.passkey.list().then(({ data, error: listError }) => {
      if (!current) return;
      if (listError || data === null) {
        setError(passkeyErrorMessage(listError));
        setPasskeys('unknown');
        return;
      }
      setPasskeys(data);
    });
    return () => {
      current = false;
      setRemoving(null);
      setError(null);
      setStatus('');
    };
  }, [attempt]);

  /** A ref that focuses its element when it is the one the last step named. */
  const focusIf = (target: FocusTarget) => (element: HTMLElement | null) => {
    if (element !== null && focusNext.current === target) {
      focusNext.current = null;
      element.focus();
    }
  };

  function checkAgain() {
    setError(null);
    setPasskeys('loading');
    setAttempt((count) => count + 1);
  }

  /** Runs one step against the account, one at a time, with the offline check and the calm error texts. */
  async function run(step: (supabase: NonNullable<ReturnType<typeof getSupabase>>) => Promise<void>) {
    if (inFlight.current) return;
    setError(null);
    setStatus('');
    if (!navigator.onLine) {
      setError(OFFLINE);
      return;
    }
    const supabase = getSupabase();
    if (supabase === null) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await step(supabase);
    } catch (thrown) {
      console.error('StudentsBudget: passkeys', thrown);
      setError(passkeyErrorMessage(thrown));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const add = () =>
    run(async (supabase) => {
      const { data, error: addError } = await supabase.auth.registerPasskey();
      if (addError) {
        if (!passkeyCancelled(addError)) setError(passkeyErrorMessage(addError));
        return;
      }
      focusNext.current = 'add';
      setPasskeys((shown) => [...(Array.isArray(shown) ? shown : []), data]);
      setStatus('Passkey added.');
    });

  const remove = (passkey: Passkey) =>
    run(async (supabase) => {
      const { error: removeError } = await supabase.auth.passkey.delete({ passkeyId: passkey.id });
      if (removeError) {
        setError(authErrorMessage(removeError));
        return;
      }
      focusNext.current = 'add';
      setRemoving(null);
      setPasskeys((shown) => (Array.isArray(shown) ? shown.filter((p) => p.id !== passkey.id) : shown));
      setStatus('Passkey removed.');
    });

  function cancelRemoval(passkey: Passkey) {
    focusNext.current = `remove:${passkey.id}`;
    setRemoving(null);
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Passkeys
      </h3>
      <p className="text-muted-foreground">
        Sign in with Face ID, a fingerprint or your phone&apos;s PIN instead of your password. The passkey stays on your
        device: your account keeps only a public key, which can&apos;t sign in by itself.
      </p>

      {passkeys === 'loading' && <p className="text-muted-foreground">Checking your passkeys…</p>}

      {passkeys === 'unknown' && (
        <>
          <p className="text-muted-foreground">Couldn&apos;t load your passkeys.</p>
          <Button type="button" variant="outline" className="h-10 self-start px-4" onClick={checkAgain}>
            Try again
          </Button>
        </>
      )}

      {Array.isArray(passkeys) && passkeys.length > 0 && (
        <ul className="flex flex-col gap-2">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex flex-col gap-3 rounded-lg border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{nameOf(passkey)}</p>
                  <p className="text-sm text-muted-foreground">
                    {`Added ${dayOf(passkey.created_at)}`}
                    {passkey.last_used_at ? `, last used ${dayOf(passkey.last_used_at)}` : ''}
                  </p>
                </div>
                {removing?.id !== passkey.id && (
                  <Button
                    ref={focusIf(`remove:${passkey.id}`)}
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0 px-4"
                    aria-label={`Remove ${nameOf(passkey)}, added ${dayOf(passkey.created_at)}`}
                    disabled={busy}
                    onClick={() => setRemoving(passkey)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              {removing?.id === passkey.id && (
                <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
                  <p id={`${id}-question`} className="text-sm">
                    Remove this passkey? It no longer signs you in; your password, and any other passkey, still do.
                    You can then delete it from your device too.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {/* Focused when the question opens, and described by it, so a screen reader reads the question out. */}
                    <Button
                      type="button"
                      className="h-10 px-4"
                      autoFocus
                      disabled={busy}
                      aria-describedby={`${id}-question`}
                      onClick={() => void remove(passkey)}
                    >
                      Remove
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 px-4"
                      disabled={busy}
                      onClick={() => cancelRemoval(passkey)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {Array.isArray(passkeys) &&
        (supported ? (
          <Button
            ref={focusIf('add')}
            type="button"
            variant="outline"
            className="h-10 self-start px-4"
            disabled={busy}
            onClick={() => void add()}
          >
            <KeyRoundIcon aria-hidden="true" />
            Add a passkey
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">This browser can&apos;t make passkeys.</p>
        ))}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {/* Always rendered, so a screen reader is already listening when the text appears. */}
      <p role="status" className="sr-only">
        {status}
      </p>
    </section>
  );
}
