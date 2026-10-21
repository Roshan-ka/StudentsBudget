'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Account } from '@/db/types';
import { CURRENCIES, type CurrencyCode } from '@/lib/money';
import type { DraftUpdate, SetupDraft } from '../draft';
import { AmountField } from './amount-field';

type AccountDraft = SetupDraft['accounts'][number];

function AccountRow({
  account,
  index,
  onChange,
  onRemove,
}: {
  account: AccountDraft;
  index: number;
  onChange: (change: Partial<AccountDraft>) => void;
  onRemove: () => void;
}) {
  const id = useId();

  return (
    <div role="group" aria-label={`Account ${index + 1}`} className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          className="h-10"
          value={account.name}
          autoComplete="off"
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-kind`}>Type</Label>
          <NativeSelect
            id={`${id}-kind`}
            className="w-full"
            value={account.kind}
            onChange={(event) => onChange({ kind: event.target.value as Account['kind'] })}
          >
            <NativeSelectOption value="bank">Bank</NativeSelectOption>
            <NativeSelectOption value="cash">Cash</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-currency`}>Currency</Label>
          <NativeSelect
            id={`${id}-currency`}
            className="w-full"
            value={account.currency}
            onChange={(event) => onChange({ currency: event.target.value as CurrencyCode })}
          >
            {CURRENCIES.map((code) => (
              <NativeSelectOption key={code} value={code}>
                {code}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <AmountField
        label="Opening balance"
        unit={account.currency === 'EUR' ? '€' : account.currency}
        signed
        value={account.openingMinor}
        onChange={(minor) => onChange({ openingMinor: minor ?? 0 })}
      />
      <Button type="button" variant="ghost" className="h-10 self-start px-4" onClick={onRemove}>
        Remove account {index + 1}
      </Button>
    </div>
  );
}

export function AccountsStep({ draft, update }: { draft: SetupDraft; update: DraftUpdate }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Where does your money live? The opening balance is what is in each account today.
      </p>
      {draft.accounts.map((account, index) => (
        <AccountRow
          // The draft key follows the account when a row above is removed, so a field's own state (a waiting Overdrawn
          // tick) stays with its row. The wizard gives every account a key; the index only covers a draft that has none.
          key={account.key ?? index}
          account={account}
          index={index}
          onChange={(change) =>
            update((d) => ({ ...d, accounts: d.accounts.map((a, i) => (i === index ? { ...a, ...change } : a)) }))
          }
          onRemove={() => update((d) => ({ ...d, accounts: d.accounts.filter((_, i) => i !== index) }))}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-10 self-start px-4"
        onClick={() =>
          update((d) => ({
            ...d,
            accounts: [...d.accounts, { name: '', kind: 'bank', currency: 'EUR', openingMinor: 0 }],
          }))
        }
      >
        Add account
      </Button>
    </div>
  );
}
