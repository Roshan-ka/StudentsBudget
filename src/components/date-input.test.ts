import { describe, expect, it } from 'vitest';
import {
  isCalendarKey,
  monthWeeks,
  movedDay,
  readTypedDate,
  sameDayIn,
  shiftDayByMonths,
  typedDateText,
  yearPage,
} from './date-input';

const TODAY = '2026-11-06';

/** The date `text` reads as, or what it reads as instead. */
function read(text: string): string {
  const typed = readTypedDate(text, TODAY);
  return typed.kind === 'date' ? typed.date : typed.kind;
}

/** Types `text` one character at a time, as a keyboard does, and gives what the field shows after each. */
function typeOut(text: string): string[] {
  const shown: string[] = [];
  let current = '';
  for (const character of text) {
    current = typedDateText(current, current + character);
    shown.push(current);
  }
  return shown;
}

describe('readTypedDate', () => {
  it("reads the region's full form", () => {
    expect(read('06.11.2026')).toBe('2026-11-06');
    expect(read('31.12.2026')).toBe('2026-12-31');
  });

  it('reads one-digit days and months, and a two-digit year as the 2000s', () => {
    expect(read('6.11.2026')).toBe('2026-11-06');
    expect(read('6.1.2027')).toBe('2027-01-06');
    expect(read('6.11.26')).toBe('2026-11-06');
    expect(read('1.2.99')).toBe('2099-02-01');
  });

  it("takes a date without its year as this year's", () => {
    expect(read('6.11')).toBe('2026-11-06');
    expect(read('6.11.')).toBe('2026-11-06');
    expect(read('24.12')).toBe('2026-12-24');
  });

  it('takes the usual separators, and spaces around the text', () => {
    expect(read('6,11,2026')).toBe('2026-11-06');
    expect(read('6/11/2026')).toBe('2026-11-06');
    expect(read('6-11-2026')).toBe('2026-11-06');
    expect(read('6 11 2026')).toBe('2026-11-06');
    expect(read('  06.11.2026  ')).toBe('2026-11-06');
  });

  it('reads bare digits: day and month, with a two- or four-digit year', () => {
    expect(read('0611')).toBe('2026-11-06');
    expect(read('061126')).toBe('2026-11-06');
    expect(read('06112026')).toBe('2026-11-06');
  });

  it('reads the 29th of February only in a leap year', () => {
    expect(read('29.02.2028')).toBe('2028-02-29');
    expect(read('29.02.2026')).toBe('not-a-date');
    expect(read('29.02.2000')).toBe('2000-02-29');
  });

  it('refuses a day or month the calendar does not have', () => {
    expect(read('31.02.2026')).toBe('not-a-date');
    expect(read('31.11.2026')).toBe('not-a-date');
    expect(read('00.11.2026')).toBe('not-a-date');
    expect(read('06.13.2026')).toBe('not-a-date');
    expect(read('06.00.2026')).toBe('not-a-date');
  });

  it('refuses text that is not a date', () => {
    expect(read('tomorrow')).toBe('not-a-date');
    expect(read('6')).toBe('not-a-date');
    expect(read('061')).toBe('not-a-date');
    expect(read('06.11.202')).toBe('not-a-date');
    expect(read('06.11.20261')).toBe('not-a-date');
    expect(read('006.11.2026')).toBe('not-a-date');
    expect(read('.06.11')).toBe('not-a-date');
    expect(read('6.11.2026.1')).toBe('not-a-date');
    expect(read('06.11.1850')).toBe('not-a-date');
    expect(read('6a.11')).toBe('not-a-date');
  });

  it('reads empty text as empty', () => {
    expect(read('')).toBe('empty');
    expect(read('   ')).toBe('empty');
  });
});

describe('readTypedDate with pastFirst (an entry’s date)', () => {
  const past = (text: string, today: string) => {
    const typed = readTypedDate(text, today, 'de', { pastFirst: true });
    return typed.kind === 'date' ? typed.date : typed.kind;
  };

  it('reads a date without its year as last year’s when this year’s is more than two months ahead', () => {
    // New Year's Eve, logged on 2 January (review, 09-11-2026).
    expect(past('31.12', '2027-01-02')).toBe('2026-12-31');
    expect(past('3112', '2027-01-02')).toBe('2026-12-31');
    expect(past('15.6', '2027-02-10')).toBe('2026-06-15');
  });

  it('keeps this year for a date in the past or up to two months ahead', () => {
    expect(past('6.11', '2026-11-09')).toBe('2026-11-06');
    expect(past('5.1', '2026-11-09')).toBe('2026-01-05');
    // A planned expense next month stays this year.
    expect(past('15.12', '2026-11-09')).toBe('2026-12-15');
    expect(past('8.1', '2026-11-08')).toBe('2026-01-08');
  });

  it('leaves a typed year alone, and checks the 29th of February in the year it lands in', () => {
    expect(past('31.12.2027', '2027-01-02')).toBe('2027-12-31');
    expect(past('29.2', '2029-01-10')).toBe('not-a-date');
    expect(past('29.2', '2028-12-30')).toBe('2028-02-29');
  });

  it('reads as before without pastFirst (a semester date)', () => {
    expect(read('31.12')).toBe('2026-12-31');
  });
});

describe('typedDateText', () => {
  it('puts the dots in while digits are typed, as on a phone without a dot key', () => {
    expect(typeOut('06112026')).toEqual([
      '0',
      '06.',
      '06.1',
      '06.11.',
      '06.11.2',
      '06.11.20',
      '06.11.202',
      '06.11.2026',
    ]);
  });

  it('keeps a dot typed by hand, and drops a second one in a row', () => {
    expect(typeOut('6.11.2026')).toEqual(['6', '6.', '6.1', '6.11.', '6.11.', '6.11.2', '6.11.20', '6.11.202', '6.11.2026']);
    expect(typedDateText('06.', '06..')).toBe('06.');
    expect(typedDateText('', '.')).toBe('');
  });

  it('never puts a dot back while deleting', () => {
    expect(typedDateText('06.11.', '06.11')).toBe('06.11');
    expect(typedDateText('06.', '06')).toBe('06');
    expect(typedDateText('06.11.2026', '')).toBe('');
  });

  it('groups digits pasted in one go', () => {
    expect(typedDateText('', '06112026')).toBe('06.11.2026');
    expect(typedDateText('', '0611')).toBe('06.11.');
    expect(typedDateText('', '061126')).toBe('06.11.26');
  });

  it('leaves pasted text with separators as it is, for the field to read', () => {
    expect(typedDateText('', '6/11/2026')).toBe('6/11/2026');
    expect(typedDateText('', '6. 11. 2026')).toBe('6. 11. 2026');
  });

  it('shows digits past a full date, so the field can say it is not one', () => {
    expect(typedDateText('06.11.2026', '06.11.20261')).toBe('06.11.20261');
    expect(typedDateText('', '061120261')).toBe('06.11.20261');
  });
});

describe('monthWeeks', () => {
  it('gives six Monday–Sunday weeks from the week of the first', () => {
    const weeks = monthWeeks('2026-11');
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    // 1 November 2026 is a Sunday: its week starts on Monday 26 October.
    expect(weeks[0][0]).toBe('2026-10-26');
    expect(weeks[0][6]).toBe('2026-11-01');
    expect(weeks[5][6]).toBe('2026-12-06');
  });

  it('starts on the first itself when the month starts on a Monday', () => {
    // 1 June 2026 is a Monday.
    expect(monthWeeks('2026-06')[0][0]).toBe('2026-06-01');
  });

  it('fills February with the days around it, and crosses a year end', () => {
    // February 2027 starts on a Monday and has 28 days: four weeks, then two of March.
    const february = monthWeeks('2027-02');
    expect(february[0][0]).toBe('2027-02-01');
    expect(february[3][6]).toBe('2027-02-28');
    expect(february[4][0]).toBe('2027-03-01');
    expect(monthWeeks('2027-01')[0][0]).toBe('2026-12-28');
  });
});

describe('shiftDayByMonths', () => {
  it('keeps the day of the month', () => {
    expect(shiftDayByMonths('2026-11-06', 1)).toBe('2026-12-06');
    expect(shiftDayByMonths('2026-11-06', -1)).toBe('2026-10-06');
    expect(shiftDayByMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it("lands on a shorter month's last day", () => {
    expect(shiftDayByMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(shiftDayByMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(shiftDayByMonths('2026-10-31', -1)).toBe('2026-09-30');
    expect(shiftDayByMonths('2028-02-29', 12)).toBe('2029-02-28');
  });
});

describe('movedDay', () => {
  it('moves a day sideways and a week up or down, across month and year ends', () => {
    expect(movedDay('2026-11-06', 'ArrowRight')).toBe('2026-11-07');
    expect(movedDay('2026-11-01', 'ArrowLeft')).toBe('2026-10-31');
    expect(movedDay('2026-12-31', 'ArrowRight')).toBe('2027-01-01');
    expect(movedDay('2026-11-06', 'ArrowUp')).toBe('2026-10-30');
    expect(movedDay('2026-12-28', 'ArrowDown')).toBe('2027-01-04');
  });

  it("goes to the week's Monday and Sunday", () => {
    // Friday 6 November 2026.
    expect(movedDay('2026-11-06', 'Home')).toBe('2026-11-02');
    expect(movedDay('2026-11-06', 'End')).toBe('2026-11-08');
    // Sunday 1 November: its week started in October.
    expect(movedDay('2026-11-01', 'Home')).toBe('2026-10-26');
  });

  it('moves a month with Page Up and Page Down, and a year with Shift', () => {
    expect(movedDay('2026-11-06', 'PageDown')).toBe('2026-12-06');
    expect(movedDay('2026-11-06', 'PageUp')).toBe('2026-10-06');
    expect(movedDay('2026-11-06', 'PageDown', true)).toBe('2027-11-06');
    expect(movedDay('2026-11-06', 'PageUp', true)).toBe('2025-11-06');
    expect(movedDay('2026-03-31', 'PageUp')).toBe('2026-02-28');
  });

  it('flips sideways in a right-to-left language', () => {
    expect(movedDay('2026-11-06', 'ArrowRight', false, true)).toBe('2026-11-05');
    expect(movedDay('2026-11-06', 'ArrowLeft', false, true)).toBe('2026-11-07');
  });
});

describe('isCalendarKey', () => {
  it('knows the keys that move the focus, and nothing else', () => {
    expect(isCalendarKey('ArrowLeft')).toBe(true);
    expect(isCalendarKey('PageDown')).toBe(true);
    expect(isCalendarKey('Enter')).toBe(false);
    expect(isCalendarKey('Escape')).toBe(false);
    expect(isCalendarKey('a')).toBe(false);
  });
});

describe('sameDayIn', () => {
  it('keeps the day number in another month and year', () => {
    expect(sameDayIn('2026-11-09', '2028-03')).toBe('2028-03-09');
    expect(sameDayIn('2026-11-30', '2026-01')).toBe('2026-01-30');
  });

  it("lands on a shorter month's last day", () => {
    expect(sameDayIn('2026-10-31', '2026-11')).toBe('2026-11-30');
    expect(sameDayIn('2028-02-29', '2027-02')).toBe('2027-02-28');
    expect(sameDayIn('2026-01-31', '2028-02')).toBe('2028-02-29');
  });
});

describe('yearPage', () => {
  it('shows twelve years: the shown one, seven before it and four after', () => {
    const years = yearPage(2026);
    expect(years).toHaveLength(12);
    expect(years[0]).toBe(2019);
    expect(years[7]).toBe(2026);
    expect(years[11]).toBe(2030);
  });

  it('moves twelve years a page, either way', () => {
    expect(yearPage(2026, 1)).toEqual([2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040, 2041, 2042]);
    expect(yearPage(2026, -1)[0]).toBe(2007);
    expect(yearPage(2026, -1)[11]).toBe(2018);
  });
});
