'use client';

import { useId } from 'react';
import { useT } from '@/i18n/use-t';
import { PasskeysSection } from './passkeys';
import { TwoStepSection } from './two-step';

/** Settings → Your account → Sign-in and security: passkeys and two-step sign-in, a card each. Only shown signed in. */
export function SignInSecurity() {
  const id = useId();
  const { t } = useT();
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        {t.auth.security.heading}
      </h3>
      <p className="text-muted-foreground">{t.auth.security.intro}</p>
      <PasskeysSection />
      <TwoStepSection />
    </section>
  );
}
