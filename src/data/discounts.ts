import type { IsoDate } from '@/lib/dates';

/**
 * A student discount at a Regensburg place, with where it is stated. `offer` is what you get and `conditions` who
 * gets it and when (student ID, age, days, times). Facts only: no ratings.
 */
export type Discount = {
  id: string;
  place: string;
  /** Street, postcode and city, as the place gives it. */
  address: string;
  offer: string;
  conditions: string;
  categoryId: string;
  source: string;
  url: string;
  checked: IsoDate;
};

const CHECKED: IsoDate = '2026-10-20';

const STADTWERK = 'das Stadtwerk Regensburg';
const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';
/** The das Stadtwerk pools and the ice rink all set the student rate this way. */
const STADTWERK_STUDENTS =
  'Students aged 15 until their 25th birthday, with valid proof such as a student ID (and an official photo ID if asked) shown at the entrance.';

/**
 * Regensburg student discounts, seeded by hand. Every one is stated on the place's own page, or on a
 * Studierendenwerk or university page, opened on the checked date. No alcohol deals: a place's drink offers are
 * left out even when its other offers are in.
 *
 * Left out on purpose: offers no own page states (CinemaxX's student price, escape rooms, bars), places outside
 * the city (DAV Kletterzentrum in Lappersdorf, Walhalla in Donaustauf), places that are closed (Wöhrdbad,
 * Naturkundemuseum Ostbayern), offers whose page is unclear about the amount (Statt-Theater) or years old
 * (a 2024 restaurant post).
 */
export const DISCOUNTS: readonly Discount[] = [
  {
    id: 'asia-restaurant-sunrise',
    place: 'Asia Restaurant Sunrise',
    address: 'Von-Seeckt-Straße 23, 93053 Regensburg',
    offer: '10% off',
    conditions: 'Students, every day, on showing a student ID. Not combined with other offers or discounts.',
    categoryId: 'eating-out',
    source: 'Asia Restaurant Sunrise, home page: 10% off for students, Mon–Sun, on showing a student ID; not combined with other offers or discounts',
    url: 'https://sunrise-regensburg.de/',
    checked: CHECKED,
  },
  {
    id: 'mensa-childrens-plate',
    place: 'Mensa Uni Regensburg',
    address: 'Albertus-Magnus-Straße 2, 93053 Regensburg',
    offer: "A free children's plate for your child, up to their sixth year",
    conditions:
      "For student parents who also have lunch in the Mensa (the university canteen), with a children's-plate Mensa card. You get it at the Mensa card office (Info-Punkt) with a copy of the child's birth certificate and your certificate of enrolment.",
    categoryId: 'eating-out',
    source: `${STWNO}, Mensa Uni Regensburg: children of students get a free children's plate up to their sixth year when the parent also has lunch in the Mensa, with a Kinderteller Mensa card from the Mensa card office`,
    url: 'https://stwno.de/de/gastronomie/mensen/mensa-uni-regensburg',
    checked: CHECKED,
  },
  {
    id: 'kinos-im-andreasstadel',
    place: 'Kinos im Andreasstadel',
    address: 'Andreasstraße 28, 93059 Regensburg',
    offer: '€8 instead of €9 per ticket',
    conditions:
      'Students, with valid proof. Special screenings may be priced differently. Booking online in advance adds 10%; reserving a seat is free.',
    categoryId: 'going-out',
    source: 'Kinos im Andreasstadel, ticket prices: €9 regular, €8 reduced for students with valid proof; online advance sale adds 10%; reservations are free; prices for special screenings may differ',
    url: 'https://www.kinos-im-andreasstadel.de/Eintrittspreise/unterseite_7311',
    checked: CHECKED,
  },
  {
    id: 'staatstheater-regensburg',
    place: 'Staatstheater Regensburg',
    address: 'Bismarckplatz 7, 93047 Regensburg',
    offer: 'Half price on regular tickets, and any seat for €10 at shows marked U30 (under 30)',
    conditions:
      "Students until their 30th birthday, for tickets in general sale. U30 shows are on selected dates. Show your proof with your ticket at the entrance. Online or by phone there is a €1.50 fee per ticket; at the theatre's box office or evening box office there is none.",
    categoryId: 'going-out',
    source: 'Staatstheater Regensburg, visitor FAQ: 50% off the regular price in general sale (Freiverkauf) for students until their 30th birthday; U30 shows on selected dates, €10 for any seat; €1.50 fee per ticket online or by phone, none at the box office or evening box office',
    url: 'https://www.staatstheater-regensburg.de/index/besuch.html',
    checked: CHECKED,
  },
  {
    id: 'regensburger-turmtheater',
    place: 'Regensburger Turmtheater',
    address: 'Watmarkt 5, 93047 Regensburg',
    offer: '€16 instead of €32 for regular shows',
    conditions: 'Students, pupils and trainees. A show with other prices says so in its description.',
    categoryId: 'going-out',
    source: 'Regensburger Turmtheater, tickets: regular shows €32; pupils, students and trainees 50% off (€16); other prices are given in the show descriptions',
    url: 'https://regensburgerturmtheater.de/karten/',
    checked: CHECKED,
  },
  {
    id: 'kunstforum-ostdeutsche-galerie',
    place: 'Kunstforum Ostdeutsche Galerie',
    address: 'Dr.-Johann-Maier-Str. 5, 93049 Regensburg',
    offer: '€4 instead of €6 entry',
    conditions: 'Students, pupils and trainees.',
    categoryId: 'going-out',
    source: 'Kunstforum Ostdeutsche Galerie, your visit: entry €6, reduced €4; pupils, students and trainees are on the list of those who pay the reduced price',
    url: 'https://www.kunstforum.net/ihr-besuch',
    checked: CHECKED,
  },
  {
    id: 'document-kepler',
    place: 'document Kepler',
    address: 'Keplerstraße 5, 93047 Regensburg',
    offer: 'Free entry instead of €5',
    conditions: 'Students under 30. Public guided tours are priced separately.',
    categoryId: 'going-out',
    source: 'Museen der Stadt Regensburg, document Kepler: adults €5; free for students under 30; public guided tours €8, reduced €5',
    url: 'https://www.regensburg.de/museen/die-museen/documente/document-kepler',
    checked: CHECKED,
  },
  {
    id: 'schloss-thurn-und-taxis',
    place: 'Schloss Thurn und Taxis',
    address: 'Emmeramsplatz 5, 93047 Regensburg',
    offer:
      '€14 instead of €17 for the guided tour of the state rooms; €4 instead of €6 for the Treasury and the Marstall (carriage museum)',
    conditions: 'Students, on showing a student ID. The state rooms are open only on a guided tour.',
    categoryId: 'going-out',
    source: 'Fürst Thurn und Taxis, visiting Schloss St. Emmeram: guided tour €17, reduced €14; Treasury and Marstall €6, reduced €4; reduced for pupils and students on showing their ID',
    url: 'https://www.thurnundtaxis.de/entdecken/besuch-schloss-st-emmeram',
    checked: CHECKED,
  },
  {
    id: 'westbad',
    place: 'Westbad',
    address: 'Messerschmittstraße 4, 93049 Regensburg',
    offer: '€4.60 instead of €7.20 for 3 hours; €6.50 instead of €10 for the day',
    conditions: `${STADTWERK_STUDENTS} Proof brought later is not accepted.`,
    categoryId: 'going-out',
    source: `${STADTWERK}, Westbad prices: 3 hours €7.20, day €10.00; reduced €4.60 and €6.50 for pupils, students and trainees from 15 until their 25th birthday`,
    url: 'https://das-stadtwerk-regensburg.de/westbad/preise-oeffnungszeiten',
    checked: CHECKED,
  },
  {
    id: 'sportpark-ost-pool',
    place: 'Sportpark Ost pool',
    address: 'Zeißstraße 61, 93053 Regensburg',
    offer: '€2.90 instead of €5 per visit',
    conditions: STADTWERK_STUDENTS,
    categoryId: 'going-out',
    source: `${STADTWERK}, Sportpark Ost pool prices: single entry €5.00, reduced €2.90 for pupils, students and trainees from 15 until their 25th birthday`,
    url: 'https://das-stadtwerk-regensburg.de/sportpark-ost-bad/preise-oeffnungszeiten',
    checked: CHECKED,
  },
  {
    id: 'donau-arena-skating',
    place: 'Donau-Arena',
    address: 'Walhalla-Allee 24, 93059 Regensburg',
    offer: '€5 instead of €6 for public ice skating; €6 instead of €7 for disco skating (Discolauf)',
    conditions: `${STADTWERK_STUDENTS} In the skating season only.`,
    categoryId: 'going-out',
    source: `${STADTWERK}, Donau-Arena public skating prices: single entry €6, reduced €5; Discolauf €7, reduced €6; reduced for pupils, students and trainees from 15 until their 25th birthday`,
    url: 'https://www.das-stadtwerk-regensburg.de/donau-arena/eislauf/preise-oeffnungszeiten',
    checked: CHECKED,
  },
  {
    id: 'boulderwelt-studi-monday',
    place: 'Boulderwelt Regensburg',
    address: 'Im Gewerbepark A46, 93059 Regensburg',
    offer: 'A day entry for €9.90 on Mondays ("Studi Monday")',
    conditions: 'Students and trainees with valid proof. All day on Mondays, not on public holidays. Shoe rental costs extra.',
    categoryId: 'going-out',
    source: 'Boulderwelt Regensburg, prices: Studi Monday, a €9.90 day entry on Mondays all day for students and trainees with valid proof; not on public holidays; shoes rented at the counter for a fee',
    url: 'https://www.boulderwelt-regensburg.de/preise/',
    checked: CHECKED,
  },
  {
    id: 'super-bowl-student-tuesday',
    place: 'Super Bowl Regensburg',
    address: 'Gewerbepark D 44, 93059 Regensburg',
    offer: 'Bowling for €1 per game on Tuesdays',
    conditions: 'Pupils and students.',
    categoryId: 'going-out',
    source: 'Super Bowl Regensburg, offers: on Tuesdays pupils and students pay €1 per game ("Studenten Bowling")',
    url: 'https://superbowl.de/aktionen/',
    checked: CHECKED,
  },
  {
    id: 'alnatura-student-tuesday',
    place: 'Alnatura Super Natur Markt',
    address: 'Dr.-Martin-Luther-Straße 2, 93047 Regensburg',
    offer: '8% off your whole purchase on Tuesdays',
    conditions:
      'Students with a valid student ID, in every Alnatura store (in Regensburg also Donaustaufer Straße 128 and Joseph-Dahlem-Straße 3). Not on bottle deposits (Pfand), gift cards, books or infant formula, and not with other discounts.',
    categoryId: 'food',
    source: "Alnatura, student discount: every Tuesday 8% off the whole purchase for students, trainees and pupils with a valid ID, in all Alnatura stores; not on deposits, gift cards, books or infant formula, and not combined with other discounts. Alnatura's store finder lists the Regensburg stores at Dr.-Martin-Luther-Straße 2, Donaustaufer Straße 128 and Joseph-Dahlem-Straße 3",
    url: 'https://www.alnatura.de/de-de/maerkte/studirabatt/',
    checked: CHECKED,
  },
  {
    id: 'bellas-kunst-student-haircut',
    place: "Bella's Kunst",
    address: 'Alte Manggasse 2, 93047 Regensburg',
    offer: "Men's student haircut: €30 instead of €36",
    conditions:
      "Students. The price list states no other conditions. There is also a women's student haircut at €57, while the other women's cuts cost €48 to €70.",
    categoryId: 'personal-care',
    source: "Bella's Kunst, price list: men's haircut €36, student haircut €30; women's student haircut €57; other women's cuts €48 (Schnitt Spezial), €52 (short), €65 (to shoulder length), €70 (long)",
    url: 'https://bellaskunst.de/',
    checked: CHECKED,
  },
  {
    id: 'stadtbuecherei-library-card',
    place: 'Stadtbücherei Regensburg',
    address: 'Haidplatz 8, 93047 Regensburg',
    offer: "€10 instead of €17 for a year's library card",
    conditions: 'Students, on showing a student ID when the card is made or renewed.',
    categoryId: 'study',
    source: "Stadt Regensburg, Stadtbücherei rules of use and fees: a year's card €17 for adults, €10 reduced for students, trainees and pupils; proof such as a student ID when the card is made or renewed",
    url: 'https://www.regensburg.de/stadtrecht/233972/benutzungsordnung-und-entgeltregelung-fuer-die-stadtbuecherei-regensburg-benutzungsordnung-stadtbuecherei-buebo-vom-24-juli-2008.html',
    checked: CHECKED,
  },
  {
    id: 'vhs-course-fees',
    place: 'Volkshochschule Regensburg',
    address: 'Haidplatz 8, 93047 Regensburg',
    offer: '10% off course fees at the adult education centre',
    conditions:
      'Enrolled students, on request: show proof in person, or send a copy with the course number, at least one week before the course starts. Not combined with other reductions, not for courses the VHS only co-organises, and the VHS can exclude a course from reductions.',
    categoryId: 'other',
    source: 'Volkshochschule Regensburg, terms and conditions: 10% off for enrolled students on application, with proof at least one week before the course starts; reductions are not combined; not for events the VHS only co-organises, and the VHS can exclude reductions',
    url: 'https://www.vhs-regensburg.de/agb',
    checked: CHECKED,
  },
];
