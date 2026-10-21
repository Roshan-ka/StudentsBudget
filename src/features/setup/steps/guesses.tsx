'use client';

import { GUESS_CATEGORIES } from '@/features/entries/categories';
import { amountOf, withAmount, type DraftUpdate, type SetupDraft } from '../draft';
import { AmountField } from './amount-field';

// "other" reads badly in the question, so it gets a few more words.
const TOPIC: Record<string, string> = { other: 'other things' };

export function GuessesStep({ draft, update }: { draft: SetupDraft; update: DraftUpdate }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Go with your gut, in euros. Enter 0 if you spend nothing on it. Skip any you&apos;re not sure about. Guesses
        are saved once and can&apos;t be changed later.
      </p>
      {GUESS_CATEGORIES.map((c) => (
        <AmountField
          key={c.id}
          label={`What do you think you spend on ${TOPIC[c.id] ?? c.name.toLowerCase()} a month?`}
          // A blank guess stays unanswered and is not saved: only a typed 0 counts as 0.
          blank="unset"
          value={amountOf(draft.guesses, c.id)}
          onChange={(minor) => update((d) => ({ ...d, guesses: withAmount(d.guesses, c.id, minor) }))}
        />
      ))}
    </div>
  );
}
