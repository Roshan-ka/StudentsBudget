import type { IsoDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';

/**
 * A cheaper way to do something an envelope pays for, with where its two prices come from. `fromMinor` is what
 * one use costs now and `toMinor` what it costs the new way, both in EUR cents; `per` is the unit
 * ("meal", "ticket", "month").
 *
 * Each amount has a source it can be checked on. When one page states both, `source` and `url` are that page.
 * When the cheaper amount comes from another page, `source` and `url` are the page behind `fromMinor` and
 * `toSource` and `toUrl` the page behind `toMinor`; the two always come as a pair. A swap built on an assumption
 * (uses per month) sets `estimate` and starts its body and its source with "Estimate", as `cities.ts` labels what
 * no page states, so its line says "(estimate)" before it is opened too.
 * A swap also shows its linked tip, whose own source covers the tip's own numbers.
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
  /** Where `toMinor` is stated, when that is not the page behind `source` and `url`. */
  toSource?: string;
  toUrl?: string;
  checked: IsoDate;
  tipId?: string;
  /** The saving rests on an assumption no page states (how often per month). */
  estimate?: true;
};

const CHECKED: IsoDate = '2026-10-20';

/**
 * Regensburg swaps, seeded by hand. Every page was opened on the checked date.
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
    // 380 is the same number as the Mensa price point in cities.ts: the median student price of the main dishes in 19–23 Oct 2026.
    body: 'The median main dish at the Uni Regensburg Mensa cost students €3.80 in the week of 19–23 Oct, and the cheapest €2.30. A meal at an inexpensive restaurant costs about €14.50. On a day you would eat out, the Mensa is the cheaper plate.',
    fromMinor: 1450,
    toMinor: 380,
    per: 'meal',
    source:
      'Numbeo, Meal at an Inexpensive Restaurant in Regensburg: €14.50 (crowd-sourced; for the whole city, 246 entries by 15 contributors in the past 12 months, updated 20 Oct 2026)',
    url: 'https://www.numbeo.com/cost-of-living/in/Regensburg',
    toSource:
      'Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg: median student price of the main dishes on the menu in the week 19–23 Oct 2026, a snapshot (the menu page shows the current week)',
    toUrl: 'https://stwno.de/de/gastronomie/speiseplan/uni-regensburg/mensa-ur',
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
    body: 'Estimate: the saving assumes one Bayern-Ticket day in the month, and every further day adds to it. A Bayern-Ticket for one day costs €34. The student upgrade to the Deutschlandticket costs €22 a month in Regensburg and is valid all day on local and regional trains across Germany. It is a monthly subscription: cancel it by the 10th of a month and it ends with that month, so you can keep it only for the months you travel.',
    fromMinor: 3400,
    toMinor: 2200,
    per: 'month',
    source:
      'Estimate (assumes one Bayern-Ticket day in the month). Deutsche Bahn, Bayern-Ticket: 1 person, 2nd class, one day, €34',
    url: 'https://www.bahn.de/angebot/regio/laender-tickets/bayern-ticket',
    toSource:
      'RVV, semester ticket: from 1 Oct 2026 the Regensburg student surcharge for the Deutschlandticket is €22.00 a month; a monthly subscription, cancelled by the 10th of the month',
    toUrl: 'https://www.rvv.de/semesterticket',
    checked: CHECKED,
    tipId: 'upgrade-to-deutschlandticket',
    estimate: true,
  },
];
