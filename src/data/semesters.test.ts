import { describe, expect, it } from 'vitest';
import { SEMESTER_FEES, SEMESTER_PERIODS, type SemesterPeriod } from './semesters';

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** The day after `MM-DD`, as `MM-DD`, in a year without 29 February. */
function dayAfter(monthDay: string): string {
  const [m, d] = monthDay.split('-').map(Number);
  const next = new Date(Date.UTC(2027, m - 1, d + 1));
  return `${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

const periodOf = (university: SemesterPeriod['university'], term: SemesterPeriod['term']) =>
  SEMESTER_PERIODS.find((p) => p.university === university && p.term === term);

describe('semester periods', () => {
  it('every period has real month-days, a source, an https url and a checked date', () => {
    expect(SEMESTER_PERIODS.length).toBeGreaterThan(0);
    for (const p of SEMESTER_PERIODS) {
      const name = `${p.university} ${p.term}`;
      // Checked in a leap year and a common one, so no period starts or ends on a day only some years have.
      for (const year of ['2027', '2028']) {
        expect(isRealIsoDate(`${year}-${p.starts}`), `${name} starts`).toBe(true);
        expect(isRealIsoDate(`${year}-${p.ends}`), `${name} ends`).toBe(true);
      }
      expect(p.source.trim(), `${name} source`).not.toBe('');
      expect(p.url, `${name} url`).toMatch(/^https:\/\/\S+$/);
      expect(isRealIsoDate(p.checked), `${name} checked`).toBe(true);
    }
  });

  it('gives Universität Regensburg and OTH Regensburg one winter and one summer semester each', () => {
    for (const university of ['ur', 'oth'] as const) {
      const terms = SEMESTER_PERIODS.filter((p) => p.university === university).map((p) => p.term);
      expect(terms.sort(), university).toEqual(['summer', 'winter']);
    }
  });

  it('lets the two semesters of a university follow each other with no gap and no overlap', () => {
    for (const university of ['ur', 'oth'] as const) {
      const winter = periodOf(university, 'winter');
      const summer = periodOf(university, 'summer');
      if (!winter || !summer) throw new Error(`${university} is missing a semester`);
      expect(summer.starts, `${university} summer starts the day after winter ends`).toBe(dayAfter(winter.ends));
      expect(winter.starts, `${university} winter starts the day after summer ends`).toBe(dayAfter(summer.ends));
      // A winter semester runs into the next year; a summer semester stays inside one.
      expect(winter.ends < winter.starts, `${university} winter crosses the year end`).toBe(true);
      expect(summer.starts < summer.ends, `${university} summer stays in one year`).toBe(true);
    }
  });

  it('holds the dates the two universities publish', () => {
    expect(periodOf('ur', 'winter')).toMatchObject({ starts: '10-01', ends: '03-31' });
    expect(periodOf('ur', 'summer')).toMatchObject({ starts: '04-01', ends: '09-30' });
    expect(periodOf('oth', 'winter')).toMatchObject({ starts: '10-01', ends: '03-14' });
    expect(periodOf('oth', 'summer')).toMatchObject({ starts: '03-15', ends: '09-30' });
  });
});

describe('semester fees', () => {
  it('belong to a semester of their university, once each', () => {
    expect(SEMESTER_FEES.length).toBeGreaterThan(0);
    for (const f of SEMESTER_FEES) {
      const starts = SEMESTER_PERIODS.filter((p) => p.university === f.university).map((p) => p.starts);
      expect(starts, `${f.university} ${f.starts} starts a semester`).toContain(f.starts.slice(5));
    }
    const keys = SEMESTER_FEES.map((f) => `${f.university} ${f.starts}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('give every stated part and re-registration month a source, an https url and a checked date', () => {
    for (const f of SEMESTER_FEES) {
      const name = `${f.university} ${f.starts}`;
      for (const part of f.parts ?? []) {
        expect(part.label.trim(), `${name} part label`).not.toBe('');
        expect(Number.isInteger(part.minor) && part.minor > 0, `${name} ${part.label} is whole cents above 0`).toBe(true);
        expect(part.source.trim(), `${name} ${part.label} source`).not.toBe('');
        expect(part.url, `${name} ${part.label} url`).toMatch(/^https:\/\/\S+$/);
        expect(isRealIsoDate(part.checked), `${name} ${part.label} checked`).toBe(true);
      }
      const r = f.reRegistration;
      if (r) {
        expect(r.month, `${name} re-registration month`).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
        // 'YYYY-MM' strings sort chronologically: re-registration comes before the semester.
        expect(r.month < f.starts.slice(0, 7), `${name} re-registration before the start`).toBe(true);
        expect(r.source.trim(), `${name} re-registration source`).not.toBe('');
        expect(r.url, `${name} re-registration url`).toMatch(/^https:\/\/\S+$/);
        expect(isRealIsoDate(r.checked), `${name} re-registration checked`).toBe(true);
      }
    }
  });

  it('holds what the statutes and the universities state', () => {
    const fee = (university: 'ur' | 'oth', starts: string) =>
      SEMESTER_FEES.find((f) => f.university === university && f.starts === starts);
    // Summer 2027: basic contribution €87 plus semester ticket €128, at both universities.
    expect(fee('oth', '2027-03-15')?.parts?.map((p) => p.minor)).toEqual([8700, 12800]);
    expect(fee('ur', '2027-04-01')?.parts?.map((p) => p.minor)).toEqual([8700, 12800]);
    // Winter 2027/28: €92 plus €130.
    expect(fee('oth', '2027-10-01')?.parts?.map((p) => p.minor)).toEqual([9200, 13000]);
    expect(fee('ur', '2027-10-01')?.parts?.map((p) => p.minor)).toEqual([9200, 13000]);
    // OTH opens re-registration for summer 2027 in January; UR has not said yet.
    expect(fee('oth', '2027-03-15')?.reRegistration?.month).toBe('2027-01');
    expect(fee('ur', '2027-04-01')?.reRegistration).toBeUndefined();
  });
});
