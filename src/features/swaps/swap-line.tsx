'use client';

import { useId, useState } from 'react';
import { TIPS } from '@/data/tips';
import { RangeSource } from '@/features/setup/steps/range-source';
import { swapLineText, type Suggestion } from './suggest';

/**
 * One calm line under an envelope row: "Try this: … · save about €X per …". Tapping it opens the swap's body, where
 * its prices come from and the tip it is linked to, which carries its own source: every number shown has one.
 */
export function SwapLine({ suggestion }: { suggestion: Suggestion }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const { swap } = suggestion;
  const tip = swap.tipId === undefined ? undefined : TIPS.find((t) => t.id === swap.tipId);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-11 w-fit max-w-full cursor-pointer items-center text-left text-sm break-words text-primary underline underline-offset-4"
      >
        {swapLineText(suggestion)}
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={`${swap.title} details`}
          className="flex flex-col gap-3 rounded-lg bg-muted px-3 py-3 text-sm"
        >
          <p>{swap.body}</p>
          <RangeSource range={swap} />
          {tip !== undefined && (
            <div className="flex flex-col gap-1 border-t pt-3">
              <p className="text-xs text-muted-foreground">Related tip</p>
              <p className="font-medium">{tip.title}</p>
              <p className="text-muted-foreground">{tip.body}</p>
              <RangeSource range={tip} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
