import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LANGUAGES, type Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import { calendarFileOf } from './calendar-file';

/** The calendar file the check-in links to in `lang`, as it is in public/. */
function fileOf(lang: Language): string {
  return readFileSync(fileURLToPath(new URL(`../../../public${calendarFileOf(lang)}`, import.meta.url)), 'utf8');
}

const CODES = Object.keys(LANGUAGES) as Language[];

describe.each(CODES)('the weekly check-in calendar file in %s', (code) => {
  const ics = fileOf(code);
  const title = MESSAGES[code].checkIn.calendarEvent;

  it('is a calendar with a weekly Sunday event at 18:00 local time', () => {
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU');
    // No Z and no TZID: a floating time is 18:00 wherever the phone is.
    expect(ics).toContain('DTSTART:20261018T180000\r\n');
  });

  it('has the fields RFC 5545 requires, in order, with one event titled in its language and an alert as it starts', () => {
    const lines = ics.split('\r\n');
    expect(lines.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//StudentsBudget//Weekly check-in//${code.toUpperCase()}`,
      'BEGIN:VEVENT',
      // One id in every language: added twice, the event is still one.
      'UID:weekly-check-in@studentsbudget',
      'DTSTAMP:20261016T000000Z',
      `SUMMARY:${title}`,
      'DTSTART:20261018T180000',
      'DURATION:PT10M',
      'RRULE:FREQ=WEEKLY;BYDAY=SU',
      // A calendar with no alert by default (an iPhone's) still rings (review, 09-11-2026).
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${title}`,
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });

  it('ends every line with CRLF, as RFC 5545 asks, and never with a bare LF', () => {
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
  });

  it('keeps every line within 75 octets, so nothing needs folding, and the title needs no escaping', () => {
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    // Commas, semicolons and backslashes would need a backslash before them in a text value.
    expect(title).not.toMatch(/[,;\\]/);
  });
});

it('starts on a Sunday', () => {
  // 2026-10-18 is the first Sunday after the app was set up; BYDAY=SU only repeats it, so it has to be one.
  expect(new Date(2026, 9, 18).getDay()).toBe(0);
});
