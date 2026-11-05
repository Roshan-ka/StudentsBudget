'use client';

import { Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n/use-t';
import { checkingSupabase, getSupabase } from '@/lib/supabase/client';
import { unlinkPhone } from '@/sync/link';
import { markAccountDeleted } from './account-deleted';
import { authErrorMessage } from './auth-errors';
import { CardHeading, SECURITY_CARD } from './card-heading';
import { CodeField } from './code-field';
import { checkAuthenticatorCode } from './credentials';

/** Whether a session's user has a verified authenticator factor: the second step the app asks for. */
function hasTwoStep(user: { factors?: { factor_type: string; status: string }[] } | undefined): boolean {
  return user?.factors?.some((f) => f.factor_type === 'totp' && f.status === 'verified') ?? false;
}

/**
 * Settings → Your account → Delete my account (P2.5, docs/superpowers/plans/2026-11-04-account-deletion.md). The
 * account and every row it keeps go for good (`delete_my_account()`); this phone's data stays, and the phone unlinks.
 * The password is given again, with the authenticator's code for an account with two-step sign-in, and Backup's word
 * is typed. The check runs on a client of its own (`checkingSupabase`), so this tab's session stays as it is until the
 * account is gone.
 */
export function DeleteAccountCard({ email }: { email: string }) {
  const id = useId();
  const { t, lang } = useT();
  const text = t.auth.deleteAccount;
  const word = t.backup.delete;
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  // From this tab's session; the check corrects it when another phone turned two-step sign-in on since.
  const [twoStep, setTwoStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // In any case: the word is the safeguard, not its capitals.
  const confirmed = typed.trim().toUpperCase() === word.word.toUpperCase();

  useEffect(() => {
    let current = true;
    void getSupabase()
      ?.auth.getSession()
      .then(({ data }) => {
        if (current && hasTwoStep(data.session?.user)) setTwoStep(true);
      });
    return () => {
      current = false;
    };
  }, []);

  // As in the sign-in form: what was typed and the message go when the person leaves the page.
  useEffect(
    () => () => {
      setPassword('');
      setCode('');
      setTyped('');
      setError(null);
    },
    [],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !confirmed) return;
    setError(null);
    if (password === '') {
      setError(t.auth.check.enterPassword);
      return;
    }
    const checkedCode = twoStep ? checkAuthenticatorCode(code, lang) : null;
    if (checkedCode !== null && !checkedCode.ok) {
      setError(checkedCode.error);
      return;
    }
    if (!navigator.onLine) {
      setError(t.auth.offline);
      return;
    }
    const checker = checkingSupabase();
    const supabase = getSupabase();
    if (checker === null || supabase === null) return;

    inFlight.current = true;
    setBusy(true);
    try {
      const signedIn = await checker.auth.signInWithPassword({ email, password });
      if (signedIn.error) {
        setError(authErrorMessage(signedIn.error, lang));
        return;
      }
      const factor = signedIn.data.user?.factors?.find((f) => f.factor_type === 'totp' && f.status === 'verified');
      if (factor !== undefined) {
        if (checkedCode === null) {
          // Two-step sign-in was turned on since this tab last looked: the code is owed too.
          setTwoStep(true);
          setError(text.codeNeeded);
          return;
        }
        if (checkedCode.ok) {
          const verified = await checker.auth.mfa.challengeAndVerify({ factorId: factor.id, code: checkedCode.code });
          if (verified.error) {
            setError(authErrorMessage(verified.error, lang));
            return;
          }
        }
      }
      const deleted = await checker.rpc('delete_my_account');
      if (deleted.error) {
        console.error('StudentsBudget: could not delete the account', deleted.error);
        // 42501: the database wants the authenticator's code first.
        setError(deleted.error.code === '42501' ? text.codeNeeded : text.failed);
        return;
      }
      // Gone: this phone forgets the account, keeps its data, and signs out (the account page then shows the sign-in
      // form, saying the account is deleted).
      await unlinkPhone();
      markAccountDeleted();
      await supabase.auth.signOut({ scope: 'local' }).catch((thrown: unknown) => {
        console.error('StudentsBudget: could not sign out after deleting the account', thrown);
      });
    } catch (thrown) {
      console.error('StudentsBudget: could not delete the account', thrown);
      setError(authErrorMessage(thrown, lang));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className={SECURITY_CARD}>
      <CardHeading id={`${id}-heading`} icon={<Trash2Icon />}>
        {text.heading}
      </CardHeading>
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      <Link href="/settings/backup" className="text-sm font-medium text-primary underline underline-offset-4">
        {text.backup}
      </Link>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-password`}>{text.password}</Label>
          <Input
            id={`${id}-password`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {twoStep && <CodeField id={`${id}-code`} label={text.code} value={code} onChange={setCode} />}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-word`}>{word.typeToConfirm(word.word)}</Label>
          <Input
            id={`${id}-word`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="destructive" className="self-start px-4" disabled={!confirmed || busy}>
          {text.button}
        </Button>
      </form>
      {/* Deleting takes a moment: said, so the disabled button doesn't look stuck. */}
      <p role="status" className="text-sm text-muted-foreground">
        {busy ? text.deleting : null}
      </p>
    </section>
  );
}
