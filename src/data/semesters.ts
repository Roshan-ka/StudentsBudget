import type { IsoDate } from '@/lib/dates';

/**
 * One semester of a Regensburg university, by month and day (`MM-DD`), with the page that states it. Each university
 * publishes its own semester dates, and the two differ: OTH Regensburg's summer semester starts on 15 March,
 * Universität Regensburg's on 1 April. A winter semester ends in the year after it starts. The two periods of a
 * university follow each other with no gap, so every day of the year falls in exactly one.
 */
export type SemesterPeriod = {
  university: 'ur' | 'oth';
  term: 'winter' | 'summer';
  /** First day, `MM-DD`. */
  starts: string;
  /** Last day, `MM-DD`. */
  ends: string;
  source: string;
  url: string;
  checked: IsoDate;
};

const CHECKED: IsoDate = '2026-10-20';
const UR_URL = 'https://www.uni-regensburg.de/en/studies/during-your-studies/study-organization/academic-calendar';
// OTH has no English page that states the semester dates.
const OTH_URL = 'https://www.oth-regensburg.de/studieren/im-studium/studienstart';

export const SEMESTER_PERIODS: SemesterPeriod[] = [
  {
    university: 'ur',
    term: 'winter',
    starts: '10-01',
    ends: '03-31',
    source: 'Universität Regensburg, academic calendar: "The winter semester begins on 1 October and ends on 31 March."',
    url: UR_URL,
    checked: CHECKED,
  },
  {
    university: 'ur',
    term: 'summer',
    starts: '04-01',
    ends: '09-30',
    source: 'Universität Regensburg, academic calendar: "The summer semester lasts from 1 April to 30 September."',
    url: UR_URL,
    checked: CHECKED,
  },
  {
    university: 'oth',
    term: 'winter',
    starts: '10-01',
    ends: '03-14',
    source: 'OTH Regensburg, Studienstart (in German): winter semester 1 October to 14 March',
    url: OTH_URL,
    checked: CHECKED,
  },
  {
    university: 'oth',
    term: 'summer',
    starts: '03-15',
    ends: '09-30',
    source: 'OTH Regensburg, Studienstart (in German): summer semester 15 March to 30 September',
    url: OTH_URL,
    checked: CHECKED,
  },
];
