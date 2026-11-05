// The weekly reminder's schedule and words (docs/superpowers/plans/2026-11-05-weekly-reminder.md): shared by the
// `weekly-reminder` Edge Function (Deno) and the app's tests (Vitest). Plain TypeScript with `Intl` only: no Deno, Node
// or app imports, so both can load it as it is.

/** A reminder as the sender reads it from `push_subscriptions`. */
export type ReminderRow = {
  /** 1–7, Monday = 1. */
  weekday: number;
  /** 'HH:MM', a quarter hour, on the phone's clock. */
  localTime: string;
  /** IANA, e.g. 'Europe/Berlin'. */
  timeZone: string;
  /** The Monday ('YYYY-MM-DD') of the week it was last sent in, in its own zone, or null. */
  lastSentWeek: string | null;
};

/** How long after its time a reminder may still go: the schedule runs every 15 minutes. */
export const WINDOW_MINUTES = 15;

/** Where a tap on the reminder goes. */
export const REMINDER_URL = '/check-in';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A moment as the clock in `timeZone` shows it: the date, the weekday (Monday = 1) and the minutes since midnight. */
export function localParts(now: Date, timeZone: string): { date: string; weekday: number; minutes: number } | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(now);
  } catch {
    // An unknown time zone: Intl refuses it.
    return null;
  }
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = WEEKDAYS.indexOf(part('weekday')) + 1;
  if (weekday === 0) return null;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    weekday,
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

/** The Monday of the week a date is in, both 'YYYY-MM-DD'; `weekday` is the date's own (Monday = 1). */
export function mondayOf(date: string, weekday: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - (weekday - 1))).toISOString().slice(0, 10);
}

/**
 * Whether a reminder goes now: on its weekday, within the 15 minutes from its time, and not yet this Monday–Sunday
 * week, all on its own zone's clock. `week` is that week's Monday, to save as `last_sent_week` once it is sent. A time
 * that doesn't exist on the night summer time starts (02:00 to 02:59 in Europe) is skipped that week, and the hour that
 * comes twice when it ends sends once.
 */
export function isDue(now: Date, row: ReminderRow): { due: boolean; week: string | null } {
  const local = localParts(now, row.timeZone);
  if (local === null) return { due: false, week: null };
  const week = mondayOf(local.date, local.weekday);
  const [hours, minutes] = row.localTime.split(':').map(Number);
  const at = hours * 60 + minutes;
  const due =
    local.weekday === row.weekday &&
    local.minutes >= at &&
    local.minutes < at + WINDOW_MINUTES &&
    row.lastSentWeek !== week;
  return { due, week };
}

// The reminder's line in each language the app offers. The app's own dictionaries (src/i18n) can't be loaded here; a
// test checks that every offered language has its line.
const LINES: Record<string, string> = {
  en: 'Time for your weekly check-in.',
  de: 'Zeit für deinen wöchentlichen Check-in.',
  fr: 'C’est l’heure de ton bilan hebdomadaire.',
  es: 'Es hora de tu revisión semanal.',
};

/** The notification in a phone's language, English for one it doesn't know. */
export function reminderText(lang: string): { title: string; body: string } {
  return { title: 'StudentsBudget', body: LINES[lang] ?? LINES.en };
}

/** The languages that have a line of their own. */
export const REMINDER_LANGUAGES = Object.keys(LINES);
