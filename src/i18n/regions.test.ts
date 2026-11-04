import { describe, expect, it } from 'vitest';
import { DEFAULT_REGION, REGIONS, datePlaceholder, fullDatePattern, regionDate, type Region } from './regions';

const ALL = Object.keys(REGIONS) as Region[];

describe('the region registry', () => {
  it('has the default region in it', () => {
    expect(ALL).toContain(DEFAULT_REGION);
  });

  it('gives every region a name, each part of a date once, and a separator', () => {
    for (const code of ALL) {
      const { name, dateOrder, dateSeparator } = REGIONS[code];
      expect(name, code).not.toBe('');
      expect([...dateOrder].sort(), code).toEqual(['day', 'month', 'year']);
      expect(dateSeparator, code).not.toBe('');
    }
  });
});

describe('regionDate', () => {
  it('writes Germany’s dates day first, with dots', () => {
    expect(regionDate({ day: '04', month: '11', year: '2026' }, 'de')).toBe('04.11.2026');
  });
});

describe('fullDatePattern', () => {
  it('matches a full date as the region writes it, and nothing like it', () => {
    const date = new RegExp(`^${fullDatePattern('de')}$`);
    expect(date.test('04.11.2026')).toBe(true);
    expect(date.test('04-11-2026')).toBe(false);
    expect(date.test('04x11x2026')).toBe(false);
    expect(date.test('4.11.2026')).toBe(false);
  });
});

describe('datePlaceholder', () => {
  it('writes the form with two letters for the day and the month and four for the year', () => {
    expect(datePlaceholder({ day: 'T', month: 'M', year: 'J' }, 'de')).toBe('TT.MM.JJJJ');
  });
});
