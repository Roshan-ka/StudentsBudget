'use client';

import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { markNoteSeen, type PrivacyNoteId } from './notes';

/**
 * A one-time data-protection note, inline, before a feature's first use: what it sends to whom. Continue remembers it on
 * this phone (`notes.ts`) and goes on; Cancel does nothing. `label` names the group for screen readers.
 */
export function PrivacyNote({
  id,
  label,
  text,
  continueLabel,
  cancelLabel,
  onContinue,
  onCancel,
}: {
  id: PrivacyNoteId;
  label: string;
  text: string;
  continueLabel: string;
  cancelLabel: string;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="group" aria-label={label} className={cn(cardVariants(), 'gap-2 text-sm')}>
      <p>{text}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            markNoteSeen(id);
            onContinue();
          }}
        >
          {continueLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
