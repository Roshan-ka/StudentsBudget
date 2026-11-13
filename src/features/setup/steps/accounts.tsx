'use client';

import { BanknoteIcon, LandmarkIcon, PlusIcon, XIcon } from 'lucide-react';
import { useId, type Ref } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Account } from '@/db/types';
import { categoryTint } from '@/features/charts/colors';
import { useT } from '@/i18n/use-t';
import { describedBy } from '@/lib/described-by';
import { CURRENCIES, type CurrencyCode } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { DraftUpdate, SetupDraft } from '../draft';
import { useStepProblems } from '../step-problems';
import { AmountField } from './amount-field';
import { firstField, useFocusAfter } from '@/lib/focus';

type AccountDraft = SetupDraft['accounts'][number];

/** The kind's tile: a bank in blue, cash in green, as in the mockups (13-11-2026). Two category tints, for their colour. */
const KIND_TILE: Record<Account['kind'], { icon: typeof LandmarkIcon; tint: string }> = {
  bank: { icon: LandmarkIcon, tint: categoryTint('rent') },
  cash: { icon: BanknoteIcon, tint: categoryTint('eating-out') },
};

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
  // Every account needs a name: said in the step's problems, which the field points at once they show.
  const problems = useStepProblems();
  const unnamed = problems !== null && account.name.trim() === '';
  const Icon = KIND_TILE[account.kind].icon;

  return (
    // Each account its own card (13-11-2026): the kind's tile, the name and Remove on one line, then the rest.
    <div ref={containerRef} role="group" aria-label={text.account(index + 1)} className={cn(cardVariants(), 'gap-4')}>
      <div className="flex items-end gap-3">
        <span
          aria-hidden="true"
          // Centred on the 50 px name field beside it.
          className="mb-[7px] flex size-9 shrink-0 items-center justify-center rounded-md border-[1.5px] border-outline"
          style={{ backgroundColor: KIND_TILE[account.kind].tint }}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label htmlFor={`${id}-name`}>{text.name}</Label>
          <Input
            id={`${id}-name`}
            value={account.name}
            autoComplete="off"
            aria-invalid={unnamed || undefined}
            aria-describedby={describedBy(unnamed && problems)}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </div>
        {/* An icon, named after its account ("Remove account 2"), as the words were. */}
        <Button
          type="button"
          variant="ghost"
          className="mb-[3px] size-11 shrink-0 px-0"
          aria-label={text.remove(index + 1)}
          onClick={onRemove}
        >
          <XIcon aria-hidden="true" className="size-5" />
        </Button>
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
        layout="row"
        label={text.opening}
        unit={account.currency === 'EUR' ? '€' : account.currency}
        signed
        value={account.openingMinor}
        onChange={(minor) => onChange({ openingMinor: minor ?? 0 })}
      />
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
        className="w-full border-dashed"
        onClick={() =>
          update((d) => ({
            ...d,
            accounts: [...d.accounts, { name: '', kind: 'bank', currency: 'EUR', openingMinor: 0 }],
          }))
        }
      >
        <PlusIcon aria-hidden="true" />
        {t.setup.accounts.add}
      </Button>
    </div>
  );
}
