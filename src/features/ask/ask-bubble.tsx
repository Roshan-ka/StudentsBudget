'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { MessageCircleQuestionIcon, XIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { onNavPage } from '@/components/bottom-nav';
import { Button } from '@/components/ui/button';
import { db } from '@/db/db';
import { aiInBuild } from '@/features/ai/switch';
import { useT } from '@/i18n/use-t';
import { AskView } from './ask-view';

/**
 * Ask as a chat bubble (Roshan, from the mockups, 13-11-2026: "like the McDonald's chatbot"): a round button at the
 * bottom corner, above the navigation, on the navigation's pages and the check-in, that opens Ask as a sheet over the
 * page instead of a page of its own. Only in a build with the AI features, and once there is a plan (the navigation's
 * own rule). `AskView` says what a guest, an account owing its code or a phone with the AI switched off needs.
 *
 * The sheet stays mounted while closed (`keepMounted`), so a conversation is still there when it opens again, in memory
 * only, as before. It is open on the page it was opened on: a link in it (to Your account, say) leads away, and the
 * sheet is closed there. While the bubble shows, `<html>` carries `data-ask-bubble`, so a page's end scrolls clear of
 * it; it hides while the discount map fills the screen (`data-map-open`, set by `DiscountMap`).
 */
export function AskBubble() {
  const { t } = useT();
  const pathname = usePathname();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const shown =
    aiInBuild() && plan !== 'loading' && plan !== null && (onNavPage(pathname) || pathname === '/check-in');

  useEffect(() => {
    if (!shown) return;
    const root = document.documentElement;
    root.dataset.askBubble = '';
    return () => {
      delete root.dataset.askBubble;
    };
  }, [shown]);

  if (!shown) return null;

  return (
    <Dialog.Root open={openOn === pathname} onOpenChange={(open) => setOpenOn(open ? pathname : null)}>
      <Dialog.Trigger
        aria-label={t.ask.link}
        className="fixed end-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full border-[1.5px] border-outline bg-primary text-primary-foreground shadow-offset outline-none focus-visible:ring-3 focus-visible:ring-ring [[data-map-open]_&]:hidden"
      >
        <MessageCircleQuestionIcon aria-hidden="true" className="size-6" />
      </Dialog.Trigger>
      <Dialog.Portal keepMounted>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        {/* A sheet from the bottom on a phone, as the date field's calendar is; a card in the middle from 640 px. It
            opens on the question field where there is one, and closing it hands the focus back to the bubble. */}
        <Dialog.Popup
          ref={popup}
          initialFocus={() => popup.current?.querySelector<HTMLElement>('textarea') ?? true}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[calc(var(--radius)+0.25rem)] border-[1.5px] border-b-0 border-outline bg-background text-foreground outline-none transition-[translate,opacity] duration-200 max-sm:data-[ending-style]:translate-y-full max-sm:data-[starting-style]:translate-y-full motion-reduce:transition-none sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:mx-auto sm:w-[min(32rem,calc(100%-2rem))] sm:-translate-y-1/2 sm:rounded-[calc(var(--radius)+0.25rem)] sm:border-b-[1.5px] sm:data-[ending-style]:opacity-0 sm:data-[starting-style]:opacity-0"
        >
          <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3">
              <Dialog.Title className="min-w-0 flex-1 font-heading text-2xl leading-tight font-extrabold">
                {t.shell.headings.ask}
              </Dialog.Title>
              <Dialog.Close
                render={
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={t.ask.close}
                    className="size-11 shrink-0 rounded-full px-0"
                  />
                }
              >
                <XIcon aria-hidden="true" className="size-5" />
              </Dialog.Close>
            </div>
            <AskView />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
