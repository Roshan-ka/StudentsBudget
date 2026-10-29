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
        Your password always works. A passkey signs you in without it, and with two-step sign-in a stolen password
        alone opens nothing.
      </p>
      <PasskeysSection />
      <TwoStepSection />
    </section>
  );
}
