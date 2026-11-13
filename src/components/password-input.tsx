'use client';

import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useEffect, useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';

/**
 * A password field with a button at its end that shows or hides what is typed (13-11-2026: fewer mistyped passwords on
 * a phone's keyboard). The button says what a tap does now, "Show password" or "Hide password", so it needs no
 * aria-pressed. Every other prop goes to the field, its label's id and descriptions included.
 */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const { t } = useT();
  const [shown, setShown] = useState(false);
  // A page left for another stays mounted but hidden: back on it, the field hides what it holds again.
  useEffect(() => () => setShown(false), []);
  return (
    <div className="relative">
      <Input {...props} type={shown ? 'text' : 'password'} className={cn('pe-12', className)} />
      <button
        type="button"
        aria-label={shown ? t.auth.signIn.hidePassword : t.auth.signIn.showPassword}
        onClick={() => setShown((now) => !now)}
        className="absolute inset-y-0 end-1 my-auto flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
      >
        {shown ? <EyeOffIcon aria-hidden="true" className="size-5" /> : <EyeIcon aria-hidden="true" className="size-5" />}
      </button>
    </div>
  );
}
