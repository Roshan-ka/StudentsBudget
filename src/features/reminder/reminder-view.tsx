'use client';

import { BellIcon, CalendarCheckIcon, CloudIcon } from 'lucide-react';
import { useId, useState, useSyncExternalStore } from 'react';
import { LinkButton } from '@/components/link-button';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useAuth } from '@/features/account/use-auth';
import { RowTile } from '@/features/home/row-card';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { useT } from '@/i18n/use-t';
import { useFocusAfter } from '@/lib/focus';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  browserFacts,
  changeReminder,
  phoneTimeZone,
  pushSupport,
  QUARTER_HOURS,
  remindersInBuild,
  turnOffReminder,
  turnOnReminder,
  usePhoneReminder,
  vapidPublicKey,
  type ReminderChoice,
  type SaveResult,
} from './reminder';

const subscribeNever = () => () => {};
// What the browser allows is read on the phone only: the page is prerendered, and the server knows no browser.
const supportOnClient = () => pushSupport(browserFacts());
const supportOnServer = () => null;

/** Monday to Sunday in the language, as the day picker lists them: 2 November 2026 was a Monday. */
function dayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, i) => {
    const name = format.format(new Date(Date.UTC(2026, 10, 2 + i)));
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  });
}

/**
 * Settings → Weekly reminder (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 4): the day and time this
 * phone gets its weekly line, and turning it on or off. Turning it on shows the `reminder` data-protection note the
 * first time, then the browser's permission prompt from the same tap. Where the reminder can't work (no account, the
 * code still owed, a browser without push, an iPhone tab, notifications blocked) the page says why and offers nothing
 * to turn on.
 */
export function ReminderView() {
  const { t, lang, locale } = useT();
  const text = t.reminder;
  const auth = useAuth();
  const stored = usePhoneReminder();
  const support = useSyncExternalStore(subscribeNever, supportOnClient, supportOnServer);
  const id = useId();
  const focus = useFocusAfter();
  // The day and time as picked, before they are saved; null while they are as stored.
  const [draft, setDraft] = useState<ReminderChoice | null>(null);
  const [noting, setNoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const choice = draft ?? { weekday: stored.weekday, time: stored.time };
  const days = dayNames(locale);
  const onText = (c: ReminderChoice) => text.status.on(text.everyDay[c.weekday - 1], c.time);

  function report(result: SaveResult, saved: ReminderChoice) {
    if (result === 'saved') {
      setDraft(null);
      setStatus(onText(saved));
    } else if (result === 'dismissed') setStatus(text.status.dismissed);
    else if (result === 'denied') setStatus(text.denied);
    else if (result === 'not-supported') setStatus(text.status.notSupported);
    else setStatus(text.status.failed);
  }

  // Called from the tap itself (Turn on, or the note's Continue): the permission prompt needs it.
  async function turnOn() {
    const supabase = getSupabase();
    const key = vapidPublicKey();
    if (supabase === null || key === null || busy) return;
    const picked = choice;
    setBusy(true);
    setStatus('');
    const result = await turnOnReminder(supabase, picked, { timeZone: phoneTimeZone(), lang }, key);
    setBusy(false);
    if (result === 'saved') focus.mark('turn-off');
    report(result, picked);
  }

  async function save() {
    const supabase = getSupabase();
    const key = vapidPublicKey();
    if (supabase === null || key === null || busy) return;
    const picked = choice;
    setBusy(true);
    setStatus('');
    report(await changeReminder(supabase, picked, { timeZone: phoneTimeZone(), lang }, key), picked);
    setBusy(false);
  }

  async function turnOff() {
    const supabase = getSupabase();
    if (supabase === null || busy) return;
    setBusy(true);
    setStatus('');
    const result = await turnOffReminder(supabase);
    setBusy(false);
    if (result === 'off') {
      focus.mark('turn-on');
      setDraft(null);
      setStatus(text.status.off);
    } else {
      setStatus(text.status.failed);
    }
  }

  function start() {
    if (noteSeen('reminder')) {
      void turnOn();
    } else {
      setNoting(true);
    }
  }

  const toAccount = (
    <LinkButton href="/settings/account" icon={CloudIcon}>
      {t.common.toAccount}
    </LinkButton>
  );

  let body;
  if (!remindersInBuild()) {
    body = <p className="text-sm">{text.unavailable}</p>;
  } else if (auth.status === 'loading' || support === null) {
    body = <p className="text-sm text-muted-foreground">{text.loading}</p>;
  } else if (auth.status === 'signed-out' || auth.status === 'off') {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm">{text.signedOut}</p>
        {toAccount}
      </div>
    );
  } else if (auth.status === 'second-step') {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm">{t.common.needsCode}</p>
        {toAccount}
      </div>
    );
  } else if (support === 'install-first') {
    body = <p className="text-sm">{text.installFirst}</p>;
  } else if (support === 'no-push') {
    body = <p className="text-sm">{text.noPush}</p>;
  } else if (support === 'denied' && !stored.on) {
    // Right after the prompt was refused, the status line says it already.
    body = status === text.denied ? null : <p className="text-sm">{text.denied}</p>;
  } else {
    const changed = stored.on && (choice.weekday !== stored.weekday || choice.time !== stored.time);
    body = (
      <div className={cn(cardVariants(), 'gap-4')}>
        {support === 'denied' && <p className="text-sm">{text.denied}</p>}
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-day`}>{text.day}</Label>
          <NativeSelect
            id={`${id}-day`}
            className="w-full"
            value={String(choice.weekday)}
            aria-describedby={`${id}-hint`}
            onChange={(event) => setDraft({ ...choice, weekday: Number(event.target.value) })}
          >
            {days.map((name, i) => (
              <NativeSelectOption key={name} value={String(i + 1)}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {text.hint}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-time`}>{text.time}</Label>
          <NativeSelect
            id={`${id}-time`}
            className="w-full"
            value={choice.time}
            onChange={(event) => setDraft({ ...choice, time: event.target.value })}
          >
            {QUARTER_HOURS.map((time) => (
              <NativeSelectOption key={time} value={time}>
                {time}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {noting ? (
          <PrivacyNote
            id="reminder"
            label={t.common.privacy.label}
            text={t.common.privacy.reminder}
            continueLabel={t.common.privacy.continue}
            cancelLabel={t.common.privacy.cancel}
            onContinue={() => {
              setNoting(false);
              focus.mark('turn-on');
              void turnOn();
            }}
            onCancel={() => setNoting(false)}
          />
        ) : stored.on ? (
          <div className="flex flex-wrap gap-2">
            {support === 'ok' && (
              <Button type="button" size="lg" onClick={() => void save()} disabled={!changed}>
                {text.save}
              </Button>
            )}
            <Button
              ref={focus.refFor('turn-off')}
              type="button"
              size="lg"
              variant="outline"
              aria-disabled={busy}
              onClick={() => void turnOff()}
            >
              {text.turnOff}
            </Button>
          </div>
        ) : (
          <Button
            ref={focus.refFor('turn-on')}
            type="button"
            size="lg"
            className="self-start"
            aria-disabled={busy}
            onClick={start}
          >
            {text.turnOn}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {remindersInBuild() ? (
        // The phone's reminder as it stands, in the accent card with a bell (group 4 redesign, Roshan's mockups,
        // 17-11-2026): the day and time it keeps, whether it's on, and what it is. The day and time stay picked while
        // it is off, for next time.
        <div className={cn(cardVariants({ variant: 'accent' }), 'gap-2')}>
          <div className="flex items-center gap-3">
            <RowTile icon={BellIcon} tint="var(--card)" />
            <p className="min-w-0 flex-1 font-semibold break-words">
              {text.summaryOn(text.everyDay[stored.weekday - 1], stored.time)}
            </p>
            <p className="shrink-0 rounded-full bg-foreground/10 px-3 py-1 text-[13px] font-semibold">
              {stored.on ? text.stateOn : text.summaryOff}
            </p>
          </div>
          <p className="text-sm">{text.intro}</p>
        </div>
      ) : (
        <p>{text.intro}</p>
      )}
      {body}
      <p role="status" className="text-sm">
        {status}
      </p>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{text.calendar}</p>
        {/* The check-in's own icon, as on Home's card. */}
        <LinkButton href="/check-in" icon={CalendarCheckIcon}>
          {text.toCheckIn}
        </LinkButton>
      </div>
    </div>
  );
}
