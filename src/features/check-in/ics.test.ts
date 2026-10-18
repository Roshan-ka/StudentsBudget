import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FILE = fileURLToPath(new URL('../../../public/weekly-check-in.ics', import.meta.url));
const ics = readFileSync(FILE, 'utf8');

describe('weekly-check-in.ics', () => {
  it('is a calendar with a weekly Sunday event at 18:00 local time', () => {
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU');
    // No Z and no TZID: a floating time is 18:00 wherever the phone is.
    expect(ics).toContain('DTSTART:20261018T180000\r\n');
  });

  it('has the fields RFC 5545 requires, in order, with one event', () => {
    const lines = ics.split('\r\n');
    expect(lines.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines.slice(0, 3)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//StudentsBudget//Weekly check-in//EN',
    ]);
    expect(lines.slice(3, 11)).toEqual([
      'BEGIN:VEVENT',
      'UID:weekly-check-in@studentsbudget',
      'DTSTAMP:20261016T000000Z',
      'SUMMARY:StudentsBudget weekly check-in',
      'DTSTART:20261018T180000',
      'DURATION:PT10M',
      'RRULE:FREQ=WEEKLY;BYDAY=SU',
      'END:VEVENT',
    ]);
    expect(lines.slice(11)).toEqual(['END:VCALENDAR', '']);
  });

  it('starts on a Sunday', () => {
    // 2026-10-18 is the first Sunday after the app was set up; BYDAY=SU only repeats it, so it has to be one.
    expect(new Date(2026, 9, 18).getDay()).toBe(0);
  });

  it('ends every line with CRLF, as RFC 5545 asks, and never with a bare LF', () => {
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
  });

  it('keeps every line within 75 characters, so nothing needs folding', () => {
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });
});
