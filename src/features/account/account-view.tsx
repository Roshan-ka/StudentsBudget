'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useShowInstallHint } from '@/features/setup/install-hint';
import { getSupabase } from '@/lib/supabase/client';
import { AccountData } from './account-data';
import { authErrorMessage, OFFLINE_MESSAGE } from './auth-errors';
import { checkAuthenticatorCode, checkCredentials, MIN_PASSWORD_LENGTH, type AuthMode } from './credentials';
import { useAuth } from './use-auth';

/** Email and password, to sign in or to create an account. */
function SignInForm() {
  const id = useId();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // True from the first tap until the answer is in. A ref, because a second tap can arrive before React has rendered
  // the disabled button.
  const inFlight = useRef(false);
  const showIosHint = useShowInstallHint();
  const creating = mode === 'create';

  // The router keeps this page mounted but hidden after the person leaves and runs the effect cleanups: the password
  // and the messages go then, so none of them waits on the page for the next visit. The email stays.
  useEffect(
    () => () => {
      setPassword('');
      setError(null);
      setNotice(null);
    },
    [],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    setNotice(null);
    const checked = checkCredentials(email, password, mode);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    if (!navigator.onLine) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    const supabase = getSupabase();
    if (supabase === null) return;

    inFlight.current = true;
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: checked.email, password });
        if (signInError) {
          setError(authErrorMessage(signInError));
          return;
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: checked.email, password });
        if (signUpError) {
          setError(authErrorMessage(signUpError));
          return;
        }
        // Only when the project asks new accounts to confirm their email: there is no session until then.
        if (data.session === null) {
          setMode('sign-in');
          setNotice('Account created. Open the confirmation email, then sign in here.');
        }
      }
      // Signed in: useAuth hears it from supabase-js, and the page shows the signed-in panel instead of this form.
      setPassword('');
    } catch (thrown) {
      console.error('StudentsBudget: could not sign in', thrown);
      setError(authErrorMessage(thrown));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        {creating ? 'Create an account' : 'Sign in'}
      </h3>
      <p className="text-muted-foreground">Optional. Without an account, everything stays on this phone.</p>
      {showIosHint && (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm">
          On iPhone, sign in inside the Home Screen app: Safari and the app keep separate data and sign-ins.
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-email`}>Email</Label>
          <Input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            className="h-10"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-password`}>Password</Label>
          <Input
            id={`${id}-password`}
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            className="h-10"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {creating && (
            <p className="text-sm text-muted-foreground">{`At least ${MIN_PASSWORD_LENGTH} characters.`}</p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-10 self-start px-4" disabled={busy}>
          {creating ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      {/* Always rendered, so a screen reader is already listening when the text appears. */}
      <p aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
        {notice ?? ''}
      </p>
      <Button
        type="button"
        variant="link"
        className="h-10 self-start px-0"
        onClick={() => {
          setMode(creating ? 'sign-in' : 'create');
          setError(null);
          setNotice(null);
        }}
      >
        {creating ? 'Have an account? Sign in' : 'New here? Create an account'}
      </Button>
    </section>
  );
}

/**
 * The second step of signing in, for an account with two-step sign-in: the code from its authenticator app. Until it
 * is given, the account shows this session nothing, so Save and Load wait. A different account is a sign-out away.
 */
function SecondStepForm({ email, factorId }: { email: string; factorId: string }) {
  const id = useId();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // As in SignInForm: the code and the message go when the person leaves the page.
  useEffect(
    () => () => {
      setCode('');
      setError(null);
    },
    [],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    const checked = checkAuthenticatorCode(code);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    if (!navigator.onLine) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    const supabase = getSupabase();
    if (supabase === null) return;

    inFlight.current = true;
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: checked.code });
      if (verifyError) {
        setError(authErrorMessage(verifyError));
        return;
      }
      // Verified: supabase-js swaps in a session that gave the code, and useAuth shows the signed-in panel.
      setCode('');
    } catch (thrown) {
      console.error('StudentsBudget: could not check the authenticator code', thrown);
      setError(authErrorMessage(thrown));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function signOutToSwitch() {
    const supabase = getSupabase();
    if (supabase === null) return;
    // Local only: what matters is that this phone forgets the half-finished sign-in.
    await supabase.auth.signOut({ scope: 'local' }).catch((thrown: unknown) => {
      console.error('StudentsBudget: could not sign out', thrown);
    });
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Two-step sign-in
      </h3>
      <p className="break-words">
        Enter the code from your authenticator app for <span className="font-medium">{email}</span>.
      </p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
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
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-10 self-start px-4" disabled={busy}>
          Continue
        </Button>
      </form>
      <Button type="button" variant="link" className="h-10 self-start px-0" onClick={() => void signOutToSwitch()}>
        Use a different account
      </Button>
    </section>
  );
}

/** Who is signed in, and the way out. Signing out leaves every entry on the phone. */
function SignedInPanel({ email }: { email: string }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleared when the person leaves the page (it stays mounted but hidden), like the form's messages.
  useEffect(() => () => setError(null), []);

  async function signOut() {
    const supabase = getSupabase();
    if (supabase === null) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) {
        // supabase-js drops the session on this phone even when the server can't be told, and useAuth then shows the
        // form. A message is only due if the session is somehow still here.
        const { data } = await supabase.auth.getSession();
        if (data.session !== null) setError(authErrorMessage(signOutError));
      }
    } catch (thrown) {
      console.error('StudentsBudget: could not sign out', thrown);
      setError(authErrorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Signed in
      </h3>
      <p className="break-words">
        Signed in as <span className="font-medium">{email}</span>.
      </p>
      <p className="text-muted-foreground">Signing out keeps your data on this phone.</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-10 self-start px-4"
        disabled={busy}
        onClick={() => void signOut()}
      >
        Sign out
      </Button>
    </section>
  );
}

/**
 * Settings → Your account: the sign-in form, or who is signed in and saving to the account. Without a Supabase project,
 * a line that says so.
 */
export function AccountView() {
  const auth = useAuth();
  switch (auth.status) {
    case 'off':
      return (
        <p className="text-muted-foreground">
          Accounts aren&apos;t set up in this copy of the app. Everything stays on this phone.
        </p>
      );
    case 'loading':
      return <p className="text-muted-foreground">Checking your account…</p>;
    case 'signed-in':
      return (
        <>
          <SignedInPanel email={auth.email} />
          <AccountData />
        </>
      );
    case 'second-step':
      return <SecondStepForm email={auth.email} factorId={auth.factorId} />;
    case 'signed-out':
      return <SignInForm />;
  }
}
