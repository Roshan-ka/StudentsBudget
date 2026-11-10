'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { CHECKLIST, CHECKLIST_GROUPS, type ChecklistItem } from '@/data/checklist';
import { db } from '@/db/db';
import type { ChecklistTick } from '@/db/types';
import { RangeSource } from '@/features/setup/steps/range-source';
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
      {CHECKLIST_GROUPS.map((group) => (
        <section key={group} aria-labelledby={`checklist-${group}`} className="flex flex-col gap-3">
          <h3 id={`checklist-${group}`} className="text-lg font-extrabold">
            {text.groups[group]}
          </h3>
          <ul aria-labelledby={`checklist-${group}`} className="flex flex-col gap-3">
            {CHECKLIST.filter((item) => item.group === group).map((item) => {
              const words = checklistIn(item, lang);
              const tick = tickOf(item.id);
              return (
                <li key={item.id} className={cn(cardVariants(), 'gap-2 pb-0')}>
                  <span className="inline-flex w-fit items-center rounded-full border-[1.5px] border-outline bg-muted px-2.5 py-0.5 text-xs font-semibold">
                    {text.who[item.who]}
                  </span>
                  <div lang={words.textLang} className="flex flex-col gap-1">
                    <h4 className="text-xl leading-snug font-extrabold">{words.title}</h4>
                    <p className="text-sm text-muted-foreground">{words.body}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
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
                      {tick === undefined ? text.mark : text.doneOn(formatDate(tick.on))}
                    </label>
                    {item.tipId !== undefined && (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        aria-label={text.seeTipNamed(words.title)}
                        onClick={() => {
                          if (item.tipId !== undefined) onSeeTip(item.tipId);
                        }}
                      >
                        {text.seeTip}
                      </Button>
                    )}
                  </div>
                  {failed === item.id && (
                    <p id={`checklist-${item.id}-failed`} role="alert" className="text-sm font-medium">
                      {text.saveFailed}
                    </p>
                  )}
                  <RangeSource range={words} about={words.title} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
