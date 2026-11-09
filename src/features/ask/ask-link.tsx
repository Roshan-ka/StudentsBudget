'use client';

import { ChevronRightIcon, MessageCircleQuestionIcon } from 'lucide-react';
import Link from 'next/link';
import { aiInBuild } from '@/features/ai/switch';
import { useT } from '@/i18n/use-t';

/**
 * The quiet line to Ask, on Home among the check-in and badge lines and on the check-in (the AI phase, chunk 10). Only
 * in a build with the AI features: before go-live there is nothing to show. The page itself says what a guest, an
 * account owing its code or a phone with the AI switched off needs.
 */
export function AskLink() {
  const { t } = useT();
  if (!aiInBuild()) return null;
  return (
    <Link href="/ask" className="flex min-h-11 items-center gap-3 text-sm font-semibold">
      <MessageCircleQuestionIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">{t.ask.link}</span>
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 rtl:rotate-180" />
    </Link>
  );
}
