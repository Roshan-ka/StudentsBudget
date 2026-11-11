'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { translateUrl } from '@/features/hacks/feed';
import { postingNameText } from '@/features/hacks/posting-name';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { hostOf } from '@/features/setup/steps/range-source';
import type { Language } from '@/i18n/languages';
import type { Messages } from '@/i18n/messages';
import { formatDate } from '@/lib/dates';
import { useFocusAfter } from '@/lib/focus';
import { getSupabase } from '@/lib/supabase/client';
import { deleteStudentDiscount, reportStudentDiscount, type StudentDiscount } from './student-discounts';

/**
 * Where a student's discount comes from, collapsed as any source is (`RangeSource`): who added it and when, that the
 * app never checked it, and the page the student gave. It shows no "checked" date, since nobody checked it.
 */
export function StudentDiscountSource({ item, t }: { item: StudentDiscount; t: Messages }) {
  const { discount, info } = item;
  const name = info.author === null ? t.tips.hacks.noName : postingNameText(info.author, t.auth.postingName);
  return (
    <details className="text-xs text-muted-foreground">
      <summary
        aria-label={t.common.source.of(discount.place)}
        className="w-fit cursor-pointer py-3.5 text-[13px] font-semibold text-primary underline underline-offset-4"
      >
        {t.common.source.label}
      </summary>
      <div className="mb-3.5 flex flex-col gap-1">
        <p className="break-words">{t.tips.studentDiscounts.source(name, formatDate(discount.checked))}</p>
        <a href={discount.url} target="_blank" rel="noopener noreferrer" className="w-fit break-all underline">
          {hostOf(discount.url)}
        </a>
      </div>
    </details>
  );
}

/**
 * What a student's discount has that the app's own don't (community, chunk 5): Translate when it is in another
 * language than the phone's, Delete for one's own and Report for someone else's, each after a question. The first
 * report on a phone waits for the `hackVotes` note, as on a post; the first translation for the `translate` note.
 */
export function StudentDiscountActions({
  item,
  t,
  lang,
  onChanged,
}: {
  item: StudentDiscount;
  t: Messages;
  lang: Language;
  /** After a delete or a report: what a screen reader hears; the list then loads again. */
  onChanged: (said: string) => void;
}) {
  const hacks = t.tips.hacks;
  const text = t.tips.studentDiscounts;
  const { discount, info } = item;
  const which = text.which(discount.place);
  const words = [discount.place, discount.offer, discount.conditions].filter((part) => part !== '').join('\n');
  const translation = info.lang === lang ? null : translateUrl(words, lang);
  const focus = useFocusAfter();
  const [asking, setAsking] = useState(false);
  const [reportNote, setReportNote] = useState(false);
  const [translateNote, setTranslateNote] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    const supabase = getSupabase();
    if (supabase === null) return;
    setBusy(true);
    const result = await deleteStudentDiscount(supabase, discount.id);
    setBusy(false);
    setAsking(false);
    if (result === 'deleted') onChanged(text.deleted);
    else setProblem(text.deleteFailed);
  }

  async function confirmReport() {
    setReportNote(false);
    const supabase = getSupabase();
    if (supabase === null) return;
    setBusy(true);
    const result = await reportStudentDiscount(supabase, discount.id);
    setBusy(false);
    setAsking(false);
    if (result === 'failed') setProblem(text.reportFailed);
    else onChanged(result === 'gone' ? text.gone : text.reported);
  }

  function cancel() {
    focus.mark('action');
    setAsking(false);
    setReportNote(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {translation !== null && (
          <a
            href={translation}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
            onClick={(event) => {
              if (noteSeen('translate')) return;
              event.preventDefault();
              setTranslateNote(true);
            }}
            aria-label={hacks.named(hacks.translate, which)}
          >
            {hacks.translate}
          </a>
        )}
        {!asking && (
          <Button
            ref={focus.refFor('action')}
            type="button"
            variant="ghost"
            className="px-3"
            disabled={busy}
            aria-label={hacks.named(info.mine ? hacks.delete : hacks.report, which)}
            onClick={() => {
              setProblem(null);
              setAsking(true);
            }}
          >
            {info.mine ? hacks.delete : hacks.report}
          </Button>
        )}
      </div>
      {translation !== null && translateNote && (
        <PrivacyNote
          id="translate"
          label={t.common.privacy.label}
          text={t.common.privacy.translate}
          continueLabel={t.common.privacy.continue}
          cancelLabel={t.common.privacy.cancel}
          onContinue={() => {
            setTranslateNote(false);
            // From the same tap, so the browser lets the tab open.
            window.open(translation, '_blank', 'noopener,noreferrer');
          }}
          onCancel={() => setTranslateNote(false)}
        />
      )}
      {asking && !reportNote && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
          <p className="text-sm">{info.mine ? text.deleteQuestion : text.reportQuestion}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="px-4"
              autoFocus
              disabled={busy}
              onClick={() => {
                if (info.mine) void confirmDelete();
                else if (noteSeen('hackVotes')) void confirmReport();
                else setReportNote(true);
              }}
            >
              {info.mine ? hacks.delete : hacks.report}
            </Button>
            <Button type="button" variant="outline" className="px-4" disabled={busy} onClick={cancel}>
              {info.mine ? hacks.keep : hacks.reportCancel}
            </Button>
          </div>
        </div>
      )}
      {reportNote && (
        <PrivacyNote
          id="hackVotes"
          label={t.common.privacy.label}
          text={t.common.privacy.hackVotes}
          continueLabel={t.common.privacy.continue}
          cancelLabel={t.common.privacy.cancel}
          onContinue={() => void confirmReport()}
          onCancel={cancel}
        />
      )}
      {problem !== null && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
    </div>
  );
}
