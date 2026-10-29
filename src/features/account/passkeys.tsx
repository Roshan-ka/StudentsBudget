'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { KeyRoundIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime, todayIso } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase/client';
import {
  OFFLINE_MESSAGE,
  passkeyCancelled,
  passkeySettingsMessage,
  passkeySignInMessage,
  passkeysUnavailable,
} from './auth-errors';
import { CardHeading, SECURITY_CARD } from './card-heading';
import { accountWantsCode } from './code-check';

// Passkeys (P2.3b): a passkey signs in instead of the password, with Face ID, a fingerprint or the phone's PIN. A beta
// in Supabase Auth; the password always stays. A passkey session is reported to be aal1, like a password one, so an
// account with two-step sign-in still asks for the authenticator code after it (useAuth, authStateOf).

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

/** A prompt closed without a passkey needs no words, but leaves a trace for whoever looks into "nothing happened". */
function noteClosedPrompt(error: unknown) {
  console.warn('StudentsBudget: the passkey prompt closed without a passkey', error);
}

/**
 * "Sign in with a passkey", above the email and password; shown only where the browser can use passkeys. Its message
 * goes to the form (`onError`), and starting it clears the form's (`onStart`), so the sign-in shows one message.
 */
export function PasskeySignIn({ onStart, onError }: { onStart: () => void; onError: (message: string) => void }) {
  const supported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function signIn() {
    if (inFlight.current) return;
    onStart();
    if (!navigator.onLine) {
      onError(OFFLINE_MESSAGE);
      return;
    }
    const supabase = getSupabase();
    if (supabase === null) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        if (passkeyCancelled(error)) noteClosedPrompt(error);
        else onError(passkeySignInMessage(error));
        return;
      }
      // Signed in, and useAuth heard it. The answer's user may not list the account's authenticators (a beta): a
      // refreshed session does, so an account with two-step sign-in shows the code step rather than an empty account.
      await accountWantsCode(supabase.auth);
    } catch (thrown) {
      console.error('StudentsBudget: could not sign in with a passkey', thrown);
      onError(passkeySignInMessage(thrown));
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
      <p className="text-sm text-muted-foreground">Or with your email and password:</p>
    </div>
  );
}

/** A passkey as the account lists it. */
type Passkey = { id: string; friendly_name?: string; created_at: string; last_used_at?: string };

/** The account's timestamp as a local day, "19-10-2026"; empty for one that isn't a timestamp. */
function dayOf(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : formatDate(todayIso(date));
}

function nameOf(passkey: Passkey): string {
  return passkey.friendly_name?.trim() || 'Passkey';
}

/** "Added 29-10-2026, 14:05": with the time, so two passkeys added the same day can be told apart. */
function addedOf(passkey: Passkey): string {
  return `Added ${formatDateTime(passkey.created_at)}`;
}

/** The control that takes the focus when the list shows again, since the one that had it is gone. */
type FocusTarget = 'add' | `remove:${string}`;

/**
 * Settings → Your account → Sign-in and security → Passkeys: add one, see them, remove one. Only shown signed in.
 * 'unknown': the account's passkeys couldn't be read; 'off': passkeys can't be used here (switched off, wrong site).
 */
export function PasskeysSection() {
  const id = useId();
  const supported = usePasskeySupport();
  const [passkeys, setPasskeys] = useState<Passkey[] | 'loading' | 'unknown' | { off: string }>('loading');
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
        const unavailable = passkeysUnavailable(listError);
        if (unavailable !== null) {
          setPasskeys({ off: unavailable });
          return;
        }
        console.error('StudentsBudget: could not read the passkeys', listError);
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
    focusNext.current = 'add';
    setPasskeys('loading');
    setAttempt((count) => count + 1);
  }

  /** Reads the list again after a change, so the card shows what the account holds; keeps `meanwhile` if it can't. */
  async function reread(supabase: SupabaseClient, meanwhile: (shown: Passkey[]) => Passkey[]) {
    const listed = await supabase.auth.passkey.list();
    setPasskeys((shown) => (listed.data !== null ? listed.data : meanwhile(Array.isArray(shown) ? shown : [])));
  }

  /** Runs one step against the account, one at a time, with the offline check. */
  async function run(step: (supabase: SupabaseClient) => Promise<void>, fallback: string) {
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
      setError(passkeySettingsMessage(thrown, fallback));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const add = () =>
    run(async (supabase) => {
      const { data, error: addError } = await supabase.auth.registerPasskey();
      if (addError) {
        if (passkeyCancelled(addError)) noteClosedPrompt(addError);
        else setError(passkeySettingsMessage(addError, 'Couldn’t add the passkey. Try again.'));
        return;
      }
      await reread(supabase, (shown) => [...shown, data]);
      focusNext.current = 'add';
      setStatus('Passkey added.');
    }, 'Couldn’t add the passkey. Try again.');

  const remove = (passkey: Passkey) =>
    run(async (supabase) => {
      const { error: removeError } = await supabase.auth.passkey.delete({ passkeyId: passkey.id });
      // Not found: already removed, on another phone; the card catches up.
      const gone = removeError !== null && (removeError.status === 404 || removeError.code === 'passkey_not_found');
      if (removeError && !gone) {
        setError(passkeySettingsMessage(removeError, 'Couldn’t remove the passkey. Try again.'));
        return;
      }
      await reread(supabase, (shown) => shown.filter((p) => p.id !== passkey.id));
      focusNext.current = 'add';
      setRemoving(null);
      setStatus('Passkey removed.');
    }, 'Couldn’t remove the passkey. Try again.');

  function cancelRemoval(passkey: Passkey) {
    focusNext.current = `remove:${passkey.id}`;
    setRemoving(null);
  }

  const count = Array.isArray(passkeys) ? passkeys.length : null;
  return (
    <section aria-labelledby={`${id}-heading`} className={SECURITY_CARD}>
      <CardHeading
        id={`${id}-heading`}
        icon={<KeyRoundIcon />}
        status={count === null ? undefined : count === 0 ? 'None yet' : count === 1 ? '1 passkey' : `${count} passkeys`}
      >
        Passkeys
      </CardHeading>
      <p className="text-sm text-muted-foreground">
        Sign in with Face ID, a fingerprint or your phone&apos;s PIN instead of your password. The passkey stays with
        you, on your phone or in your password manager; your account keeps its public key, which can&apos;t sign anyone
        in.
      </p>

      {passkeys === 'loading' && <p className="text-sm text-muted-foreground">Checking your passkeys…</p>}

      {passkeys === 'unknown' && (
        <>
          <p className="text-sm text-muted-foreground">Couldn&apos;t load your passkeys.</p>
          <Button type="button" variant="outline" className="h-10 self-start px-4" onClick={checkAgain}>
            Try again
          </Button>
        </>
      )}

      {typeof passkeys === 'object' && !Array.isArray(passkeys) && (
        <p className="text-sm text-muted-foreground">{passkeys.off}</p>
      )}

      {Array.isArray(passkeys) && passkeys.length > 0 && (
        <ul className="flex flex-col gap-2">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex flex-col gap-3 rounded-lg border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{nameOf(passkey)}</p>
                  <p className="text-sm text-muted-foreground">
                    {addedOf(passkey)}
                    {passkey.last_used_at && dayOf(passkey.last_used_at) ? `; last used ${dayOf(passkey.last_used_at)}` : ''}
                  </p>
                </div>
                {removing?.id !== passkey.id && (
                  <Button
                    ref={focusIf(`remove:${passkey.id}`)}
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0 px-4"
                    aria-label={`Remove ${nameOf(passkey)}, ${addedOf(passkey).toLowerCase()}`}
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
                    Remove this passkey? It will stop signing you in; your password and any other passkey keep
                    working. You can then delete it from your phone or password manager too.
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
