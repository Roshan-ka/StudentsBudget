'use client';

import { LockIcon } from 'lucide-react';
import { useId } from 'react';
import { categoryTint } from '@/features/charts/colors';
import { useT } from '@/i18n/use-t';
import { CardHeading } from './card-heading';
import { PasswordSection } from './change-password';
import { PasskeysSection } from './passkeys';
import { TwoStepSection } from './two-step';

/**
 * Settings → Your account → Sign-in and security: the password, passkeys and two-step sign-in, a card each, under a
 * heading with its tile (group 4 redesign, 17-11-2026). Only shown signed in.
 */
export function SignInSecurity() {
  const id = useId();
  const { t } = useT();
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <CardHeading id={`${id}-heading`} icon={LockIcon} tint={categoryTint('rent')} level={3}>
        {t.auth.security.heading}
      </CardHeading>
      <p className="text-muted-foreground">{t.auth.security.intro}</p>
      <PasswordSection />
      <PasskeysSection />
      <TwoStepSection />
    </section>
  );
}
