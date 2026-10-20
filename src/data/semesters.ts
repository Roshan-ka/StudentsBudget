import type { IsoDate, IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';

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

type Sourced = { source: string; url: string; checked: IsoDate };

/** One part of a semester fee, in EUR cents, as a page states it. */
export type FeePart = Sourced & { label: string; minor: Minor };

/**
 * What the pages state about paying for one semester at one university (ruling R12/R13). `starts` is the semester's
 * first day, as `SEMESTER_PERIODS` gives it. The fee is paid with the re-registration (Rückmeldung) before the
 * semester, so `reRegistration` is the month that opens, once the university publishes it. `parts` add up to the fee:
 * the Studierendenwerk's basic contribution and the RVV semester ticket, both set by Studierendenwerk statutes for
 * UR and OTH alike. Whatever no page states yet is left out, never guessed: the fee changes every semester.
 */
export type SemesterFee = {
  university: SemesterPeriod['university'];
  starts: IsoDate;
  reRegistration?: Sourced & { month: IsoMonth };
  parts?: FeePart[];
};

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';
const BASIC_URL =
  'https://stwno.de/images/1_Home/Semesterbeitr%C3%A4ge_und_-tickets/005_2026-08-24_Satzung_Grundbeitrag_SS27.pdf';
const TICKET_URL =
  'https://stwno.de/images/1_Home/Semesterbeitr%C3%A4ge_und_-tickets/2026-10-19_S_Satzung_Semesterticket_Regensburg_SoSe27-WiSe2728.pdf';

const basic = (minor: Minor, semester: string): FeePart => ({
  label: 'Studierendenwerk basic contribution',
  minor,
  source: `${STWNO}, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the ${semester} figure.`,
  url: BASIC_URL,
  checked: CHECKED,
});

const ticket = (minor: Minor, semester: string): FeePart => ({
  label: 'RVV semester ticket',
  minor,
  source: `${STWNO}, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the ${semester} figure.`,
  url: TICKET_URL,
  checked: CHECKED,
});

const SUMMER_2027 = [basic(8700, 'summer 2027'), ticket(12800, 'summer 2027')];
const WINTER_2027 = [basic(9200, 'winter 2027/28'), ticket(13000, 'winter 2027/28')];

export const SEMESTER_FEES: SemesterFee[] = [
  {
    university: 'oth',
    starts: '2027-03-15',
    reRegistration: {
      month: '2027-01',
      source:
        'OTH Regensburg, dates and opening hours (in German): "Rückmeldung für das SoSe 2027: vorauss. ab 07.01.2027", re-registration for summer 2027 expected to open on 7 Jan 2027',
      url: 'https://www.oth-regensburg.de/die-oth/termine-und-oeffnungszeiten',
      checked: CHECKED,
    },
    parts: SUMMER_2027,
  },
  // UR has not published its re-registration dates for summer 2027 yet.
  { university: 'ur', starts: '2027-04-01', parts: SUMMER_2027 },
  { university: 'oth', starts: '2027-10-01', parts: WINTER_2027 },
  { university: 'ur', starts: '2027-10-01', parts: WINTER_2027 },
];
