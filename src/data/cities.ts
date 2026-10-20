import type { IsoDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';

/** Typical monthly spend for one category, in EUR cents. */
export type CityRange = {
  categoryId: string;
  minMinor: Minor;
  maxMinor: Minor;
  source: string;
  url: string;
  checked: IsoDate;
};

/** A single price a student will meet, in EUR cents. */
export type CityPrice = { label: string; minor: Minor; source: string; url: string; checked: IsoDate };

export type City = { id: 'regensburg'; name: 'Regensburg'; ranges: CityRange[]; prices: CityPrice[] };

const CHECKED: IsoDate = '2026-10-16';

/**
 * How the flexible ranges are built (all EUR cents, monthly):
 *
 * DSW rows: 22nd Sozialerhebung (survey summer semester 2021), Table 4.3, p. 104, "Fokus-Typ" =
 * full-time, unmarried first-degree students who do not live with their parents. Those are national
 * means, so each is scaled to September 2026 prices with Destatis CPI (2020 = 100) and then turned
 * into a range of -30% / +30%, rounded to the nearest EUR 5. The 30% spread is our assumption: DSW
 * publishes means, not ranges.
 *   food      Ernährung             194 x 136.6 / 103.1 (food prices: 2021 average -> Sep 2026) = 257
 *   shopping  Kleidung               40 x 126.6 / 103.1 (all items:    2021 average -> Sep 2026) =  49
 *   other     Weitere Ausgaben      109 x 126.6 / 103.1 (all items) = 134
 * CPI: 2021 averages from https://www.destatis.de/DE/Themen/Wirtschaft/Konjunkturindikatoren/Basisdaten/vpi141a.html
 * (all items 103.1, food 103.1); September 2026 from
 * https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/10/PD26_364_611.html (all items 126.6, food 136.6).
 * DSW "Ernährung" is all food spending and is not split into groceries and eating out, so the food
 * range is on the generous side for groceries alone.
 *
 * Estimates (no source gives the number, so each is built from the cited price points):
 *   eating-out  8 to 20 Mensa lunches at EUR 3.80 (EUR 30), plus up to 4 meals out at about EUR 14.50 (Numbeo, inexpensive
 *               restaurant, https://www.numbeo.com/cost-of-living/in/Regensburg), EUR 135 in total
 *   going-out   2 to 6 nights out at about EUR 15 to 20 each (beers at EUR 3.75 per Numbeo; club tickets, see club entry)
 *   club entry  EUR 10: the Regensburg tanzt club night on 2026-11-13 sells tickets from EUR 9; no club publishes a regular door price
 *   transport   the semester fee already includes an RVV ticket, so only extras are left: single rides,
 *               trains home, bike repairs
 *
 * Cross-check for rent: DSW reports a Regensburg mean rent of EUR 390 incl. utilities in 2021
 * (Table A4.26, same PDF), about EUR 479 at 2026 prices, inside the range below.
 *
 * Transport pass, for the "Deutschlandticket / semester ticket" fixed category (https://stwno.de/en/home-en2/semester-contribution-and-tickets/semesterticket-regensburg):
 * the semester fee, EUR 208 in winter 2026/27 (EUR 82 Studierendenwerk plus EUR 126 for the RVV semester ticket, per
 * https://www.uni-regensburg.de/studieren/im-studium/studienorganisation/rueckmeldung and
 * https://www.oth-regensburg.de/studieren/im-studium/formales/rueckmeldung, checked 2026-10-20), already includes an
 * RVV semester ticket. Students can upgrade to the Bavarian discounted Deutschlandticket (EUR 43 a month from
 * 2026-01-01, against EUR 63 for everyone else); the semester ticket is credited, so the upgrade costs the monthly
 * difference, which RVV puts at EUR 22.00 a month from 2026-10-01 (https://www.rvv.de/semesterticket, checked
 * 2026-10-20). The regular Deutschlandticket goes to EUR 66.80 on 2027-01-01; no source gives the Bavarian student
 * price from then on yet.
 */
const DSW_URL = 'https://www.studierendenwerke.de/fileadmin/user_upload/22._Soz_Hauptbericht_barrierefrei.pdf';
const UR_HOUSING_URL = 'https://www.uni-regensburg.de/studieren/rund-ums-studium/wohnen-in-regensburg';
const STWNO_TICKET_URL = 'https://stwno.de/en/home-en2/semester-contribution-and-tickets/semesterticket-regensburg';
// The menu page always shows the current week; the PDFs behind it are replaced every week.
const MENSA_PLAN_URL = 'https://stwno.de/de/gastronomie/speiseplan/uni-regensburg/mensa-ur';
const NUMBEO_URL = 'https://www.numbeo.com/cost-of-living/in/Regensburg';

const regensburg: City = {
  id: 'regensburg',
  name: 'Regensburg',
  ranges: [
    {
      categoryId: 'rent',
      minMinor: 21500,
      maxMinor: 56100,
      source: 'Universität Regensburg: cheapest Studierendenwerk room about €215, WG room €459–561',
      url: UR_HOUSING_URL,
      checked: CHECKED,
    },
    {
      categoryId: 'food',
      minMinor: 18000,
      maxMinor: 33500,
      source: 'DSW 22nd Sozialerhebung 2021, national mean €194 (not Regensburg), scaled to Sep 2026 with Destatis food prices; ±30% spread is our assumption',
      url: DSW_URL,
      checked: CHECKED,
    },
    {
      categoryId: 'eating-out',
      minMinor: 3000,
      maxMinor: 13500,
      source: 'Estimate',
      url: MENSA_PLAN_URL,
      checked: CHECKED,
    },
    {
      categoryId: 'going-out',
      minMinor: 3000,
      maxMinor: 12000,
      source: 'Estimate',
      url: NUMBEO_URL,
      checked: CHECKED,
    },
    {
      categoryId: 'transport',
      minMinor: 1000,
      maxMinor: 6000,
      source: 'Estimate',
      url: STWNO_TICKET_URL,
      checked: CHECKED,
    },
    {
      categoryId: 'shopping',
      minMinor: 3500,
      maxMinor: 6500,
      source: 'DSW 22nd Sozialerhebung 2021, clothing national mean €40 (not Regensburg), scaled to Sep 2026 with the Destatis all-items CPI; ±30% spread is our assumption',
      url: DSW_URL,
      checked: CHECKED,
    },
    {
      categoryId: 'other',
      minMinor: 9500,
      maxMinor: 17500,
      source: 'DSW 22nd Sozialerhebung 2021, other expenses national mean €109 (not Regensburg), scaled to Sep 2026 with the Destatis all-items CPI; ±30% spread is our assumption',
      url: DSW_URL,
      checked: CHECKED,
    },
  ],
  prices: [
    {
      label: 'Mensa main meal (student price)',
      minor: 380,
      source: 'Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg: median student price of the main dishes on the menu in the week 19–23 Oct 2026, a snapshot (the menu page shows the current week)',
      url: MENSA_PLAN_URL,
      checked: CHECKED,
    },
    {
      label: 'Deutschlandticket per month',
      minor: 6300,
      source: 'Deutsche Bahn Deutschland-Ticket FAQ: €63 until 31 Dec 2026, €66.80 from 1 Jan 2027',
      url: 'https://www.bahn.de/faq/gk/angebot/zeitkarten/deutschland-ticket/kauf',
      checked: CHECKED,
    },
    {
      label: 'Beer in a bar (0.5 l)',
      minor: 375,
      source: 'Numbeo, domestic draught beer, Regensburg (crowd-sourced, 15 contributors city-wide, updated 15 Oct 2026)',
      url: NUMBEO_URL,
      checked: CHECKED,
    },
    {
      label: 'Club entry',
      minor: 1000,
      source: 'Estimate',
      url: 'https://regensburgtanzt.ticket.io/?lang=en',
      checked: CHECKED,
    },
    {
      label: 'Gym per month',
      minor: 2990,
      source: 'McFit Regensburg-Reinhausen, 12-month Standard (plus €39 sign-up and €15 twice a year)',
      url: 'https://www.mcfit.com/studio/regensburg-reinhausen',
      checked: CHECKED,
    },
  ],
};

export const CITIES: { regensburg: City } = { regensburg };
