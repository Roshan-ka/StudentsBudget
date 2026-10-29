'use client';

import { useId } from 'react';
import { PasskeysSection } from './passkeys';
import { TwoStepSection } from './two-step';

/** Settings → Your account → Sign-in and security: passkeys and two-step sign-in, a card each. Only shown signed in. */
export function SignInSecurity() {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Sign-in and security
      </h3>
      <p className="text-muted-foreground">
        You can always sign in with your password. A passkey is a quicker way in. With two-step sign-in on, a code from
        your authenticator app follows either, so a stolen password alone opens nothing.
      </p>
      <PasskeysSection />
      <TwoStepSection />
    </section>
  );
}
