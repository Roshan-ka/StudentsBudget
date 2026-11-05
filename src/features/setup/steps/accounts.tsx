'use client';

import { useId, type Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Account } from '@/db/types';
import { useT } from '@/i18n/use-t';
import { CURRENCIES, type CurrencyCode } from '@/lib/money';
import type { DraftUpdate, SetupDraft } from '../draft';
import { AmountField } from './amount-field';
import { firstField, useFocusAfter } from '@/lib/focus';

type AccountDraft = SetupDraft['accounts'][number];

function AccountRow({
  account,
  index,
  onChange,
  onRemove,
  containerRef,
}: {
  account: AccountDraft;
  index: number;
  onChange: (change: Partial<AccountDraft>) => void;
  onRemove: () => void;
  /** The row's outer element, for the focus after a row above or below it is removed. */
  containerRef?: Ref<HTMLDivElement>;
}) {
  const id = useId();
  const { t } = useT();
  const text = t.setup.accounts;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={text.account(index + 1)}
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-name`}>{text.name}</Label>
        <Input
          id={`${id}-name`}
          value={account.name}
          autoComplete="off"
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-kind`}>{text.type}</Label>
          <NativeSelect
            id={`${id}-kind`}
            className="w-full"
            value={account.kind}
            onChange={(event) => onChange({ kind: event.target.value as Account['kind'] })}
          >
            <NativeSelectOption value="bank">{text.bank}</NativeSelectOption>
            <NativeSelectOption value="cash">{text.cash}</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-currency`}>{text.currency}</Label>
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
        label={text.opening}
        unit={account.currency === 'EUR' ? '€' : account.currency}
        signed
        value={account.openingMinor}
        onChange={(minor) => onChange({ openingMinor: minor ?? 0 })}
      />
      <Button type="button" variant="ghost" className="self-start px-4" onClick={onRemove}>
        {text.remove(index + 1)}
      </Button>
    </div>
  );
}

export function AccountsStep({ draft, update }: { draft: SetupDraft; update: DraftUpdate }) {
  const { t } = useT();
  // Remove hands the focus to the next row's first field, the one before, or Add (accessibility, chunk 5).
  const focus = useFocusAfter();
  const keyOf = (index: number) => String(draft.accounts[index]?.key ?? index);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{t.setup.accounts.intro}</p>
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
          onRemove={() => {
            const next = draft.accounts[index + 1] ? keyOf(index + 1) : draft.accounts[index - 1] ? keyOf(index - 1) : 'add';
            focus.mark(next);
            update((d) => ({ ...d, accounts: d.accounts.filter((_, i) => i !== index) }));
          }}
          containerRef={(element) => focus.refFor(keyOf(index))(firstField(element))}
        />
      ))}
      <Button
        ref={focus.refFor('add')}
        type="button"
        variant="outline"
        className="self-start px-4"
        onClick={() =>
          update((d) => ({
            ...d,
            accounts: [...d.accounts, { name: '', kind: 'bank', currency: 'EUR', openingMinor: 0 }],
          }))
        }
      >
        {t.setup.accounts.add}
      </Button>
    </div>
  );
}
