import { describe, expect, it } from 'vitest';
import { OFFERED } from '@/i18n/languages';
import {
  isDue,
  localParts,
  mondayOf,
  REMINDER_LANGUAGES,
  reminderText,
  type ReminderRow,
} from '../../../supabase/functions/_shared/reminder';

// The weekly reminder's schedule (docs/superpowers/plans/2026-11-05-weekly-reminder.md). 08.11.2026 and 05.07.2026 are
// Sundays: Berlin is UTC+1 in November and UTC+2 in July.

const sunday18: ReminderRow = { weekday: 7, localTime: '18:00', timeZone: 'Europe/Berlin', lastSentWeek: null };

describe('a moment on a phone’s clock', () => {
  it('reads the date, the weekday and the minutes in the phone’s zone', () => {
    expect(localParts(new Date('2026-11-08T17:00:00Z'), 'Europe/Berlin')).toEqual({
      date: '2026-11-08',
      weekday: 7,
      minutes: 18 * 60,
    });
    // Just before midnight in Berlin is already Monday in India.
    expect(localParts(new Date('2026-11-08T22:59:00Z'), 'Asia/Kolkata')).toEqual({
      date: '2026-11-09',
      weekday: 1,
      minutes: 4 * 60 + 29,
    });
    expect(localParts(new Date('2026-11-08T17:00:00Z'), 'Mars/Olympus')).toBeNull();
  });

  it('finds the week’s Monday, across a month and a year', () => {
    expect(mondayOf('2026-11-08', 7)).toBe('2026-11-02');
    expect(mondayOf('2026-11-02', 1)).toBe('2026-11-02');
    expect(mondayOf('2027-01-01', 5)).toBe('2026-12-28');
  });
});

describe('whether a reminder is due', () => {
  it('goes on its day, from its time, for 15 minutes, in winter and in summer', () => {
    expect(isDue(new Date('2026-11-08T16:59:00Z'), sunday18)).toEqual({ due: false, week: '2026-11-02' });
    expect(isDue(new Date('2026-11-08T17:00:00Z'), sunday18)).toEqual({ due: true, week: '2026-11-02' });
    expect(isDue(new Date('2026-11-08T17:14:59Z'), sunday18).due).toBe(true);
    expect(isDue(new Date('2026-11-08T17:15:00Z'), sunday18).due).toBe(false);
    // Summer time: 18:00 in Berlin is 16:00 UTC.
    expect(isDue(new Date('2026-07-05T16:00:00Z'), sunday18).due).toBe(true);
    expect(isDue(new Date('2026-07-05T17:00:00Z'), sunday18).due).toBe(false);
    // Saturday at 18:00 is the wrong day.
    expect(isDue(new Date('2026-11-07T17:00:00Z'), sunday18).due).toBe(false);
  });

  it('follows the phone’s own zone', () => {
    const india = { ...sunday18, timeZone: 'Asia/Kolkata' };
    // 18:00 in India is 12:30 UTC.
    expect(isDue(new Date('2026-11-08T12:30:00Z'), india).due).toBe(true);
    expect(isDue(new Date('2026-11-08T17:00:00Z'), india).due).toBe(false);
  });

  it('goes once a week, even when the day moves after it went', () => {
    expect(isDue(new Date('2026-11-08T17:00:00Z'), { ...sunday18, lastSentWeek: '2026-11-02' }).due).toBe(false);
    // Sent on Monday 02.11, then moved to Wednesday: not again that week, but the next.
    const movedToWednesday = { ...sunday18, weekday: 3, lastSentWeek: '2026-11-02' };
    expect(isDue(new Date('2026-11-04T17:00:00Z'), movedToWednesday).due).toBe(false);
    expect(isDue(new Date('2026-11-11T17:00:00Z'), movedToWednesday)).toEqual({ due: true, week: '2026-11-09' });
  });

  it('never goes for a zone the clock doesn’t know', () => {
    expect(isDue(new Date('2026-11-08T17:00:00Z'), { ...sunday18, timeZone: 'Nowhere/Town' })).toEqual({
      due: false,
      week: null,
    });
  });
});

describe('the reminder’s words', () => {
  it('have a line in every language the app offers, and English for any other', () => {
    for (const lang of OFFERED) expect(REMINDER_LANGUAGES, lang).toContain(lang);
    for (const lang of OFFERED.filter((code) => code !== 'en')) {
      expect(reminderText(lang).body, lang).not.toBe(reminderText('en').body);
    }
    expect(reminderText('pt')).toEqual(reminderText('en'));
    expect(reminderText('en')).toEqual({ title: 'StudentsBudget', body: 'Time for your weekly check-in.' });
  });
});
