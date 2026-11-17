'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { LightbulbIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { CHECKLIST, CHECKLIST_GROUPS, type ChecklistItem } from '@/data/checklist';
import { db } from '@/db/db';
import type { ChecklistTick } from '@/db/types';
import { PILL_CLASS } from '@/features/tips/category-pill';
import { SourceLine } from '@/features/tips/source-line';
import { checklistIn } from '@/i18n/city';
import { useT } from '@/i18n/use-t';
import { formatDate, todayIso } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * The Checklist tab (checklist plan, chunk 5, docs/superpowers/plans/2026-11-10-checklist.md): what a student new to
 * Regensburg gets done in the first weeks, then money to claim, each item with who it is for, its source and a tick.
 * A tick is a row in `checklistTicks`, which the account keeps like a discount vote; unticking deletes it. An item
 * that leans on a tip opens it (`onSeeTip`).
 */
export function ChecklistView({ onSeeTip }: { onSeeTip: (tipId: string) => void }) {
  const { t, lang } = useT();
  const text = t.tips.checklist;
  const ticks = useLiveQuery(() => db.checklistTicks.toArray(), []);
  const [failed, setFailed] = useState<string | null>(null);
  // A tap shows at once (on a linked phone the write also goes into the outbox, so the read lags a moment). It holds
  // while the stored tick is still what it was at the tap; once the read brings anything new, our write or another
  // phone's, the read wins.
  const [tapped, setTapped] = useState<ReadonlyMap<string, { row: ChecklistTick | null; before: string }>>(new Map());
  const stored = new Map<string, ChecklistTick>((ticks ?? []).map((tick) => [tick.itemId, tick]));
  const storedKey = (id: string) => stored.get(id)?.on ?? '';
  const tickOf = (id: string): ChecklistTick | undefined => {
    const tap = tapped.get(id);
    if (tap !== undefined && tap.before === storedKey(id)) return tap.row ?? undefined;
    return stored.get(id);
  };
  const count = CHECKLIST.filter((item) => tickOf(item.id) !== undefined).length;

  function setDone(item: ChecklistItem, on: boolean) {
    setFailed(null);
    // Today at the moment of the tap, not of the last render.
    const row: ChecklistTick | null = on ? { itemId: item.id, on: todayIso() } : null;
    const tap = { row, before: storedKey(item.id) };
    setTapped((now) => new Map(now).set(item.id, tap));
    const write: Promise<unknown> = row === null ? db.checklistTicks.delete(item.id) : db.checklistTicks.put(row);
    write.catch((error: unknown) => {
      console.error('StudentsBudget: could not save a checklist tick', error);
      // Back to what is stored, unless a later tap on the item owns it now.
      setTapped((now) => {
        if (now.get(item.id) !== tap) return now;
        const next = new Map(now);
        next.delete(item.id);
        return next;
      });
      setFailed(item.id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {/* Lives with the tab, so a tick's new count is read out. Waits for the ticks, so it never says 0 too soon. */}
      <p role="status" className="text-sm font-semibold">
        {ticks === undefined ? '' : text.progress(count, CHECKLIST.length)}
      </p>
      {CHECKLIST_GROUPS.map((group) => {
        const items = CHECKLIST.filter((item) => item.group === group);
        const done = items.filter((item) => tickOf(item.id) !== undefined).length;
        // Waits for the ticks, as the status line does, so the card never says 0 too soon.
        const groupLine = ticks === undefined ? '' : text.progress(done, items.length);
        const headingId = `checklist-${group}`;
        return (
          <section key={group} aria-labelledby={headingId} className="flex flex-col gap-3">
            {/* The group opens with the accent card (group 3 redesign, 16-11-2026): its name, a bar and its own count. */}
            <div className={cn(cardVariants({ variant: 'accent' }), 'gap-2')}>
              <h3 id={headingId} className="text-lg font-extrabold">
                {text.groups[group]}
              </h3>
              {/* The count is the bar's value text; the line under it is the same words for the eye. */}
              <div
                role="progressbar"
                aria-labelledby={headingId}
                aria-valuemin={0}
                aria-valuemax={items.length}
                aria-valuenow={done}
                aria-valuetext={groupLine === '' ? undefined : groupLine}
                className="h-2.5 overflow-hidden rounded-full bg-track"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${items.length === 0 ? 0 : Math.round((done / items.length) * 100)}%` }}
                />
              </div>
              <p aria-hidden="true" className="text-sm font-semibold tabular-nums">
                {groupLine}
              </p>
            </div>
            <ul aria-labelledby={headingId} className="flex flex-col gap-3">
              {items.map((item) => {
                const words = checklistIn(item, lang);
                const tick = tickOf(item.id);
                return (
                  <li key={item.id} className={cn(cardVariants(), 'flex-row items-start gap-2')}>
                    {/* The real checkbox at the start, in a 44 px tap area, named "Done: <title>". */}
                    <label className="-ms-2.5 -mt-2.5 flex size-11 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        className="size-5 shrink-0 accent-primary"
                        checked={tick !== undefined}
                        disabled={ticks === undefined}
                        aria-label={text.markNamed(words.title)}
                        aria-invalid={failed === item.id || undefined}
                        aria-describedby={failed === item.id ? `checklist-${item.id}-failed` : undefined}
                        onChange={(event) => setDone(item, event.target.checked)}
                      />
                    </label>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <h4 lang={words.textLang} className="font-sans text-base leading-snug font-bold tracking-normal">
                        {words.title}
                      </h4>
                      {/* Who it is for, as a pill like the other lists' tags (review U7), and once ticked, when it was
                          done. Its timing is in its own words, under it. */}
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span className={cn(PILL_CLASS, 'text-foreground')}>{text.who[item.who]}</span>
                        {tick !== undefined && <span>{text.doneOn(formatDate(tick.on))}</span>}
                      </p>
                      <p lang={words.textLang} className="text-sm text-muted-foreground">
                        {words.body}
                      </p>
                      {item.tipId !== undefined && (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 w-fit"
                          aria-label={text.seeTipNamed(words.title)}
                          onClick={() => {
                            if (item.tipId !== undefined) onSeeTip(item.tipId);
                          }}
                        >
                          <LightbulbIcon aria-hidden="true" />
                          {text.seeTip}
                        </Button>
                      )}
                      {failed === item.id && (
                        <p id={`checklist-${item.id}-failed`} role="alert" className="text-sm font-medium">
                          {text.saveFailed}
                        </p>
                      )}
                      <SourceLine
                        url={words.url}
                        source={words.source}
                        sourceLang={words.textLang}
                        after={t.common.source.checked(formatDate(words.checked))}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
