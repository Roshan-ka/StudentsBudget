'use client';

import { GUESS_CATEGORIES } from '@/features/entries/categories';
import { useT } from '@/i18n/use-t';
import { amountOf, topicOf, withAmount, type DraftUpdate, type SetupDraft } from '../draft';
import { AmountField } from './amount-field';

export function GuessesStep({ draft, update }: { draft: SetupDraft; update: DraftUpdate }) {
  const { t, lang } = useT();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{t.setup.guesses.intro}</p>
      {GUESS_CATEGORIES.map((c) => (
        <AmountField
          key={c.id}
          label={t.setup.guesses.question(topicOf(c.id, lang))}
          // A blank guess stays unanswered and is not saved: only a typed 0 counts as 0.
          blank="unset"
          value={amountOf(draft.guesses, c.id)}
          onChange={(minor) => update((d) => ({ ...d, guesses: withAmount(d.guesses, c.id, minor) }))}
        />
      ))}
    </div>
  );
}
