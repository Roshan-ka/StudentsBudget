'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabase } from '@/lib/supabase/client';
import { authErrorMessage, OFFLINE_MESSAGE } from './auth-errors';
import { groupedSecret, qrImageSource } from './authenticator';
import { checkAuthenticatorCode } from './credentials';

/** The name the factor carries in the account, and in the authenticator app's list. */
const FACTOR_NAME = 'StudentsBudget';

/** An authenticator being added: what the app shows to add it, until its first code confirms it. */
type Setup = { factorId: string; qrCode: string; uri: string; secret: string };

type View =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'setting-up'; setup: Setup }
  | { kind: 'on'; factorId: string }
  | { kind: 'confirm-off'; factorId: string };

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
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

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
        setView({ kind: 'off' });
        return;
      }
      const verified = data.totp[0];
      setView(verified === undefined ? { kind: 'off' } : { kind: 'on', factorId: verified.id });
    });
    return () => {
      current = false;
      setCode('');
      setError(null);
    };
  }, []);

  /** Runs one step against the account, one at a time, with the offline check and the calm error texts. */
  async function run(step: (supabase: NonNullable<ReturnType<typeof getSupabase>>) => Promise<void>) {
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
      // A set-up left unfinished (the page closed before its first code) would block the name: it goes first.
      const listed = await supabase.auth.mfa.listFactors();
      for (const factor of listed.data?.all ?? []) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: FACTOR_NAME });
      if (enrollError) {
        setError(authErrorMessage(enrollError));
        return;
      }
      setCode('');
      setView({
        kind: 'setting-up',
        setup: { factorId: data.id, qrCode: qrImageSource(data.totp.qr_code), uri: data.totp.uri, secret: data.totp.secret },
      });
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
      if (verifyError) {
        setError(authErrorMessage(verifyError));
        return;
      }
      // Confirmed: this session gave a code, so it keeps the account open.
      setCode('');
      setView({ kind: 'on', factorId: setup.factorId });
    });
  };

  const cancelSetup = (setup: Setup) =>
    run(async (supabase) => {
      await supabase.auth.mfa.unenroll({ factorId: setup.factorId });
      setCode('');
      setView({ kind: 'off' });
    });

  const turnOff = (factorId: string) =>
    run(async (supabase) => {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) {
        setError(authErrorMessage(unenrollError));
        return;
      }
      // A fresh session no longer lists the factor, so this tab stops expecting a code.
      await supabase.auth.refreshSession();
      setView({ kind: 'off' });
    });

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Two-step sign-in
      </h3>

      {view.kind === 'loading' && <p className="text-muted-foreground">Checking two-step sign-in…</p>}

      {view.kind === 'off' && (
        <>
          <p className="text-muted-foreground">
            Off. Turn it on and signing in also asks for a 6-digit code from an authenticator app, such as Google
            Authenticator, Microsoft Authenticator or 2FAS, so your password alone no longer opens your account.
          </p>
          <Button type="button" variant="outline" className="h-10 self-start px-4" disabled={busy} onClick={() => void turnOn()}>
            Turn on
          </Button>
        </>
      )}

      {view.kind === 'setting-up' && (
        <>
          <p>Add StudentsBudget to your authenticator app, then enter the code it shows.</p>
          {/* The app usually runs on the phone that would scan, so the link and the key come first. */}
          <a href={view.setup.uri} className="self-start font-medium text-primary underline underline-offset-4">
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
            Keep the app. If you lose it, the data on this phone stays, but your account can only be opened again once
            whoever runs this app turns two-step sign-in off for you.
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
          <Button
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
        <>
          <p id={`${id}-question`} className="text-sm">
            Turn off two-step sign-in? Your password alone will open your account again.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-10 px-4"
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
              onClick={() => setView({ kind: 'on', factorId: view.factorId })}
            >
              Cancel
            </Button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
