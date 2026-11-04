'use client';

import { SmartphoneIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { useT } from '@/i18n/use-t';
import { getSupabase } from '@/lib/supabase/client';
import { authErrorMessage } from './auth-errors';
import { groupedSecret, qrImageSource } from './authenticator';
import { CardHeading, SECURITY_CARD } from './card-heading';
import { CodeField } from './code-field';
import { checkAuthenticatorCode } from './credentials';

/** The name the factor carries in the account (Supabase's list of the user's factors). */
const FACTOR_NAME = 'StudentsBudget';
/** The name of the entry in the authenticator app (the TOTP issuer). Left out, Supabase Auth picks one itself. */
const ISSUER = 'StudentsBudget';

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
  const { t, lang } = useT();
  const text = t.auth.twoStep;
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
        setError(authErrorMessage(listError, lang));
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
  }, [attempt, lang]);

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
      setError(text.offline);
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
      setError(authErrorMessage(thrown, lang));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const turnOn = () =>
    run(async (supabase) => {
      const listed = await supabase.auth.mfa.listFactors();
      if (listed.error) {
        setError(authErrorMessage(listed.error, lang));
        return;
      }
      // Already on, from another tab or phone: nothing to set up.
      const verified = listed.data.totp[0];
      if (verified !== undefined) {
        show({ kind: 'on', factorId: verified.id }, 'turn-off', text.alreadyOn);
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
        setError(authErrorMessage(enrollError, lang));
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
    const checked = checkAuthenticatorCode(code, lang);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    return run(async (supabase) => {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.factorId, code: checked.code });
      if (verifyError?.code === 'mfa_factor_not_found') {
        // Removed meanwhile: a Turn on in another tab or on another phone clears unfinished set-ups.
        show({ kind: 'off' }, 'turn-on');
        setError(text.cancelledElsewhere);
        return;
      }
      if (verifyError) {
        setError(authErrorMessage(verifyError, lang));
        return;
      }
      // Confirmed: this session gave a code, so it keeps the account open.
      setCode('');
      show({ kind: 'on', factorId: setup.factorId }, 'turn-off', text.isOn);
    });
  };

  const cancelSetup = (setup: Setup) =>
    run(async (supabase) => {
      await supabase.auth.mfa.unenroll({ factorId: setup.factorId });
      setCode('');
      show({ kind: 'off' }, 'turn-on', text.setupCancelled);
    });

  const turnOff = (factorId: string) =>
    run(async (supabase) => {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      // Not found: already turned off, in another tab or on another phone.
      if (unenrollError && unenrollError.code !== 'mfa_factor_not_found') {
        setError(authErrorMessage(unenrollError, lang));
        return;
      }
      // A fresh session no longer lists the factor, so this tab stops expecting a code.
      await supabase.auth.refreshSession();
      show({ kind: 'off' }, 'turn-on', text.isOff);
    });

  const isOn = view.kind === 'on' || view.kind === 'confirm-off';
  const badge = isOn
    ? text.badges.on
    : view.kind === 'off'
      ? text.badges.off
      : view.kind === 'setting-up'
        ? text.badges.settingUp
        : undefined;
  return (
    <section aria-labelledby={`${id}-heading`} className={SECURITY_CARD}>
      <CardHeading id={`${id}-heading`} icon={<SmartphoneIcon />} status={badge} active={isOn}>
        {text.heading}
      </CardHeading>

      {view.kind === 'loading' && <p className="text-sm text-muted-foreground">{text.checking}</p>}

      {view.kind === 'unknown' && (
        <>
          <p className="text-sm text-muted-foreground">{text.unknown}</p>
          <Button type="button" variant="outline" className="h-10 self-start px-4" onClick={checkAgain}>
            {text.tryAgain}
          </Button>
        </>
      )}

      {view.kind === 'off' && (
        <>
          <p className="text-sm text-muted-foreground">{text.offIntro}</p>
          <Button
            ref={focusIf('turn-on')}
            type="button"
            variant="outline"
            className="h-10 self-start px-4"
            disabled={busy}
            onClick={() => void turnOn()}
          >
            {text.turnOn}
          </Button>
        </>
      )}

      {view.kind === 'setting-up' && (
        <>
          <p>{text.setupIntro}</p>
          {view.setup.restarted && <p className="text-sm text-muted-foreground">{text.restarted}</p>}
          {/* The app usually runs on the phone that would scan, so the link and the key come first. */}
          <a
            ref={focusIf('link')}
            href={view.setup.uri}
            className={buttonVariants({ variant: 'outline', className: 'h-10 self-start px-4' })}
          >
            {text.openApp}
          </a>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">{text.typeKey}</p>
            <p className="break-all font-mono text-sm">{groupedSecret(view.setup.secret)}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">{text.scan}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the account, not an asset to optimise */}
            <img src={view.setup.qrCode} alt={text.qrAlt} width={176} height={176} className="rounded-lg bg-white p-2" />
          </div>
          <p className="text-sm text-muted-foreground">{text.keepKey}</p>
          <form onSubmit={(event) => void confirm(event, view.setup)} noValidate className="flex flex-col gap-3">
            <CodeField id={`${id}-code`} label={text.code} value={code} onChange={setCode} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="h-10 px-4" disabled={busy}>
                {text.turnOn}
              </Button>
              <Button type="button" variant="outline" className="h-10 px-4" disabled={busy} onClick={() => void cancelSetup(view.setup)}>
                {text.cancel}
              </Button>
            </div>
          </form>
        </>
      )}

      {view.kind === 'on' && (
        <>
          <p className="text-sm text-muted-foreground">{text.onIntro}</p>
          <p className="text-sm text-muted-foreground">{text.lostApp}</p>
          <Button
            ref={focusIf('turn-off')}
            type="button"
            variant="outline"
            className="h-10 self-start px-4"
            disabled={busy}
            onClick={() => setView({ kind: 'confirm-off', factorId: view.factorId })}
          >
            {text.turnOff}
          </Button>
        </>
      )}

      {view.kind === 'confirm-off' && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
          <p id={`${id}-question`} className="text-sm">
            {text.confirmOff}
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
              {text.turnOff}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4"
              disabled={busy}
              onClick={() => show({ kind: 'on', factorId: view.factorId }, 'turn-off')}
            >
              {text.cancel}
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
