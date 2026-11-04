'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * A 6-digit code: from an authenticator app, or from a sign-up or "Forgot password" email. Up to 9 characters, so the
 * gap an app shows ("123 456") fits; `checkAuthenticatorCode` and `checkEmailCode` drop it. `one-time-code` lets the
 * phone offer a code it just received.
 */
export function CodeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={9}
        className="h-10 w-40"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
