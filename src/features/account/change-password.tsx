'use client';

import { LockKeyholeIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n/use-t';
import { checkingSupabase, getSupabase } from '@/lib/supabase/client';
import { authErrorMessage } from './auth-errors';
import { asksCurrentPassword, signInMethodsOf } from './auth-state';
import { CardHeading, SECURITY_CARD } from './card-heading';
import { checkNewPassword, MIN_PASSWORD_LENGTH } from './credentials';
import { focusFirstControl, useFocusAfter } from '@/lib/focus';

/**
 * Settings → Your account → Sign-in and security → Password: a new password for the account. The current one is asked
 * when this session signed in with it (`asksCurrentPassword`) and checked on a client of its own
 * (`checkingSupabase`), so this tab's session stays as it is. A session that signed in with a passkey sets a new one
 * without it: the way back in for a forgotten password while no email can be sent.
 */
export function PasswordSection() {
  const id = useId();
  const { t, lang } = useT();
  const text = t.auth.changePassword;
  const [open, setOpen] = useState(false);
  // Who is signed in, and whether this session signed in with the password; read when the form opens.
  const [email, setEmail] = useState('');
  const [asksCurrent, setAsksCurrent] = useState(true);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // As in the sign-in form: what was typed and the messages go when the person leaves the page.
  useEffect(
    () => () => {
      setCurrent('');
      setNext('');
      setError(null);
      setStatus(null);
      setOpen(false);
    },
    [],
  );

  async function openForm() {
    setError(null);
    setStatus(null);
    const session = (await getSupabase()?.auth.getSession())?.data.session ?? null;
    if (session === null) return;
    setEmail(session.user.email ?? '');
    setAsksCurrent(asksCurrentPassword(signInMethodsOf(session.access_token)));
    setOpen(true);
  }

  // The form opens on its first field; closing it, or a saved password, gives the focus back to its button.
  const focus = useFocusAfter();

  function close() {
    focus.mark('open');
    setOpen(false);
    setCurrent('');
    setNext('');
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    if (asksCurrent && current === '') {
      setError(t.auth.check.enterPassword);
      return;
    }
    const fresh = checkNewPassword(next, lang);
    if (!fresh.ok) {
      setError(fresh.error);
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
      if (asksCurrent) {
        const checker = checkingSupabase();
        if (checker === null) return;
        const checked = await checker.auth.signInWithPassword({ email, password: current });
        if (checked.error) {
          setError(checked.error.code === 'invalid_credentials' ? text.wrongCurrent : authErrorMessage(checked.error, lang));
          return;
        }
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(authErrorMessage(updateError, lang));
        return;
      }
      close();
      setStatus(text.changed);
    } catch (thrown) {
      console.error('StudentsBudget: could not change the password', thrown);
      setError(authErrorMessage(thrown, lang));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className={SECURITY_CARD}>
      <CardHeading id={`${id}-heading`} icon={<LockKeyholeIcon />}>
        {text.heading}
      </CardHeading>
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {open ? (
        <form ref={focusFirstControl} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          {asksCurrent && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-current`}>{text.current}</Label>
              <Input
                id={`${id}-current`}
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-next`}>{text.next}</Label>
            <Input
              id={`${id}-next`}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">{t.auth.signIn.minLength(MIN_PASSWORD_LENGTH)}</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="px-4" disabled={busy}>
              {text.save}
            </Button>
            <Button type="button" variant="outline" className="px-4" disabled={busy} onClick={close}>
              {text.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          ref={focus.refFor('open')}
          type="button"
          variant="outline"
          className="self-start px-4"
          onClick={() => void openForm()}
        >
          {text.open}
        </Button>
      )}
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
    </section>
  );
}
