'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabase } from '@/lib/supabase/client';
import { authErrorMessage } from './auth-errors';
import { groupedSecret, qrImageSource } from './authenticator';
import { checkAuthenticatorCode } from './credentials';

/** The name the factor carries in the account (Supabase's list of the user's factors). */
const FACTOR_NAME = 'StudentsBudget';
/** The name of the entry in the authenticator app (the TOTP issuer). Left out, Supabase Auth picks one itself. */
const ISSUER = 'StudentsBudget';

const OFFLINE = "You're offline. Turning two-step sign-in on or off needs a connection.";

/**
 * An authenticator being added: what the app shows to add it, until its first code confirms it. `restarted`: an earlier
 * set-up that was never confirmed was removed first, so its entry in the authenticator app no longer works.
 */
type Setup = { factorId: string; qrCode: string; uri: string; secret: string; restarted: boolean };

type View =
  | { kind: 'loading' }
  // The account's authenticators couldn't be read, so whether it is on is not known.
  | { kind: 'unknown' }
  | { kind: 'off' }
  | { kind: 'setting-up'; setup: Setup }
  | { kind: 'on'; factorId: string }
  | { kind: 'confirm-off'; factorId: string };

/** The control that takes the focus when the next view shows, since the one that had it is gone. */
type FocusTarget = 'turn-on' | 'turn-off' | 'link';

/**
 * Settings → Your account → Two-step sign-in: an authenticator app's 6-digit code after the password. Turning it on
 * adds a TOTP factor and confirms it with its first code; from then on the account answers only a session that gave
 * the code (migration 20261028150013_two_step_sign_in). Only shown signed in.
 */
export function TwoStepSection() {
  const id = useId();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Said out loud by a screen reader when it changes: "on" and "off" otherwise only change the text.
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // Counts "Try again" taps: each one reads the account's authenticators once more.
  const [attempt, setAttempt] = useState(0);
  const focusNext = useRef<FocusTarget | null>(null);

  // Read when the page shows, and again when it shows after being hidden: the router keeps it mounted, and the
  // factors may have changed in the meantime (another tab, another phone).
  useEffect(() => {
    let current = true;
    const supabase = getSupabase();
    if (supabase === null) return;
    void supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (!current) return;
      if (listError || data === null) {
        setError(authErrorMessage(listError));
        setView({ kind: 'unknown' });
        return;
      }
      const verified = data.totp[0];
      setView((shown) => {
        if (verified !== undefined) return { kind: 'on', factorId: verified.id };
        // Back mid set-up: it goes on while its authenticator still waits for its first code.
        const waiting = (id: string) => data.all.some((f) => f.id === id && f.status === 'unverified');
        return shown.kind === 'setting-up' && waiting(shown.setup.factorId) ? shown : { kind: 'off' };
      });
    });
    return () => {
      current = false;
      setCode('');
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

  /** Shows `next`, moves the focus to `focus` in it, and says `said` to a screen reader. */
  function show(next: View, focus: FocusTarget, said = '') {
    focusNext.current = focus;
    setView(next);
    setStatus(said);
  }

  function checkAgain() {
    setError(null);
    setView({ kind: 'loading' });
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
      console.error('StudentsBudget: two-step sign-in', thrown);
      setError(authErrorMessage(thrown));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const turnOn = () =>
    run(async (supabase) => {
      const listed = await supabase.auth.mfa.listFactors();
      if (listed.error) {
        setError(authErrorMessage(listed.error));
        return;
      }
      // Already on, from another tab or phone: nothing to set up.
      const verified = listed.data.totp[0];
      if (verified !== undefined) {
        show({ kind: 'on', factorId: verified.id }, 'turn-off', 'Two-step sign-in is already on.');
        return;
      }
      // A set-up left unfinished (the page closed before its first code) would block the name: it goes first.
      let restarted = false;
      for (const factor of listed.data.all) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
          restarted = true;
        }
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: FACTOR_NAME,
        issuer: ISSUER,
      });
      if (enrollError) {
        setError(authErrorMessage(enrollError));
        return;
      }
      setCode('');
      const setup = {
        factorId: data.id,
        qrCode: qrImageSource(data.totp.qr_code),
        uri: data.totp.uri,
        secret: data.totp.secret,
        restarted,
      };
      show({ kind: 'setting-up', setup }, 'link');
    });

  const confirm = (event: FormEvent<HTMLFormElement>, setup: Setup) => {
    event.preventDefault();
    const checked = checkAuthenticatorCode(code);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    return run(async (supabase) => {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.factorId, code: checked.code });
      if (verifyError?.code === 'mfa_factor_not_found') {
        // Removed meanwhile: a Turn on in another tab or on another phone clears unfinished set-ups.
        show({ kind: 'off' }, 'turn-on');
        setError('This set-up was cancelled, maybe from another phone. Turn on to start again.');
        return;
      }
      if (verifyError) {
        setError(authErrorMessage(verifyError));
        return;
      }
      // Confirmed: this session gave a code, so it keeps the account open.
      setCode('');
      show({ kind: 'on', factorId: setup.factorId }, 'turn-off', 'Two-step sign-in is on.');
    });
  };

  const cancelSetup = (setup: Setup) =>
    run(async (supabase) => {
      await supabase.auth.mfa.unenroll({ factorId: setup.factorId });
      setCode('');
      show({ kind: 'off' }, 'turn-on', 'Set-up cancelled.');
    });

  const turnOff = (factorId: string) =>
    run(async (supabase) => {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      // Not found: already turned off, in another tab or on another phone.
      if (unenrollError && unenrollError.code !== 'mfa_factor_not_found') {
        setError(authErrorMessage(unenrollError));
        return;
      }
      // A fresh session no longer lists the factor, so this tab stops expecting a code.
      await supabase.auth.refreshSession();
      show({ kind: 'off' }, 'turn-on', 'Two-step sign-in is off.');
    });

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Two-step sign-in
      </h3>

      {view.kind === 'loading' && <p className="text-muted-foreground">Checking two-step sign-in…</p>}

      {view.kind === 'unknown' && (
        <>
          <p className="text-muted-foreground">Couldn&apos;t check whether two-step sign-in is on.</p>
          <Button type="button" variant="outline" className="h-10 self-start px-4" onClick={checkAgain}>
            Try again
          </Button>
        </>
      )}

      {view.kind === 'off' && (
        <>
          <p className="text-muted-foreground">
            Off. Turn it on and signing in also asks for a 6-digit code from an authenticator app, such as Google
            Authenticator, Microsoft Authenticator or 2FAS, so your password alone no longer opens your account.
          </p>
          <Button
            ref={focusIf('turn-on')}
            type="button"
            variant="outline"
            className="h-10 self-start px-4"
            disabled={busy}
            onClick={() => void turnOn()}
          >
            Turn on
          </Button>
        </>
      )}

      {view.kind === 'setting-up' && (
        <>
          <p>Add StudentsBudget to your authenticator app, then enter the code it shows.</p>
          {view.setup.restarted && (
            <p className="text-sm text-muted-foreground">
              This starts the set-up again. If your authenticator app already has a StudentsBudget entry from the
              unfinished one, delete it: its codes won&apos;t work.
            </p>
          )}
          {/* The app usually runs on the phone that would scan, so the link and the key come first. */}
          <a
            ref={focusIf('link')}
            href={view.setup.uri}
            className={buttonVariants({ variant: 'outline', className: 'h-10 self-start px-4' })}
          >
            Open in authenticator app
          </a>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Or type this key into the app:</p>
            <p className="break-all font-mono text-sm">{groupedSecret(view.setup.secret)}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Or scan this code from another device:</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the account, not an asset to optimise */}
            <img src={view.setup.qrCode} alt="QR code for the authenticator app" width={176} height={176} className="rounded-lg bg-white p-2" />
          </div>
          <p className="text-sm text-muted-foreground">
            Write the key down and keep it somewhere safe, away from this phone. If you lose your authenticator app,
            typing the key into a new one gives the same codes. The data on this phone stays either way.
          </p>
          <form onSubmit={(event) => void confirm(event, view.setup)} noValidate className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-code`}>6-digit code</Label>
              <Input
                id={`${id}-code`}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={9}
                className="h-10 w-40"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="h-10 px-4" disabled={busy}>
                Turn on
              </Button>
              <Button type="button" variant="outline" className="h-10 px-4" disabled={busy} onClick={() => void cancelSetup(view.setup)}>
                Cancel
              </Button>
            </div>
          </form>
        </>
      )}

      {view.kind === 'on' && (
        <>
          <p className="text-muted-foreground">On: signing in asks for the code from your authenticator app.</p>
          <p className="text-sm text-muted-foreground">
            Lost the app? If you wrote the key down, typing it into a new authenticator app gives the same codes.
          </p>
          <Button
            ref={focusIf('turn-off')}
            type="button"
            variant="outline"
            className="h-10 self-start px-4"
            disabled={busy}
            onClick={() => setView({ kind: 'confirm-off', factorId: view.factorId })}
          >
            Turn off
          </Button>
        </>
      )}

      {view.kind === 'confirm-off' && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
          <p id={`${id}-question`} className="text-sm">
            Turn off two-step sign-in? Your password alone will open your account again. You can then delete the
            StudentsBudget entry from your authenticator app.
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Focused when the question opens, and described by it, so a screen reader reads the question out. */}
            <Button
              type="button"
              className="h-10 px-4"
              autoFocus
              disabled={busy}
              aria-describedby={`${id}-question`}
              onClick={() => void turnOff(view.factorId)}
            >
              Turn off
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4"
              disabled={busy}
              onClick={() => show({ kind: 'on', factorId: view.factorId }, 'turn-off')}
            >
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
      <p role="status" className="sr-only">
        {status}
      </p>
    </section>
  );
}
