'use client';

import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { markNoteSeen, NOTE_SECTIONS, type PrivacyNoteId } from './notes';

/** What a cancelled note gives the focus back to, when the control that opened it is gone: one in its place. */
const CONTROLS = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled])';

/**
 * A one-time data-protection note, inline, before a feature's first use: what it sends to whom. Continue remembers it on
 * this phone (`notes.ts`) and goes on; Cancel does nothing. `label` names the group for screen readers. A link under the
 * text opens the note's section of the privacy notice in a new tab, so a form being filled in stays as it is.
 *
 * It takes the focus as it shows, so a screen reader reads it first (accessibility, chunk 5); Cancel gives the focus
 * back to what opened it, or, when the note took that control's place, to the control that is back in its place.
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
  const { t } = useT();
  const opener = useRef<Element | null>(null);
  // Where the note sits: what comes before it, and its parent. A control that takes its place comes right after.
  const before = useRef<Element | null>(null);
  const parent = useRef<Element | null>(null);
  // Stable, so it runs only as the note shows.
  const takeFocus = useCallback((element: HTMLParagraphElement | null) => {
    const note = element?.parentElement;
    if (element === null || !note) return;
    opener.current = document.activeElement;
    before.current = note.previousElementSibling;
    parent.current = note.parentElement;
    element.focus();
  }, []);

  function cancel() {
    onCancel();
    // After the page has drawn what the note leaves behind.
    requestAnimationFrame(() => {
      const previous = opener.current;
      // Not <body>: WebKit leaves the focus there after a tap on a button.
      if (
        previous instanceof HTMLElement &&
        previous !== document.body &&
        previous.isConnected &&
        previous.getClientRects().length > 0
      ) {
        previous.focus();
        return;
      }
      const inPlace = before.current?.isConnected
        ? before.current.nextElementSibling
        : (parent.current?.firstElementChild ?? null);
      const control = inPlace?.matches(CONTROLS) ? inPlace : inPlace?.querySelector(CONTROLS);
      if (control instanceof HTMLElement) control.focus();
    });
  }

  return (
    <div role="group" aria-label={label} className={cn(cardVariants(), 'gap-2 text-sm')}>
      <p ref={takeFocus} tabIndex={-1} className="outline-none">
        {text}
      </p>
      <p>
        {/* A tap target of its own, 44 px tall like the buttons beside it. */}
        <a
          href={`/privacy#${NOTE_SECTIONS[id]}`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center underline"
        >
          {t.common.privacy.more}
        </a>
      </p>
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
        <Button type="button" variant="ghost" onClick={cancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
