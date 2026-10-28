import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SEMESTER_FEES, SEMESTER_PERIODS, type SemesterPeriod } from '../src/data/semesters.ts';
import { addDays, formatDate, type IsoDate, type IsoMonth } from '../src/lib/dates.ts';
import { amountText } from './catalog.ts';
import { sourcedFields, sourcedShape, sourceLine } from './sourced.ts';

type University = SemesterPeriod['university'];
type Term = SemesterPeriod['term'];

/** As `UNIVERSITIES` in the app's profile. */
export const UNIVERSITY_NAMES: Record<University, string> = { ur: 'Universität Regensburg', oth: 'OTH Regensburg' };

export type SemesterDates = { term: Term; start: IsoDate; end: IsoDate; period: SemesterPeriod };

function periodOf(university: University, term: Term): SemesterPeriod {
  const period = SEMESTER_PERIODS.find((p) => p.university === university && p.term === term);
  if (!period) throw new Error(`StudentsBudget: no ${term} semester for ${university}`);
  return period;
}

/** A year as four digits, so a year below 1000 still builds a real date. */
const yearText = (year: number): string => String(year).padStart(4, '0');

/**
 * The semester of `university` that `date` falls in, as the app's `semesterOn` (src/features/profile/profile.ts)
 * works it out; a test holds the two to the same answer. The periods leave no gap: before this year's summer
 * semester it is the winter semester that began last autumn, after it the one that begins this autumn.
 */
export function semesterOn(university: University, date: IsoDate): SemesterDates {
  const year = Number(date.slice(0, 4));
  const summer = periodOf(university, 'summer');
  const summerStart = `${yearText(year)}-${summer.starts}`;
  const summerEnd = `${yearText(year)}-${summer.ends}`;
  if (date >= summerStart && date <= summerEnd) {
    return { term: 'summer', start: summerStart, end: summerEnd, period: summer };
  }
  const winter = periodOf(university, 'winter');
  const startYear = date < summerStart ? year - 1 : year;
  return {
    term: 'winter',
    start: `${yearText(startYear)}-${winter.starts}`,
    end: `${yearText(startYear + 1)}-${winter.ends}`,
    period: winter,
  };
}

/** "winter semester 2026/27", "summer semester 2027". */
export function semesterLabel(s: Pick<SemesterDates, 'term' | 'start'>): string {
  const year = Number(s.start.slice(0, 4));
  return s.term === 'summer'
    ? `summer semester ${year}`
    : `winter semester ${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

const monthAndYear = new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric' });

/** "January 2027". */
function monthLabel(month: IsoMonth): string {
  const [year, m] = month.split('-').map(Number);
  return monthAndYear.format(new Date(year, m - 1, 1));
}

const partSchema = z.object({ label: z.string(), amount: z.string(), minor: z.number().int(), ...sourcedShape });
const feeSchema = z.object({
  total: z.string(),
  totalMinor: z.number().int(),
  parts: z.array(partSchema),
  reRegistration: z.object({ month: z.string(), ...sourcedShape }).nullable(),
});
const semesterSchema = z.object({
  term: z.enum(['winter', 'summer']),
  label: z.string(),
  start: z.string(),
  end: z.string(),
  ...sourcedShape,
  fee: feeSchema.nullable(),
});
const universitySchema = z.object({
  university: z.enum(['ur', 'oth']),
  name: z.string(),
  current: semesterSchema,
  next: semesterSchema,
});

export type SemesterInfo = z.infer<typeof semesterSchema>;
export type UniversityInfo = z.infer<typeof universitySchema>;

/** What the pages state about paying for this semester: its parts and re-registration month, or null for nothing. */
function feeOf(university: University, s: SemesterDates): SemesterInfo['fee'] {
  const fee = SEMESTER_FEES.find((f) => f.university === university && f.starts === s.start);
  const parts = fee?.parts ?? [];
  if (parts.length === 0 && fee?.reRegistration === undefined) return null;
  const totalMinor = parts.reduce((sum, p) => sum + p.minor, 0);
  return {
    total: amountText(totalMinor),
    totalMinor,
    parts: parts.map((p) => ({ label: p.label, amount: amountText(p.minor), minor: p.minor, ...sourcedFields(p) })),
    reRegistration:
      fee?.reRegistration === undefined
        ? null
        : { month: fee.reRegistration.month, ...sourcedFields(fee.reRegistration) },
  };
}

function info(university: University, s: SemesterDates): SemesterInfo {
  return { term: s.term, label: semesterLabel(s), start: s.start, end: s.end, ...sourcedFields(s.period), fee: feeOf(university, s) };
}

/** For each university: the semester `date` falls in and the one after it, each with what the pages state about its fee. */
export function semesterInfo(date: IsoDate, universities: readonly University[]): UniversityInfo[] {
  return universities.map((university) => {
    const current = semesterOn(university, date);
    const next = semesterOn(university, addDays(current.end, 1));
    return { university, name: UNIVERSITY_NAMES[university], current: info(university, current), next: info(university, next) };
  });
}

function feeLines(s: SemesterInfo, name: string): string[] {
  if (s.fee === null) {
    return [`  No page states the fee for the ${s.label} yet. It changes every semester, so it isn't guessed.`];
  }
  const lines = [`  Fee for the ${s.label}: ${s.fee.total}, paid with the re-registration (Rückmeldung) before the semester:`];
  for (const p of s.fee.parts) lines.push(`  - ${p.label}: ${p.amount}. ${sourceLine(p)}.`);
  lines.push(
    s.fee.reRegistration === null
      ? `  ${name} hasn't published when re-registration for the ${s.label} opens.`
      : `  Re-registration opens in ${monthLabel(s.fee.reRegistration.month)}. ${sourceLine(s.fee.reRegistration)}.`,
  );
  return lines;
}

export function semesterText(date: IsoDate, found: UniversityInfo[]): string {
  const lines: string[] = [];
  for (const u of found) {
    if (lines.length > 0) lines.push('');
    const { current, next } = u;
    lines.push(
      `${u.name} on ${formatDate(date)}: ${current.label}, ${formatDate(current.start)} to ${formatDate(current.end)}. ${sourceLine(current)}.`,
    );
    // A fee is paid before its semester, so the current one's matters only while a page still states it.
    if (current.fee !== null) lines.push(...feeLines(current, u.name));
    lines.push(`Next: ${next.label}, ${formatDate(next.start)} to ${formatDate(next.end)}. ${sourceLine(next)}.`);
    lines.push(...feeLines(next, u.name));
  }
  return lines.join('\n');
}

/** A real day as `YYYY-MM-DD`. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .refine((d) => new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d, 'Not a real day.');

export function registerSemesterInfo(server: McpServer, today: () => IsoDate): void {
  server.registerTool(
    'semester_info',
    {
      title: 'Regensburg semester dates and fees',
      description:
        'The semester dates of Universität Regensburg and OTH Regensburg (they differ: OTH’s summer semester ' +
        'starts on 15 March, UR’s on 1 April), which semester a day falls in, the next semester, and the ' +
        'semester fee (Studierendenwerk contribution plus RVV semester ticket) and re-registration month where a ' +
        'page states them. A fee no page states yet is left out, never guessed. Cite the sources and dates.',
      inputSchema: {
        university: z
          .enum(['ur', 'oth'])
          .optional()
          .describe('ur (Universität Regensburg) or oth (OTH Regensburg). Leave it out for both.'),
        date: isoDate.optional().describe('The day to look at, as YYYY-MM-DD. Today when left out.'),
      },
      outputSchema: { date: z.string(), universities: z.array(universitySchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ university, date }) => {
      const day = date ?? today();
      const universities = semesterInfo(day, university === undefined ? ['ur', 'oth'] : [university]);
      return {
        content: [{ type: 'text', text: semesterText(day, universities) }],
        structuredContent: { date: day, universities },
      };
    },
  );
}
