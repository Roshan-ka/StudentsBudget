'use client';

import { ChevronRightIcon } from 'lucide-react';
import { Fragment, useId, useState } from 'react';
import { linkButtonClass } from '@/components/link-button';
import type { Swap } from '@/data/swaps';
import { TIPS } from '@/data/tips';
import { RangeSource } from '@/features/setup/steps/range-source';
import { swapIn, tipIn, type InLanguage } from '@/i18n/city';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { amountText, swapLineParts, type Suggestion } from './suggest';

/**
 * One source block per amount: a swap whose cheaper amount sits on another page says where each one comes from. Both
 * carry the swap's `textLang`, so a source is marked English only while the swap is.
 */
function sourceBlocks(
  swap: InLanguage<Swap>,
  t: Messages,
  locale: string,
): { label: string; range: Pick<InLanguage<Swap>, 'source' | 'url' | 'checked' | 'textLang'> }[] {
  const text = t.tips.swap;
  if (swap.toSource === undefined || swap.toUrl === undefined) {
    return [{ label: text.sources, range: swap }];
  }
  return [
    { label: text.sourceOf(amountText(swap.fromMinor, locale)), range: swap },
    {
      label: text.sourceOf(amountText(swap.toMinor, locale)),
      range: { source: swap.toSource, url: swap.toUrl, checked: swap.checked, textLang: swap.textLang },
    },
  ];
}

/**
 * One calm line under an envelope row: "Try this: … · save about €X per …". Tapping it opens the swap's body, where
 * each of its prices comes from and the tip it is linked to, which carries its own source: every number shown has one.
 * The panel is the card colour, outlined: muted text is above 4.5:1 on it, whether the line sits on the page or on an
 * envelope's tint.
 * The swap's and the tip's own words are city content, in the phone's language where translated (`swapIn`, `tipIn`).
 */
export function SwapLine({ suggestion }: { suggestion: Suggestion }) {
  const panelId = useId();
  const { t, lang, locale } = useT();
  const [open, setOpen] = useState(false);
  const swap = swapIn(suggestion.swap, lang);
  const linked = swap.tipId === undefined ? undefined : TIPS.find((candidate) => candidate.id === swap.tipId);
  const tip = linked === undefined ? undefined : tipIn(linked, lang);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
        // The outlined button with a chevron, as every fold-out (16-11-2026: buttons, never text links): the card
        // colour and the foreground text, on the page or on an envelope's tint. The words start at the chevron.
        className={linkButtonClass('cursor-pointer justify-start text-start text-pretty break-words')}
      >
        <ChevronRightIcon
          aria-hidden="true"
          className={cn('transition-transform rtl:-scale-x-100', open && 'rotate-90 rtl:-rotate-90')}
        />
        {/* One span, so the line wraps as a sentence beside the chevron. A title still in English is marked so,
            inside a line in the phone's language. */}
        <span>
          {swapLineParts(suggestion, lang).map((part, i) => (
            <Fragment key={i}>{part.lang ? <span lang={part.lang}>{part.text}</span> : part.text}</Fragment>
          ))}
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={t.tips.swap.details(swap.title)}
          className="flex flex-col gap-3 rounded-md border-[1.5px] border-outline bg-card px-3 py-3 text-sm"
        >
          <p lang={swap.textLang}>{swap.body}</p>
          {sourceBlocks(swap, t, locale).map(({ label, range }) => (
            <RangeSource key={label} range={range} label={label} />
          ))}
          {tip !== undefined && (
            <div className="flex flex-col gap-1 border-t pt-3">
              <p className="text-xs text-muted-foreground">{t.tips.swap.relatedTip}</p>
              <div lang={tip.textLang} className="flex flex-col gap-1">
                <p className="font-medium">{tip.title}</p>
                <p className="text-muted-foreground">{tip.body}</p>
              </div>
              <RangeSource range={tip} about={tip.title} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
