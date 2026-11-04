'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useShowInstallHint } from '@/features/setup/install-hint';
import type { Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { getSupabase } from '@/lib/supabase/client';
import { useAccountDeleted } from './account-deleted';
import { AccountLink } from './account-link';
import { authErrorMessage } from './auth-errors';
import { CodeField } from './code-field';
import {
  checkAuthenticatorCode,
  checkCredentials,
  checkEmail,
  checkEmailCode,
  checkNewPassword,
  MIN_PASSWORD_LENGTH,
  type AuthMode,
} from './credentials';
import { DeleteAccountCard } from './delete-account';
import { RECOVERY_CODE, SIGN_UP_CODE } from './email-codes';
import { PasskeySignIn } from './passkeys';
import { finishRecovery, forgetPasswordChanged, useRecovery } from './recovery';
import { SignInSecurity } from './security';
import { syncBeforeSignOut } from './sync-status';
import { useAuth } from './use-auth';

/** Which email a code comes from (P2.4): the sign-up's, or "Forgot password"'s. */
type CodeKind = 'sign-up' | 'recovery';

/**
 * Asks the account server to email a code to `email`: a new sign-up code, or a "Forgot password" one. Null when it
 * went out (for a reset, the server says the same whether or not the email has an account); otherwise the calm text
 * of why not, in `lang`.
 */
async function sendEmailCode(kind: CodeKind, email: string, lang: Language): Promise<string | null> {
  if (!navigator.onLine) return MESSAGES[lang].auth.offline;
  const supabase = getSupabase();
  if (supabase === null) return MESSAGES[lang].auth.errors.general;
  try {
    const { error } =
      kind === 'sign-up'
        ? await supabase.auth.resend({ type: 'signup', email })
        : await supabase.auth.resetPasswordForEmail(email);
    return error ? authErrorMessage(error, lang) : null;
  } catch (thrown) {
    console.error('StudentsBudget: could not send an email code', thrown);
    return authErrorMessage(thrown, lang);
  }
}

/** Signs this phone out of a half-finished sign-in. Local only: what matters is that this phone forgets it. */
async function signOutLocally() {
  const supabase = getSupabase();
  if (supabase === null) return;
  await supabase.auth.signOut({ scope: 'local' }).catch((thrown: unknown) => {
    console.error('StudentsBudget: could not sign out', thrown);
  });
}

/**
 * The code from an email (P2.4): the sign-up's, until which the new account has no session, or "Forgot password"'s,
 * which signs in for a new password. Send a new code asks for another email; Back returns to signing in, with the
 * email kept. `resent` opens it saying a new code is on its way.
 */
function EmailCodeStep({
  kind,
  email,
  resent,
  onBack,
}: {
  kind: CodeKind;
  email: string;
  resent: boolean;
  onBack: () => void;
}) {
  const id = useId();
  const { t, lang } = useT();
  const text = kind === 'sign-up' ? t.auth.confirm : t.auth.reset;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Whether the person has done anything here yet. Until then, a step opened by Send a new code says so. That line is
  // worked out from `resent`, not kept in `notice`: React's development double run calls the cleanup below right after
  // the first mount, which would take it away before anyone saw it.
  const [acted, setActed] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // As in SignInForm: the code and the messages go when the person leaves the page. The step and the email stay, so
  // someone who went to read the email comes back to the code.
  useEffect(
    () => () => {
      setCode('');
      setError(null);
      setNotice(null);
    },
    [],
  );

  /** Runs `task` unless one is running already: a second tap can arrive before React has disabled the buttons. */
  async function runOnce(task: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActed(true);
    setError(null);
    setNotice(null);
    const checked = checkEmailCode(code, lang);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    if (!navigator.onLine) {
      setError(t.auth.offline);
      return;
    }
    const supabase = getSupabase();
    if (supabase === null) return;

    await runOnce(async () => {
      try {
        const type = kind === 'sign-up' ? SIGN_UP_CODE : RECOVERY_CODE;
        const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: checked.code, type });
        if (verifyError) {
          setError(authErrorMessage(verifyError, lang));
          return;
        }
        // Signed in: useAuth hears it from supabase-js. The page then shows the account, or for a reset the
        // authenticator's step (if the account has one) and the new password (`recovery.ts`).
        setCode('');
      } catch (thrown) {
        console.error('StudentsBudget: could not check the emailed code', thrown);
        setError(authErrorMessage(thrown, lang));
      }
    });
  }

  async function onSendAgain() {
    setActed(true);
    setError(null);
    setNotice(null);
    await runOnce(async () => {
      const problem = await sendEmailCode(kind, email, lang);
      if (problem === null) setNotice(text.resent);
      else setError(problem);
    });
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        {text.heading}
      </h3>
      <p className="break-words">
        {text.prompt.before}
        <span className="font-medium">{email}</span>
        {text.prompt.after}
      </p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <CodeField id={`${id}-code`} label={text.code} value={code} onChange={setCode} />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-10 px-4" disabled={busy}>
            {text.confirm}
          </Button>
          <Button type="button" variant="outline" className="h-10 px-4" disabled={busy} onClick={() => void onSendAgain()}>
            {text.sendAgain}
          </Button>
        </div>
      </form>
      {/* Always rendered, so a screen reader is already listening when the text appears. */}
      <p aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
        {notice ?? (resent && !acted ? text.resent : null)}
      </p>
      <Button type="button" variant="link" className="h-10 self-start px-0" onClick={onBack}>
        {text.back}
      </Button>
    </section>
  );
}

/**
 * "Forgot password" (P2.4): the account's email, which gets a 6-digit code. `initialEmail` is what the sign-in form
 * holds; `onSent` opens the code step for the email the code went to.
 */
function ResetEmailStep({
  initialEmail,
  onSent,
  onBack,
}: {
  initialEmail: string;
  onSent: (email: string) => void;
  onBack: () => void;
}) {
  const id = useId();
  const { t, lang } = useT();
  const text = t.auth.reset;
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // As in SignInForm: the message goes when the person leaves the page; the email stays.
  useEffect(() => () => setError(null), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    const checked = checkEmail(email, lang);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const problem = await sendEmailCode('recovery', checked.email, lang);
      if (problem === null) onSent(checked.email);
      else setError(problem);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        {text.heading}
      </h3>
      <p>{text.intro}</p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-email`}>{t.auth.signIn.email}</Label>
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
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-10 self-start px-4" disabled={busy}>
          {text.send}
        </Button>
      </form>
      <Button type="button" variant="link" className="h-10 self-start px-0" onClick={onBack}>
        {text.back}
      </Button>
    </section>
  );
}

/**
 * The last step of "Forgot password" (P2.4): the emailed code signed in (and the authenticator's, for an account with
 * two-step sign-in), and a new password finishes it. Until it is saved, the account panel and linking wait.
 */
function NewPasswordForm({ email }: { email: string }) {
  const id = useId();
  const { t, lang } = useT();
  const text = t.auth.newPassword;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // As in SignInForm: the password and the message go when the person leaves the page.
  useEffect(
    () => () => {
      setPassword('');
      setError(null);
    },
    [],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    const checked = checkNewPassword(password, lang);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    if (!navigator.onLine) {
      setError(t.auth.offline);
      return;
    }
    const supabase = getSupabase();
    if (supabase === null) return;

    inFlight.current = true;
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(authErrorMessage(updateError, lang));
        return;
      }
      setPassword('');
      // The account panel follows, saying the password changed.
      finishRecovery();
    } catch (thrown) {
      console.error('StudentsBudget: could not save the new password', thrown);
      setError(authErrorMessage(thrown, lang));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        {text.heading}
      </h3>
      <p className="break-words">
        {text.prompt.before}
        <span className="font-medium">{email}</span>
        {text.prompt.after}
      </p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-password`}>{text.password}</Label>
          <Input
            id={`${id}-password`}
            type="password"
            autoComplete="new-password"
            className="h-10"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">{t.auth.signIn.minLength(MIN_PASSWORD_LENGTH)}</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-10 self-start px-4" disabled={busy}>
          {text.save}
        </Button>
      </form>
      {/* Signing out ends the reset too (use-auth.ts): the old password, or another code, is the way back in. */}
      <Button type="button" variant="link" className="h-10 self-start px-0" onClick={() => void signOutLocally()}>
        {text.signOut}
      </Button>
    </section>
  );
}

/** Email and password, to sign in or to create an account. */
function SignInForm() {
  const id = useId();
  const { t, lang } = useT();
  const text = t.auth.signIn;
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A step that takes the form's place (P2.4): an emailed code, with whether it opens saying a new one was sent, or
  // the email a "Forgot password" code goes to.
  const [step, setStep] = useState<
    { at: 'code'; kind: CodeKind; email: string; resent: boolean } | { at: 'reset-email' } | null
  >(null);
  // A sign-in found the account not confirmed yet: the form offers a new code for it.
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // True from the first tap until the answer is in. A ref, because a second tap can arrive before React has rendered
  // the disabled button.
  const inFlight = useRef(false);
  const showIosHint = useShowInstallHint();
  const creating = mode === 'create';

  // The router keeps this page mounted but hidden after the person leaves and runs the effect cleanups: the password
  // and the messages go then, so none of them waits on the page for the next visit. The email stays, and so does a
  // step in its place (each clears its own fields).
  useEffect(
    () => () => {
      setPassword('');
      setError(null);
      setNotice(null);
      setUnconfirmed(null);
    },
    [],
  );

  /** For an account a sign-in found unconfirmed: a new code, then the code step. */
  async function sendCodeFor(to: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const problem = await sendEmailCode('sign-up', to, lang);
      if (problem !== null) {
        setError(problem);
        return;
      }
      setUnconfirmed(null);
      setStep({ at: 'code', kind: 'sign-up', email: to, resent: true });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    setNotice(null);
    setUnconfirmed(null);
    const checked = checkCredentials(email, password, mode, lang);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    if (!navigator.onLine) {
      setError(t.auth.offline);
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
          setError(authErrorMessage(signInError, lang));
          if (signInError.code === 'email_not_confirmed') setUnconfirmed(checked.email);
          return;
        }
      } else {
        // The language goes along as user metadata, so the account's emails are written in it.
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: checked.email,
          password,
          options: { data: { lang } },
        });
        if (signUpError) {
          setError(authErrorMessage(signUpError, lang));
          return;
        }
        // Only when the project asks new accounts to confirm their email: there is no session until the emailed code
        // is given.
        if (data.session === null) setStep({ at: 'code', kind: 'sign-up', email: checked.email, resent: false });
      }
      // Signed in: useAuth hears it from supabase-js, and the page shows the signed-in panel instead of this form.
      setPassword('');
    } catch (thrown) {
      console.error('StudentsBudget: could not sign in', thrown);
      setError(authErrorMessage(thrown, lang));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (step?.at === 'code') {
    return (
      <EmailCodeStep
        kind={step.kind}
        email={step.email}
        resent={step.resent}
        onBack={() => {
          setStep(null);
          // The account exists now: back to signing in, with the email kept.
          setMode('sign-in');
        }}
      />
    );
  }
  if (step?.at === 'reset-email') {
    return (
      <ResetEmailStep
        initialEmail={email}
        onSent={(to) => {
          setEmail(to);
          setStep({ at: 'code', kind: 'recovery', email: to, resent: false });
        }}
        onBack={() => setStep(null)}
      />
    );
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        {creating ? text.headingCreate : text.headingSignIn}
      </h3>
      <p className="text-muted-foreground">{text.optional}</p>
      {showIosHint && <p className="rounded-lg bg-muted px-4 py-3 text-sm">{text.iosHint}</p>}
      {/* A passkey belongs to an account that exists, so only when signing in. Its message is the form's: one at a time. */}
      {!creating && (
        <PasskeySignIn
          onStart={() => {
            setError(null);
            setNotice(null);
          }}
          onError={setError}
        />
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-email`}>{text.email}</Label>
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
          <Label htmlFor={`${id}-password`}>{text.password}</Label>
          <Input
            id={`${id}-password`}
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            className="h-10"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {creating ? (
            <p className="text-sm text-muted-foreground">{text.minLength(MIN_PASSWORD_LENGTH)}</p>
          ) : (
            <Button
              type="button"
              variant="link"
              className="h-10 self-start px-0"
              onClick={() => {
                setError(null);
                setNotice(null);
                setUnconfirmed(null);
                setStep({ at: 'reset-email' });
              }}
            >
              {text.forgot}
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {unconfirmed !== null && (
          <Button
            type="button"
            variant="outline"
            className="h-10 self-start px-4"
            disabled={busy}
            onClick={() => void sendCodeFor(unconfirmed)}
          >
            {t.auth.confirm.sendAgain}
          </Button>
        )}
        <Button type="submit" className="h-10 self-start px-4" disabled={busy}>
          {creating ? text.create : text.signIn}
        </Button>
      </form>

      {/* Always rendered, so a screen reader is already listening when the text appears. */}
      <p aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
        {notice}
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
        {creating ? text.toSignIn : text.toCreate}
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
  const { t, lang } = useT();
  const text = t.auth.secondStep;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The account server no longer knows this sign-in: only signing in again helps.
  const [ended, setEnded] = useState(false);
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
    const checked = checkAuthenticatorCode(code, lang);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    if (!navigator.onLine) {
      setError(t.auth.offline);
      return;
    }
    const supabase = getSupabase();
    if (supabase === null) return;

    inFlight.current = true;
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: checked.code });
      if (verifyError?.name === 'AuthSessionMissingError') {
        // The account server ended this half sign-in (finished on another device, say): no code can complete it.
        setEnded(true);
        return;
      }
      if (verifyError) {
        setError(authErrorMessage(verifyError, lang));
        return;
      }
      // Verified: supabase-js swaps in a session that gave the code, and useAuth shows the signed-in panel.
      setCode('');
    } catch (thrown) {
      console.error('StudentsBudget: could not check the authenticator code', thrown);
      setError(authErrorMessage(thrown, lang));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (ended) {
    return (
      <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
        <h3 id={`${id}-heading`} className="text-lg font-semibold">
          {text.heading}
        </h3>
        <p role="alert" className="break-words">
          {text.ended.before}
          <span className="font-medium">{email}</span>
          {text.ended.after}
        </p>
        <Button type="button" className="h-10 self-start px-4" autoFocus onClick={() => void signOutLocally()}>
          {text.signInAgain}
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        {text.heading}
      </h3>
      <p className="break-words">
        {text.prompt.before}
        <span className="font-medium">{email}</span>
        {text.prompt.after}
      </p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <CodeField id={`${id}-code`} label={text.code} value={code} onChange={setCode} />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-10 self-start px-4" disabled={busy}>
          {text.continue}
        </Button>
      </form>
      <Button type="button" variant="link" className="h-10 self-start px-0" onClick={() => void signOutLocally()}>
        {text.otherAccount}
      </Button>
    </section>
  );
}

/** How long the "Password changed" line stays, as quick add's "Saved" line does. */
const PASSWORD_CHANGED_MS = 10_000;

/**
 * Who is signed in, and the way out. Signing out leaves every entry on the phone. `passwordChanged`: a "Forgot
 * password" reset was just finished, which the status line says for a while.
 */
function SignedInPanel({ email, passwordChanged }: { email: string; passwordChanged: boolean }) {
  const id = useId();
  const { t, lang } = useT();
  const text = t.auth.signedIn;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleared when the person leaves the page (it stays mounted but hidden), like the form's messages.
  useEffect(() => () => setError(null), []);

  // A timer, not a cleanup: React's development double run calls cleanups right after the first mount, which would
  // take the line away before anyone saw it.
  useEffect(() => {
    if (!passwordChanged) return;
    const timer = setTimeout(forgetPasswordChanged, PASSWORD_CHANGED_MS);
    return () => clearTimeout(timer);
  }, [passwordChanged]);

  async function signOut() {
    const supabase = getSupabase();
    if (supabase === null) return;
    setBusy(true);
    setError(null);
    try {
      // This phone's last changes go to the account first; the data and the link stay on the phone, and sync pauses.
      await syncBeforeSignOut();
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) {
        // supabase-js drops the session on this phone even when the server can't be told, and useAuth then shows the
        // form. A message is only due if the session is somehow still here.
        const { data } = await supabase.auth.getSession();
        if (data.session !== null) setError(authErrorMessage(signOutError, lang));
      }
    } catch (thrown) {
      console.error('StudentsBudget: could not sign out', thrown);
      setError(authErrorMessage(thrown, lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        {text.heading}
      </h3>
      <p className="break-words">
        {text.as.before}
        <span className="font-medium">{email}</span>
        {text.as.after}
      </p>
      <p className="text-muted-foreground">{text.keeps}</p>
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
        {text.signOut}
      </Button>
      {/* The last sync can take up to 8 seconds (syncBeforeSignOut): said, so the disabled button doesn't look stuck. */}
      <p role="status" className="text-sm text-muted-foreground">
        {busy ? text.syncing : passwordChanged ? text.passwordChanged : null}
      </p>
    </section>
  );
}

/**
 * Settings → Your account: the sign-in form, or who is signed in and saving to the account. Without a Supabase project,
 * a line that says so.
 */
export function AccountView() {
  const { t } = useT();
  const auth = useAuth();
  const recovery = useRecovery();
  const accountDeleted = useAccountDeleted();
  switch (auth.status) {
    case 'off':
      return <p className="text-muted-foreground">{t.auth.view.off}</p>;
    case 'loading':
      return <p className="text-muted-foreground">{t.auth.view.checking}</p>;
    case 'signed-in':
      // Signed in with a "Forgot password" code: the new password comes before the account and linking.
      if (recovery === 'pending') return <NewPasswordForm email={auth.email} />;
      return (
        <>
          <SignedInPanel email={auth.email} passwordChanged={recovery === 'changed'} />
          <AccountLink />
          {/* Last: syncing is what the page is for; passkeys and two-step sign-in are set once. */}
          <SignInSecurity />
          {/* At the very end: deleting the account is the rarest step, and the one that can't be undone. */}
          <DeleteAccountCard email={auth.email} />
        </>
      );
    case 'second-step':
      return <SecondStepForm email={auth.email} factorId={auth.factorId} />;
    case 'signed-out':
      return (
        <>
          {accountDeleted && (
            <p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm">
              {t.auth.deleteAccount.done}
            </p>
          )}
          <SignInForm />
        </>
      );
  }
}
