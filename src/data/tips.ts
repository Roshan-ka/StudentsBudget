import type { IsoDate } from '@/lib/dates';

/**
 * A local way to pay less, with where it comes from. A tip whose number no page states has the source
 * 'Estimate', as in `cities.ts`, and links to what the estimate was built from.
 */
export type Tip = {
  id: string;
  title: string;
  body: string;
  categoryId: string;
  source: string;
  url: string;
  checked: IsoDate;
};

const CHECKED: IsoDate = '2026-10-20';

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';
const RVV_URL = 'https://www.rvv.de/semesterticket';
const RUNDFUNK_URL = 'https://www.rundfunkbeitrag.de/buergerinnen-und-buerger/informationen/informationen-fuer-studierende';
const UR_LIBRARY_URL = 'https://www.uni-regensburg.de/bibliothek/literatur/ausleihe';

/**
 * Regensburg tips, seeded by hand and read-only in P1. The page sorts them by category; within a category, the
 * most useful comes first. Every page was opened on the checked date, and every number is stated on it.
 */
export const TIPS: Tip[] = [
  {
    id: 'cafeteria-surprise-bags',
    title: 'Grab a cafeteria surprise bag',
    body: 'Cafeterias Milchbar, Sammelgebäude (UR) and Architektur (OTH) sell leftovers cheaply via Too Good To Go in the last 30 minutes.',
    categoryId: 'food',
    source: `${STWNO}, food waste page: surprise bags via Too Good To Go in the last 30 minutes at the Milchbar, Sammelgebäude and Architektur cafeterias, not every day`,
    url: 'https://stwno.de/de/nachhaltigkeit/gastronomie-nachhaltigkeit/lebensmittelabfaelle-nachhaltigkeit',
    checked: CHECKED,
  },
  {
    id: 'eat-at-the-mensa',
    title: 'Eat at the Mensa',
    body: 'Main dishes at the Uni Regensburg Mensa start at €2.30 for students. Guests pay €6.10 for the same plate.',
    categoryId: 'eating-out',
    source: `${STWNO}, Mensa Uni Regensburg menu: the cheapest main dish was €2.30 for students, €3.30 for staff and €6.10 for guests on every weekday of 19–30 Oct 2026 (the menu changes daily)`,
    url: 'https://stwno.de/de/gastronomie/speiseplan/uni-regensburg/mensa-ur',
    checked: CHECKED,
  },
  {
    id: 'tap-your-student-id',
    title: 'Tap your student ID at the till',
    body: 'Paying by card or phone? Also put your student ID on the till terminal, or you are charged the higher price.',
    categoryId: 'eating-out',
    source: `${STWNO}, Mensa Uni Regensburg page: the tills take no cash; put the Mensa card or student ID on the terminal as well to get the student price`,
    url: 'https://stwno.de/de/gastronomie/mensen/mensa-uni-regensburg',
    checked: CHECKED,
  },
  {
    id: 'theatre-at-half-price',
    title: 'See a play at half price',
    body: 'Students under 30 pay half price at the Staatstheater; U30 shows are €10 for any seat. Buy at the box office to skip the €1.50 fee.',
    categoryId: 'going-out',
    source: 'Staatstheater Regensburg, visitor FAQ: 50% off the regular price until the 30th birthday; U30 shows €10 for any seat; €1.50 fee per ticket online or by phone, none at the box office',
    url: 'https://www.staatstheater-regensburg.de/index/besuch.html',
    checked: CHECKED,
  },
  {
    id: 'historisches-museum-free',
    title: 'Visit the Historisches Museum free',
    body: "Students under 30 get into the city's Historisches Museum for free (adults pay €5). Bring your student ID.",
    categoryId: 'going-out',
    source: 'Museen der Stadt Regensburg, Historisches Museum: adults €5; free for students under 30 with ID, and for everyone on the first Sunday of the month',
    url: 'https://www.regensburg.de/museen/die-museen/historisches-museum',
    checked: CHECKED,
  },
  {
    id: 'hdbg-museum-free',
    title: 'Visit the Bavarian history museum free',
    body: 'Students under 30 get into the Haus der Bayerischen Geschichte for free (adults pay €7), including the 2026/27 Bayernausstellung.',
    categoryId: 'going-out',
    source: 'Haus der Bayerischen Geschichte, admission prices valid 8 Jul 2026 to 7 Aug 2027: adults €7, students under 30 free',
    url: 'https://www.hdbg.de/ihr-besuch/eintrittspreise.html',
    checked: CHECKED,
  },
  {
    id: 'cinema-student-price',
    title: 'Reserve cinema tickets for free',
    body: 'At Kinos im Andreasstadel students pay €8 instead of €9. Reserve for free rather than buying online, which adds 10%.',
    categoryId: 'going-out',
    source: 'Kinos im Andreasstadel, ticket prices: €9 regular, €8 reduced for students with proof; online advance sale adds 10%; reservations are free',
    url: 'https://www.kinos-im-andreasstadel.de/Eintrittspreise/unterseite_7311',
    checked: CHECKED,
  },
  {
    id: 'register-in-person',
    title: 'Register in person for free vouchers',
    body: 'Register your main residence in person at a Bürgerbüro: the welcome package includes vouchers for a city tour and a theatre visit.',
    categoryId: 'going-out',
    source: 'Stadt Regensburg, welcome package: handed out when you register in person; with a main residence it includes vouchers for a city tour and a theatre visit',
    url: 'https://www.regensburg.de/buergerservice/dienstleistungen/lebenslagen/neu-in-regensburg/willkommenspaket',
    checked: CHECKED,
  },
  {
    id: 'campus-bike-repair',
    title: 'Fix your bike at Campus Bike Repair',
    body: 'A mobile bike workshop with tools and patch kits comes to the UR campus every week. Bring special parts yourself.',
    categoryId: 'transport',
    source: 'Universität Regensburg, UR Health "Move": the mobile workshop Campus Bike Repair comes to campus weekly with tools and patch material; special parts are not provided',
    url: 'https://www.uni-regensburg.de/universitaet/sportzentrum/ur-health/unsere-angebote/move',
    checked: CHECKED,
  },
  {
    id: 'fashion-for-free',
    title: 'Get clothes at Fashion for Free',
    body: "The Studierendenwerk runs a free clothes swap every semester, and you don't need to bring clothes. Its news page has the next Regensburg date.",
    categoryId: 'shopping',
    source: `${STWNO}, news "Fashion for free im STWNO" (6 Aug 2026): free for everyone, no donation needed, every semester; in Regensburg on 9 Dec 2026 in the guest Mensa hall at UR`,
    url: 'https://stwno.de/de/home/news/beratung/3259-kleiderboerse',
    checked: CHECKED,
  },
  {
    id: 'free-psychological-counselling',
    title: 'Use free psychological counselling',
    body: 'The Studierendenwerk offers free one-to-one counselling in German or English, in person, by phone or by video.',
    categoryId: 'health',
    source: `${STWNO}, psychological counselling: free short- and medium-term one-to-one counselling in person, by phone or video, in German and English`,
    url: 'https://stwno.de/de/beratung/psychologische-beratung',
    checked: CHECKED,
  },
  {
    id: 'borrow-course-books',
    title: "Borrow course books, don't buy them",
    body: 'Borrow core textbooks from the Lehrbuchsammlung in the UR central library for four weeks, renewable up to 12 weeks.',
    categoryId: 'study',
    source: 'Universität Regensburg library, borrowing print media: textbook collection loans for four weeks, extendable to 12 weeks',
    url: UR_LIBRARY_URL,
    checked: CHECKED,
  },
  {
    id: 'scan-for-free',
    title: 'Scan library books for free',
    body: "Scan reading-room books for free at the UR library's book scanners and save them to your own USB stick.",
    categoryId: 'study',
    source: 'Universität Regensburg library, borrowing print media, reading rooms: scanning at the book scanners is free, saved to your own USB stick',
    url: UR_LIBRARY_URL,
    checked: CHECKED,
  },
  {
    id: 'day-trips-on-the-semester-ticket',
    title: 'Take day trips on the semester ticket',
    body: 'Since winter 2026/27 the semester ticket again covers trains from Regensburg up to Neustadt an der Donau, at no extra cost.',
    categoryId: 'travel',
    source: `${STWNO}, semester ticket Regensburg: from winter semester 2026/27 the rail section Sinzing/Riegling to Neustadt a. d. Donau is back in the ticket area`,
    url: 'https://stwno.de/en/home-en2/semester-contribution-and-tickets/semesterticket-regensburg',
    checked: CHECKED,
  },
  {
    id: 'studienstarthilfe',
    title: 'Claim the €1,000 study start grant',
    body: 'First-year, under 25 and on benefits such as Bürgergeld or Wohngeld? Apply for a one-off €1,000 grant by the end of the month after you start.',
    categoryId: 'other',
    source: `${STWNO}, BAföG Studienstarthilfe: a one-off €1,000 grant, not repaid, for first-time full-time students under 25 who receive social benefits; apply via BAföG Digital by the end of the month after the start`,
    url: 'https://stwno.de/de/finanzierung/bafoeg-studienstarthilfe',
    checked: CHECKED,
  },
  {
    id: 'apply-for-a-dorm-room',
    title: 'Apply for a Studierendenwerk room',
    body: 'The cheapest dorm rooms cost about €215 a month; a WG room averages €459–561. You can apply online at any time.',
    categoryId: 'rent',
    source: 'Universität Regensburg, living in Regensburg: the cheapest Studierendenwerk rooms cost about €215; an average WG room €459–561 (Moses Mendelssohn Institut, Sept 2026); no application deadline',
    url: 'https://www.uni-regensburg.de/studieren/rund-ums-studium/wohnen-in-regensburg',
    checked: CHECKED,
  },
  {
    id: 'check-wohngeld',
    title: 'Check if Wohngeld applies to you',
    body: 'No BAföG entitlement in principle, e.g. past the age limit? Wohngeld may help with rent if Regensburg is your main residence.',
    categoryId: 'rent',
    source: `${STWNO}, Wohngeld: possible only without a BAföG entitlement in principle, and the study town must be the main residence`,
    url: 'https://stwno.de/de/beratung/sozialberatung/studium-geld/wohngeld',
    checked: CHECKED,
  },
  {
    id: 'free-tenancy-advice',
    title: 'Get free tenancy-law advice',
    body: 'Problems with your landlord? Student counselling at the Studierendenwerk refers you to the local Mieterverein for free advice.',
    categoryId: 'rent',
    source: `${STWNO}, tenancy-law advice: free advice from the local Mieterverein in Regensburg, by referral from student counselling`,
    url: 'https://stwno.de/de/beratung/sozialberatung/mietrechtsberatung',
    checked: CHECKED,
  },
  {
    id: 'stay-on-family-insurance',
    title: 'Stay on family health insurance',
    body: "Free cover on a parent's public health insurance lasts until you turn 25 if you earn under €565 a month (€603 in a minijob, 2026).",
    categoryId: 'insurance',
    source: `${STWNO}, health and care insurance: free family insurance until the 25th birthday; in 2026 up to €565 a month from a regular job or €603 from a minijob`,
    url: 'https://stwno.de/de/beratung/sozialberatung/kranken-pflegeversicherung',
    checked: CHECKED,
  },
  {
    id: 'software-from-campus-it',
    title: 'Get Office through the university',
    body: 'Before paying for Office 365 or SPSS, check the UR Campus IT software offer: campus licences are free or discounted for students.',
    categoryId: 'subscriptions',
    source: 'Universität Regensburg Campus IT, software: campus licences free or at special prices; students get discounts on software such as SPSS and Office 365',
    url: 'https://www.uni-regensburg.de/campus-it/it-dienste/einkauf-ausleihe-werkstatt/software-einkauf',
    checked: CHECKED,
  },
  {
    id: 'ride-on-your-semester-ticket',
    title: 'Ride the RVV on your semester ticket',
    body: 'Your semester fee already includes €126 for unlimited RVV bus and train rides. Your student ID plus photo ID is the ticket.',
    categoryId: 'transport-pass',
    source: 'RVV, semester ticket: a compulsory €126 per semester for unlimited rides in the whole RVV area; the ticket is the student ID plus ID card or passport',
    url: RVV_URL,
    checked: CHECKED,
  },
  {
    id: 'upgrade-to-deutschlandticket',
    title: 'Upgrade to Deutschlandticket for €22',
    body: 'The upgrade costs €22 a month on top of your semester ticket. Book it for months you travel; cancel by the 10th for the next month.',
    categoryId: 'transport-pass',
    source: 'RVV, semester ticket: from 1 Oct 2026 the Regensburg student surcharge is €22.00 a month; a monthly subscription, cancelled by the 10th of the month',
    url: RVV_URL,
    checked: CHECKED,
  },
  {
    id: 'try-university-sport',
    title: 'Try university sport before a gym',
    body: 'URsport at the UR Sportzentrum has a gym, pool, sauna and courses at a student rate for UR and OTH students. Compare before you sign up.',
    categoryId: 'gym',
    source: 'Universität Regensburg Sportzentrum, URsport platform: UR and OTH students sign in and buy at the student rate; gym, pool and sauna through the app',
    url: 'https://www.uni-regensburg.de/universitaet/sportzentrum/hochschulsport/infos-zur-neuen-ursport-plattform',
    checked: CHECKED,
  },
  {
    id: 'split-the-rundfunkbeitrag',
    title: 'Share one Rundfunkbeitrag per flat',
    body: 'The fee is €18.36 a month per flat, not per person. In a WG one person registers and you split it; the others deregister.',
    categoryId: 'utilities',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, information for students: €18.36 a month per flat; only one adult per flat registers and pays',
    url: RUNDFUNK_URL,
    checked: CHECKED,
  },
  {
    id: 'rundfunkbeitrag-bafoeg-exemption',
    title: 'Apply for a Rundfunkbeitrag exemption',
    body: 'If you get BAföG and do not live with your parents, apply for an exemption from the €18.36 monthly fee. It is not automatic.',
    categoryId: 'utilities',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, information for students: BAföG recipients who do not live with their parents can be exempted on application',
    url: RUNDFUNK_URL,
    checked: CHECKED,
  },
];
