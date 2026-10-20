import type { IsoDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';

/**
 * A cheaper way to do something an envelope pays for, with where its two prices come from. `fromMinor` is what
 * one use costs now and `toMinor` what it costs the new way, both in EUR cents; `per` is the unit
 * ("meal", "ticket", "month"). The source is where both amounts are stated; a swap built on an assumption
 * (uses per month) has the source 'Estimate', as in `cities.ts`, and links to what the estimate was built
 * from. A swap shows its linked tip next to it, so the tip's own source covers the tip's own numbers.
 */
export type Swap = {
  id: string;
  /** A flexible category: only those have envelopes. */
  categoryId: string;
  title: string;
  body: string;
  fromMinor: Minor;
  toMinor: Minor;
  per: string;
  source: string;
  url: string;
  checked: IsoDate;
  tipId?: string;
};

const CHECKED: IsoDate = '2026-10-20';

/**
 * Regensburg swaps, seeded by hand. Every page was opened on the checked date. Where the two prices sit on two
 * pages, `url` is the page behind `fromMinor` and `source` names the page behind `toMinor`, which is also the
 * source of the linked tip.
 *
 * Left out on purpose: a swap needs a price on both sides, and no page states one for the rest. Free things
 * (museums for students under 30, Fashion for Free, scanning at the library) are tips, not swaps, because
 * `toMinor` has to be above zero. The Mensa "tap your student ID" rule names no price for those who forget, and
 * the Staatstheater page states no regular ticket price. Food, shopping and study have no swap for now.
 */
export const SWAPS: Swap[] = [
  {
    id: 'mensa-instead-of-restaurant',
    categoryId: 'eating-out',
    title: 'Eat at the Mensa instead of a restaurant',
    // 3.80 is the median student price of the Mensa main dishes in the week 19–23 Oct 2026, the same number as in cities.ts.
    body: 'A main dish at the Uni Regensburg Mensa costs students €3.80 at the median, and from €2.30. A meal at an inexpensive restaurant costs about €14.50. On a day you would eat out, the Mensa is the cheaper plate.',
    fromMinor: 1450,
    toMinor: 380,
    per: 'meal',
    source:
      'Numbeo, Meal at an Inexpensive Restaurant in Regensburg: €14.50 (crowd-sourced, 15 contributors, updated 20 Oct 2026). The €3.80 is the median student price of the main dishes on the menu of Mensa Uni Regensburg for 19–23 Oct 2026 (Studierendenwerk Niederbayern/Oberpfalz, stwno.de/de/gastronomie/speiseplan/uni-regensburg/mensa-ur), a snapshot: the menu changes every week',
    url: 'https://www.numbeo.com/cost-of-living/in/Regensburg',
    checked: CHECKED,
    tipId: 'eat-at-the-mensa',
  },
  {
    id: 'cinema-student-price',
    categoryId: 'going-out',
    title: 'See a film at the student price',
    body: 'Show your student proof at Kinos im Andreasstadel: a ticket to a regular screening costs €8 instead of €9.',
    fromMinor: 900,
    toMinor: 800,
    per: 'ticket',
    source:
      'Kinos im Andreasstadel, ticket prices: regular €9, reduced €8 for students on showing proof at the cinema; special events can differ',
    url: 'https://www.kinos-im-andreasstadel.de/Eintrittspreise/unterseite_7311',
    checked: CHECKED,
    tipId: 'cinema-student-price',
  },
  {
    id: 'deutschlandticket-for-travel-months',
    categoryId: 'transport',
    title: 'Book the Deutschlandticket for a month you travel',
    body: 'A Bayern-Ticket for one day costs €34. The student upgrade to the Deutschlandticket costs €22 a month in Regensburg and is valid all day on local and regional trains across Germany. The saving assumes one Bayern-Ticket day in the month; every further day adds to it. The upgrade cancels monthly, so book it for the months you travel.',
    fromMinor: 3400,
    toMinor: 2200,
    per: 'month',
    source: 'Estimate',
    // The Bayern-Ticket price; the €22 upgrade is the source of the linked tip (rvv.de/semesterticket).
    url: 'https://www.bahn.de/angebot/regio/laender-tickets/bayern-ticket',
    checked: CHECKED,
    tipId: 'upgrade-to-deutschlandticket',
  },
];
