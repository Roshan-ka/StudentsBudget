// The Regensburg data the AI may quote, and the app categories, written from src/data by
// scripts/write-city-pack.mjs: do not edit by hand. Run `node scripts/write-city-pack.mjs` after changing src/data;
// src/features/ai/server/city-pack.test.ts fails while this file is stale.

import type { PackCategory, PackItem } from './pack.ts';

export const CITY_PACK: readonly PackItem[] = [
  {
    "id": "range:rent",
    "kind": "range",
    "categoryId": "rent",
    "text": "Rent in Regensburg: €215–€561 a month.",
    "source": "Universität Regensburg: cheapest Studierendenwerk room about €215, WG room €459–561",
    "checked": "2026-10-16",
    "estimate": false
  },
  {
    "id": "range:food",
    "kind": "range",
    "categoryId": "food",
    "text": "Food & groceries in Regensburg: €180–€335 a month.",
    "source": "DSW 22nd Sozialerhebung 2021, national mean €194 (not Regensburg), scaled to Sep 2026 with Destatis food prices; ±30% spread is our assumption",
    "checked": "2026-10-16",
    "estimate": false
  },
  {
    "id": "range:eating-out",
    "kind": "range",
    "categoryId": "eating-out",
    "text": "Eating out in Regensburg: €30–€135 a month.",
    "source": "Estimate",
    "checked": "2026-10-16",
    "estimate": true
  },
  {
    "id": "range:going-out",
    "kind": "range",
    "categoryId": "going-out",
    "text": "Going out in Regensburg: €30–€120 a month.",
    "source": "Estimate",
    "checked": "2026-10-16",
    "estimate": true
  },
  {
    "id": "range:transport",
    "kind": "range",
    "categoryId": "transport",
    "text": "Transport in Regensburg: €10–€60 a month.",
    "source": "Estimate",
    "checked": "2026-10-16",
    "estimate": true
  },
  {
    "id": "range:shopping",
    "kind": "range",
    "categoryId": "shopping",
    "text": "Shopping in Regensburg: €35–€65 a month.",
    "source": "DSW 22nd Sozialerhebung 2021, clothing national mean €40 (not Regensburg), scaled to Sep 2026 with the Destatis all-items CPI; ±30% spread is our assumption",
    "checked": "2026-10-16",
    "estimate": false
  },
  {
    "id": "range:other",
    "kind": "range",
    "categoryId": "other",
    "text": "Other in Regensburg: €95–€175 a month.",
    "source": "DSW 22nd Sozialerhebung 2021, other expenses national mean €109 (not Regensburg), scaled to Sep 2026 with the Destatis all-items CPI; ±30% spread is our assumption",
    "checked": "2026-10-16",
    "estimate": false
  },
  {
    "id": "price:mensa-main-meal-student-price",
    "kind": "price",
    "categoryId": null,
    "text": "Mensa main meal (student price) in Regensburg: €3.80.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg: median student price of the main dishes on the menu in the week 19–23 Oct 2026, a snapshot (the menu page shows the current week)",
    "checked": "2026-10-16",
    "estimate": false
  },
  {
    "id": "price:club-entry",
    "kind": "price",
    "categoryId": null,
    "text": "Club entry in Regensburg: €10.",
    "source": "Estimate",
    "checked": "2026-10-16",
    "estimate": true
  },
  {
    "id": "price:gym-per-month",
    "kind": "price",
    "categoryId": null,
    "text": "Gym per month in Regensburg: €29.90.",
    "source": "McFit Regensburg-Reinhausen, 12-month Standard (plus €39 sign-up and €15 twice a year)",
    "checked": "2026-10-16",
    "estimate": false
  },
  {
    "id": "tip:cafeteria-surprise-bags",
    "kind": "tip",
    "categoryId": "food",
    "text": "Food & groceries tip: Grab a cafeteria surprise bag. Cafeterias Milchbar, Sammelgebäude (UR) and Architektur (OTH) sell leftovers cheaply via Too Good To Go in the last 30 minutes.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, food waste page: surprise bags via Too Good To Go in the last 30 minutes at the Milchbar, Sammelgebäude and Architektur cafeterias, not every day",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:eat-at-the-mensa",
    "kind": "tip",
    "categoryId": "eating-out",
    "text": "Eating out tip: Eat at the Mensa. Main dishes at the Uni Regensburg Mensa start at €2.30 for students. Guests pay €6.10 for the same plate.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg menu: the cheapest main dish was €2.30 for students, €3.30 for staff and €6.10 for guests on every weekday of 19–30 Oct 2026 (the menu changes daily)",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:tap-your-student-id",
    "kind": "tip",
    "categoryId": "eating-out",
    "text": "Eating out tip: Tap your student ID at the till. Paying by card or phone? Also put your student ID on the till terminal, or you are charged the higher price.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg page: the tills take no cash; put the Mensa card or student ID on the terminal as well to get the student price",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:theatre-at-half-price",
    "kind": "tip",
    "categoryId": "going-out",
    "text": "Going out tip: See a play at half price. Students under 30 pay half price at the Staatstheater; U30 shows are €10 for any seat. Buy at the box office to skip the €1.50 fee.",
    "source": "Staatstheater Regensburg, visitor FAQ: 50% off the regular price until the 30th birthday; U30 shows €10 for any seat; €1.50 fee per ticket online or by phone, none at the box office",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:historisches-museum-free",
    "kind": "tip",
    "categoryId": "going-out",
    "text": "Going out tip: Visit the Historisches Museum free. Students under 30 get into the city's Historisches Museum for free (adults pay €5). Bring your student ID.",
    "source": "Museen der Stadt Regensburg, Historisches Museum: adults €5; free for students under 30 with ID, and for everyone on the first Sunday of the month",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:hdbg-museum-free",
    "kind": "tip",
    "categoryId": "going-out",
    "text": "Going out tip: Visit the Bavarian history museum free. Students under 30 get into the Haus der Bayerischen Geschichte for free (adults pay €7), including the 2026/27 Bayernausstellung.",
    "source": "Haus der Bayerischen Geschichte, admission prices valid 8 Jul 2026 to 7 Aug 2027: adults €7, students under 30 free",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:cinema-student-price",
    "kind": "tip",
    "categoryId": "going-out",
    "text": "Going out tip: Reserve cinema tickets for free. At Kinos im Andreasstadel students pay €8 instead of €9. Reserve for free rather than buying online, which adds 10%.",
    "source": "Kinos im Andreasstadel, ticket prices: €9 regular, €8 reduced for students with proof; online advance sale adds 10%; reservations are free",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:register-in-person",
    "kind": "tip",
    "categoryId": "going-out",
    "text": "Going out tip: Register in person for free vouchers. Register your main residence in person at a Bürgerbüro: the welcome package includes vouchers for a city tour and a theatre visit.",
    "source": "Stadt Regensburg, welcome package: handed out when you register in person; with a main residence it includes vouchers for a city tour and a theatre visit",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:campus-bike-repair",
    "kind": "tip",
    "categoryId": "transport",
    "text": "Transport tip: Fix your bike at Campus Bike Repair. A mobile bike workshop with tools and patch kits comes to the UR campus every week. Bring special parts yourself.",
    "source": "Universität Regensburg, UR Health \"Move\": the mobile workshop Campus Bike Repair comes to campus weekly with tools and patch material; special parts are not provided",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:fashion-for-free",
    "kind": "tip",
    "categoryId": "shopping",
    "text": "Shopping tip: Get clothes at Fashion for Free. The Studierendenwerk runs a free clothes swap every semester, and you don't need to bring clothes. Its news page has the next Regensburg date.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, news \"Fashion for free im STWNO\" (6 Aug 2026): free for everyone, no donation needed, every semester; in Regensburg on 9 Dec 2026 in the guest Mensa hall at UR",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:free-psychological-counselling",
    "kind": "tip",
    "categoryId": "health",
    "text": "Health & pharmacy tip: Use free psychological counselling. The Studierendenwerk offers free one-to-one counselling in German or English, in person, by phone or by video.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, psychological counselling: free short- and medium-term one-to-one counselling in person, by phone or video, in German and English",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:borrow-course-books",
    "kind": "tip",
    "categoryId": "study",
    "text": "Study materials tip: Borrow course books, don't buy them. Borrow core textbooks from the Lehrbuchsammlung in the UR central library for four weeks, renewable up to 12 weeks.",
    "source": "Universität Regensburg library, borrowing print media: textbook collection loans for four weeks, extendable to 12 weeks",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:scan-for-free",
    "kind": "tip",
    "categoryId": "study",
    "text": "Study materials tip: Scan library books for free. Scan reading-room books for free at the UR library's book scanners and save them to your own USB stick.",
    "source": "Universität Regensburg library, borrowing print media, reading rooms: scanning at the book scanners is free, saved to your own USB stick",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:day-trips-on-the-semester-ticket",
    "kind": "tip",
    "categoryId": "travel",
    "text": "Travel tip: Take day trips on the semester ticket. Since winter 2026/27 the semester ticket again covers trains from Regensburg up to Neustadt an der Donau, at no extra cost.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, semester ticket Regensburg: from winter semester 2026/27 the rail section Sinzing/Riegling to Neustadt a. d. Donau is back in the ticket area",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:studienstarthilfe",
    "kind": "tip",
    "categoryId": "other",
    "text": "Other tip: Claim the €1,000 study start grant. First-year, under 25 and on benefits such as Bürgergeld or Wohngeld? Apply for a one-off €1,000 grant by the end of the month after you start.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, BAföG Studienstarthilfe: a one-off €1,000 grant, not repaid, for first-time full-time students under 25 who receive social benefits; apply via BAföG Digital by the end of the month after the start",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:apply-for-a-dorm-room",
    "kind": "tip",
    "categoryId": "rent",
    "text": "Rent tip: Apply for a Studierendenwerk room. The cheapest dorm rooms cost about €215 a month; a WG room averages €459–561. You can apply online at any time.",
    "source": "Universität Regensburg, living in Regensburg: the cheapest Studierendenwerk rooms cost about €215; an average WG room €459–561 (Moses Mendelssohn Institut, Sept 2026); no application deadline",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:check-wohngeld",
    "kind": "tip",
    "categoryId": "rent",
    "text": "Rent tip: Check if Wohngeld applies to you. No BAföG entitlement in principle, e.g. past the age limit? Wohngeld may help with rent if Regensburg is your main residence.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Wohngeld: possible only without a BAföG entitlement in principle, and the study town must be the main residence",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:free-tenancy-advice",
    "kind": "tip",
    "categoryId": "rent",
    "text": "Rent tip: Get free tenancy-law advice. Problems with your landlord? Student counselling at the Studierendenwerk refers you to the local Mieterverein for free advice.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, tenancy-law advice: free advice from the local Mieterverein in Regensburg, by referral from student counselling",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:stay-on-family-insurance",
    "kind": "tip",
    "categoryId": "insurance",
    "text": "Insurance tip: Stay on family health insurance. Free cover on a parent's public health insurance lasts until you turn 25 if you earn under €565 a month (€603 in a minijob, 2026).",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, health and care insurance: free family insurance until the 25th birthday; in 2026 up to €565 a month from a regular job or €603 from a minijob",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:software-from-campus-it",
    "kind": "tip",
    "categoryId": "subscriptions",
    "text": "Subscriptions tip: Get Office through the university. Before paying for Office 365 or SPSS, check the UR Campus IT software offer: campus licences are free or discounted for students.",
    "source": "Universität Regensburg Campus IT, software: campus licences free or at special prices; students get discounts on software such as SPSS and Office 365",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:ride-on-your-semester-ticket",
    "kind": "tip",
    "categoryId": "transport-pass",
    "text": "Deutschlandticket / semester ticket tip: Ride the RVV on your semester ticket. Your semester fee already includes €126 for unlimited RVV bus and train rides. Your student ID plus photo ID is the ticket.",
    "source": "RVV, semester ticket: a compulsory €126 per semester for unlimited rides in the whole RVV area; the ticket is the student ID plus ID card or passport",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:upgrade-to-deutschlandticket",
    "kind": "tip",
    "categoryId": "transport-pass",
    "text": "Deutschlandticket / semester ticket tip: Upgrade to Deutschlandticket for €22. The upgrade costs €22 a month on top of your semester ticket. Book it for months you travel; cancel by the 10th for the next month.",
    "source": "RVV, semester ticket: from 1 Oct 2026 the Regensburg student surcharge is €22.00 a month; a monthly subscription, cancelled by the 10th of the month",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:try-university-sport",
    "kind": "tip",
    "categoryId": "gym",
    "text": "Gym & sports tip: Try university sport before a gym. URsport at the UR Sportzentrum has a gym, pool, sauna and courses at a student rate for UR and OTH students. Compare before you sign up.",
    "source": "Universität Regensburg Sportzentrum, URsport platform: UR and OTH students sign in and buy at the student rate; gym, pool and sauna through the app",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:split-the-rundfunkbeitrag",
    "kind": "tip",
    "categoryId": "utilities",
    "text": "Utilities & Rundfunkbeitrag tip: Share one Rundfunkbeitrag per flat. The fee is €18.36 a month per flat, not per person. In a WG one person registers and you split it; the others deregister.",
    "source": "ARD ZDF Deutschlandradio Beitragsservice, information for students: €18.36 a month per flat; only one adult per flat registers and pays",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "tip:rundfunkbeitrag-bafoeg-exemption",
    "kind": "tip",
    "categoryId": "utilities",
    "text": "Utilities & Rundfunkbeitrag tip: Apply for a Rundfunkbeitrag exemption. If you get BAföG and do not live with your parents, apply for an exemption from the €18.36 monthly fee. It is not automatic.",
    "source": "ARD ZDF Deutschlandradio Beitragsservice, information for students: BAföG recipients who do not live with their parents can be exempted on application",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:asia-restaurant-sunrise",
    "kind": "discount",
    "categoryId": "eating-out",
    "text": "Eating out discount: Asia Restaurant Sunrise, Von-Seeckt-Straße 23, 93053 Regensburg: 10% off. Students, every day, on showing a student ID. Not combined with other offers or discounts.",
    "source": "Asia Restaurant Sunrise, home page: 10% off for students, Mon–Sun, on showing a student ID; not combined with other offers or discounts",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:mensa-childrens-plate",
    "kind": "discount",
    "categoryId": "eating-out",
    "text": "Eating out discount: Mensa Uni Regensburg, Albertus-Magnus-Straße 2, 93053 Regensburg: A free children's plate for your child, up to their sixth year. For student parents who also have lunch in the Mensa (the university canteen), with a children's-plate Mensa card. You get it at the Mensa card office (Info-Punkt) with a copy of the child's birth certificate and your certificate of enrolment.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg: children of students get a free children's plate up to their sixth year when the parent also has lunch in the Mensa, with a Kinderteller Mensa card from the Mensa card office",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:kinos-im-andreasstadel",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Kinos im Andreasstadel, Andreasstraße 28, 93059 Regensburg: €8 instead of €9 per ticket. Students, with valid proof. Special screenings may be priced differently. Booking online in advance adds 10%; reserving a seat is free.",
    "source": "Kinos im Andreasstadel, ticket prices: €9 regular, €8 reduced for students with valid proof; online advance sale adds 10%; reservations are free; prices for special screenings may differ",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:staatstheater-regensburg",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Staatstheater Regensburg, Bismarckplatz 7, 93047 Regensburg: Half price on regular tickets, and any seat for €10 at shows marked U30 (under 30). Students until their 30th birthday, for tickets in general sale. U30 shows are on selected dates. Show your proof with your ticket at the entrance. Online or by phone there is a €1.50 fee per ticket; at the theatre's box office or evening box office there is none.",
    "source": "Staatstheater Regensburg, visitor FAQ: 50% off the regular price in general sale (Freiverkauf) for students until their 30th birthday; U30 shows on selected dates, €10 for any seat; €1.50 fee per ticket online or by phone, none at the box office or evening box office",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:regensburger-turmtheater",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Regensburger Turmtheater, Watmarkt 5, 93047 Regensburg: €16 instead of €32 for regular shows. Students, pupils and trainees. A show with other prices says so in its description.",
    "source": "Regensburger Turmtheater, tickets: regular shows €32; pupils, students and trainees 50% off (€16); other prices are given in the show descriptions",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:kunstforum-ostdeutsche-galerie",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Kunstforum Ostdeutsche Galerie, Dr.-Johann-Maier-Str. 5, 93049 Regensburg: €4 instead of €6 entry. Students, pupils and trainees.",
    "source": "Kunstforum Ostdeutsche Galerie, your visit: entry €6, reduced €4; pupils, students and trainees are on the list of those who pay the reduced price",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:document-kepler",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: document Kepler, Keplerstraße 5, 93047 Regensburg: Free entry instead of €5. Students under 30, on showing an ID. Public guided tours are priced separately.",
    "source": "Museen der Stadt Regensburg, document Kepler: adults €5; free for students under 30 on showing an ID; public guided tours €8, reduced €5",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:schloss-thurn-und-taxis",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Schloss Thurn und Taxis, Emmeramsplatz 5, 93047 Regensburg: €14 instead of €17 for the guided tour of the state rooms and cloister; €4 instead of €6 for the Treasury and the Marstall (carriage museum). Students, on showing a student ID. The state rooms are open only on a guided tour.",
    "source": "Fürst Thurn und Taxis, visiting Schloss St. Emmeram: guided tour of the state rooms and cloister (Prunkräume & Kreuzgang) €17, reduced €14; Treasury and Marstall €6, reduced €4; reduced for pupils and students on showing their ID",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:westbad",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Westbad, Messerschmittstraße 4, 93049 Regensburg: €4.60 instead of €7.20 for 3 hours; €6.50 instead of €10 for the day. Students aged 15 until their 25th birthday, with valid proof such as a student ID (and an official photo ID if asked) shown at the entrance. Proof brought later is not accepted.",
    "source": "das Stadtwerk Regensburg, Westbad prices: 3 hours €7.20, day €10.00; reduced €4.60 and €6.50 for pupils, students and trainees from 15 until their 25th birthday; proof at the entrance, not later",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:sportpark-ost-pool",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Sportpark Ost pool, Zeißstraße 61, 93053 Regensburg: €2.90 instead of €5 per visit. Students aged 15 until their 25th birthday, with valid proof such as a student ID (and an official photo ID if asked) shown at the entrance. Proof brought later is not accepted.",
    "source": "das Stadtwerk Regensburg, Sportpark Ost pool prices: single entry €5.00, reduced €2.90 for pupils, students and trainees from 15 until their 25th birthday; proof at the entrance, not later",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:donau-arena-skating",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Donau-Arena, Walhalla-Allee 24, 93059 Regensburg: €5 instead of €6 for public ice skating; €6 instead of €7 for disco skating (Discolauf). Students aged 15 until their 25th birthday, with valid proof such as a student ID (and an official photo ID if asked) shown at the entrance. Proof brought later is not accepted. In the skating season only.",
    "source": "das Stadtwerk Regensburg, Donau-Arena public skating prices: single entry €6, reduced €5; Discolauf €7, reduced €6; reduced for pupils, students and trainees from 15 until their 25th birthday; proof at the entrance, not later",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:boulderwelt-studi-monday",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Boulderwelt Regensburg, Im Gewerbepark A46, 93059 Regensburg: A day entry for €9.90 on Mondays (\"Studi Monday\"). Students and trainees with valid proof. All day on Mondays, not on public holidays. Shoe rental costs extra.",
    "source": "Boulderwelt Regensburg, prices: Studi Monday, a €9.90 day entry on Mondays all day for students and trainees with valid proof; not on public holidays; shoes rented at the counter for a fee",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:super-bowl-student-tuesday",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Super Bowl Regensburg, Gewerbepark D 44, 93059 Regensburg: Bowling for €1 per game on Tuesdays. Pupils and students.",
    "source": "Super Bowl Regensburg, offers: on Tuesdays pupils and students pay €1 per game (\"Studenten Bowling\")",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:alnatura-student-tuesday",
    "kind": "discount",
    "categoryId": "food",
    "text": "Food & groceries discount: Alnatura Super Natur Markt, Dr.-Martin-Luther-Straße 2, 93047 Regensburg: 8% off your whole purchase on Tuesdays. Students with a valid student or pupil ID shown at the till, in every Alnatura store (in Regensburg also Donaustaufer Straße 128 and Joseph-Dahlem-Straße 3). Not on bottle deposits (Pfand), gift cards, books or infant formula, and not with other discounts.",
    "source": "Alnatura, student discount: every Tuesday 8% off the whole purchase for students, trainees and pupils with a valid student or pupil ID, in all Alnatura stores; not on deposits, gift cards, books or infant formula, and not combined with other discounts. Alnatura's store finder lists the Regensburg stores at Dr.-Martin-Luther-Straße 2, Donaustaufer Straße 128 and Joseph-Dahlem-Straße 3",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:bellas-kunst-student-haircut",
    "kind": "discount",
    "categoryId": "personal-care",
    "text": "Personal care discount: Bella's Kunst, Alte Manggasse 2, 93047 Regensburg: Men's student haircut: €30 instead of €36. Students. The price list states no other conditions. There is also a women's student haircut at €57, while the other women's cuts cost €48 to €70.",
    "source": "Bella's Kunst, price list: men's haircut €36, student haircut €30; women's student haircut €57; other women's cuts €48 (Schnitt Spezial), €52 (short), €65 (to shoulder length), €70 (long)",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:stadtbuecherei-library-card",
    "kind": "discount",
    "categoryId": "study",
    "text": "Study materials discount: Stadtbücherei Regensburg, Haidplatz 8, 93047 Regensburg: €10 instead of €17 for a year's library card. Students, on showing a student ID when the card is made or renewed.",
    "source": "Stadt Regensburg, Stadtbücherei fees: a year's card €17 for adults, €10 reduced; the rules of use it points to give the reduced card to students, trainees and pupils, on proof such as a student ID when the card is made or renewed",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "discount:vhs-course-fees",
    "kind": "discount",
    "categoryId": "other",
    "text": "Other discount: Volkshochschule Regensburg, Haidplatz 8, 93047 Regensburg: 10% off course fees at the adult education centre. Regularly enrolled students, on request: show proof in person, or send a copy with the course number, at least one week before the course starts. Not combined with other reductions, not for courses the VHS only co-organises, and the VHS may exclude reductions.",
    "source": "Volkshochschule Regensburg, terms and conditions: 10% off for regularly enrolled students (ordentlich Studierende) on application, with proof at least one week before the course starts; reductions are not combined; not for events the VHS only co-organises, and the VHS may exclude reductions",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "swap:mensa-instead-of-restaurant",
    "kind": "swap",
    "categoryId": "eating-out",
    "text": "Eating out swap: Eat at the Mensa instead of a restaurant. The median main dish at the Uni Regensburg Mensa cost students €3.80 in the week of 19–23 Oct, and the cheapest €2.30. A meal at an inexpensive restaurant costs about €14.50. On a day you would eat out, the Mensa is the cheaper plate. From €14.50 to €3.80 per meal.",
    "source": "Numbeo, Meal at an Inexpensive Restaurant in Regensburg: €14.50 (crowd-sourced; for the whole city, 246 entries by 15 contributors in the past 12 months, updated 20 Oct 2026); Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg: median student price of the main dishes on the menu in the week 19–23 Oct 2026, a snapshot (the menu page shows the current week)",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "swap:cinema-student-price",
    "kind": "swap",
    "categoryId": "going-out",
    "text": "Going out swap: See a film at the student price. Show your student proof at Kinos im Andreasstadel: a ticket to a regular screening costs €8 instead of €9. From €9 to €8 per ticket.",
    "source": "Kinos im Andreasstadel, ticket prices: regular €9, reduced €8 for students on showing proof at the cinema; special events can differ",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "swap:deutschlandticket-for-travel-months",
    "kind": "swap",
    "categoryId": "transport",
    "text": "Transport swap: Book the Deutschlandticket for a month you travel. Estimate: the saving assumes one Bayern-Ticket day in the month, and every further day adds to it. A Bayern-Ticket for one day costs €34. The student upgrade to the Deutschlandticket costs €22 a month in Regensburg and is valid all day on local and regional trains across Germany. It is a monthly subscription: cancel it by the 10th of a month and it ends with that month, so you can keep it only for the months you travel. From €34 to €22 per month.",
    "source": "Estimate (assumes one Bayern-Ticket day in the month). Deutsche Bahn, Bayern-Ticket: 1 person, 2nd class, one day, €34; RVV, semester ticket: from 1 Oct 2026 the Regensburg student surcharge for the Deutschlandticket is €22.00 a month; a monthly subscription, cancelled by the 10th of the month",
    "checked": "2026-10-20",
    "estimate": true
  },
  {
    "id": "semester:ur:winter",
    "kind": "semester",
    "categoryId": null,
    "text": "Universität Regensburg (UR), winter semester: 1 October to 31 March.",
    "source": "Universität Regensburg, academic calendar: \"The winter semester begins on 1 October and ends on 31 March.\"",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "semester:ur:summer",
    "kind": "semester",
    "categoryId": null,
    "text": "Universität Regensburg (UR), summer semester: 1 April to 30 September.",
    "source": "Universität Regensburg, academic calendar: \"The summer semester lasts from 1 April to 30 September.\"",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "semester:oth:winter",
    "kind": "semester",
    "categoryId": null,
    "text": "OTH Regensburg, winter semester: 1 October to 14 March.",
    "source": "OTH Regensburg, Studienstart (in German): winter semester 1 October to 14 March",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "semester:oth:summer",
    "kind": "semester",
    "categoryId": null,
    "text": "OTH Regensburg, summer semester: 15 March to 30 September.",
    "source": "OTH Regensburg, Studienstart (in German): summer semester 15 March to 30 September",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "fee:oth:2027-03-15",
    "kind": "fee",
    "categoryId": null,
    "text": "OTH Regensburg, semester starting 2027-03-15: The semester fee is €215: Studierendenwerk basic contribution €87, RVV semester ticket €128. Re-registration (the fee is paid with it) opens in 2027-01.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the summer 2027 figure.; Studierendenwerk Niederbayern/Oberpfalz, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the summer 2027 figure.; OTH Regensburg, dates and opening hours (in German): \"Rückmeldung für das SoSe 2027: vorauss. ab 07.01.2027\", re-registration for summer 2027 expected to open on 7 Jan 2027",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "fee:ur:2027-04-01",
    "kind": "fee",
    "categoryId": null,
    "text": "Universität Regensburg (UR), semester starting 2027-04-01: The semester fee is €215: Studierendenwerk basic contribution €87, RVV semester ticket €128.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the summer 2027 figure.; Studierendenwerk Niederbayern/Oberpfalz, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the summer 2027 figure.",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "fee:oth:2027-10-01",
    "kind": "fee",
    "categoryId": null,
    "text": "OTH Regensburg, semester starting 2027-10-01: The semester fee is €222: Studierendenwerk basic contribution €92, RVV semester ticket €130.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the winter 2027/28 figure.; Studierendenwerk Niederbayern/Oberpfalz, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the winter 2027/28 figure.",
    "checked": "2026-10-20",
    "estimate": false
  },
  {
    "id": "fee:ur:2027-10-01",
    "kind": "fee",
    "categoryId": null,
    "text": "Universität Regensburg (UR), semester starting 2027-10-01: The semester fee is €222: Studierendenwerk basic contribution €92, RVV semester ticket €130.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the winter 2027/28 figure.; Studierendenwerk Niederbayern/Oberpfalz, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the winter 2027/28 figure.",
    "checked": "2026-10-20",
    "estimate": false
  }
];

export const APP_CATEGORIES: readonly PackCategory[] = [
  {
    "id": "food",
    "name": "Food & groceries",
    "kind": "flexible"
  },
  {
    "id": "eating-out",
    "name": "Eating out",
    "kind": "flexible"
  },
  {
    "id": "going-out",
    "name": "Going out",
    "kind": "flexible"
  },
  {
    "id": "transport",
    "name": "Transport",
    "kind": "flexible"
  },
  {
    "id": "shopping",
    "name": "Shopping",
    "kind": "flexible"
  },
  {
    "id": "health",
    "name": "Health & pharmacy",
    "kind": "flexible"
  },
  {
    "id": "personal-care",
    "name": "Personal care",
    "kind": "flexible"
  },
  {
    "id": "study",
    "name": "Study materials",
    "kind": "flexible"
  },
  {
    "id": "household",
    "name": "Household",
    "kind": "flexible"
  },
  {
    "id": "travel",
    "name": "Travel",
    "kind": "flexible"
  },
  {
    "id": "gifts",
    "name": "Gifts",
    "kind": "flexible"
  },
  {
    "id": "other",
    "name": "Other",
    "kind": "flexible"
  },
  {
    "id": "rent",
    "name": "Rent",
    "kind": "fixed"
  },
  {
    "id": "phone",
    "name": "Phone & internet",
    "kind": "fixed"
  },
  {
    "id": "insurance",
    "name": "Insurance",
    "kind": "fixed"
  },
  {
    "id": "subscriptions",
    "name": "Subscriptions",
    "kind": "fixed"
  },
  {
    "id": "transport-pass",
    "name": "Deutschlandticket / semester ticket",
    "kind": "fixed"
  },
  {
    "id": "gym",
    "name": "Gym & sports",
    "kind": "fixed"
  },
  {
    "id": "utilities",
    "name": "Utilities & Rundfunkbeitrag",
    "kind": "fixed"
  },
  {
    "id": "one-off",
    "name": "One-off costs",
    "kind": "oneoff"
  },
  {
    "id": "income-job",
    "name": "Job",
    "kind": "income"
  },
  {
    "id": "income-parents",
    "name": "Parents",
    "kind": "income"
  },
  {
    "id": "income-bafoeg",
    "name": "BAföG",
    "kind": "income"
  },
  {
    "id": "income-sperrkonto",
    "name": "Blocked account",
    "kind": "income"
  },
  {
    "id": "income-scholarship",
    "name": "Scholarship",
    "kind": "income"
  },
  {
    "id": "income-other",
    "name": "Other income",
    "kind": "income"
  }
];
