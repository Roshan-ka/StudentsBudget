// The Regensburg data the AI may quote, and the app categories, written from src/data and src/i18n by
// scripts/write-city-pack.mjs: do not edit by hand. Run `node scripts/write-city-pack.mjs` after changing src/data,
// src/i18n/city or the category names; src/features/ai/server/city-pack.test.ts fails while this file is stale.

import type { PackCategory, PackItem } from './pack.ts';

export const CITY_PACK: readonly PackItem[] = [
  {
    "id": "range:rent",
    "kind": "range",
    "categoryId": "rent",
    "text": "Rent in Regensburg: €215–€561 a month.",
    "source": "Universität Regensburg: cheapest Studierendenwerk room about €215, WG room €459–561",
    "checked": "2026-10-16",
    "estimate": false,
    "words": "alquil apartment appartement averag budget casero cautio chambr colocatio cost cout cuesta deposit dorm durchschnitt fianza flat habitacio housing kautio kost kostet landlord logement loyer media mensual mensuel miet mois monat monatlich month monthly moyenn normal piso plan presupuesto proprietair rent rental residenc residencia room tenancy typical usual vermiet vivienda wohn wohnheim wohnung zimm"
  },
  {
    "id": "range:food",
    "kind": "range",
    "categoryId": "food",
    "text": "Food & groceries in Regensburg: €180–€335 a month.",
    "source": "DSW 22nd Sozialerhebung 2021, national mean €194 (not Regensburg), scaled to Sep 2026 with Destatis food prices; ±30% spread is our assumption",
    "checked": "2026-10-16",
    "estimate": false,
    "words": "alimentacio alimentatio averag budget cocinar comer comida compra cook cooking cost cours cout cuesta cuisin durchschnitt eat einkauf epiceri esse food groceri grocery koch kost kostet lebensmittel mang meal media mensual mensuel mois monat monatlich month monthly moyenn normal nourritur plan presupuesto repa supermarch supermarket supermarkt supermercado typical usual"
  },
  {
    "id": "range:eating-out",
    "kind": "range",
    "categoryId": "eating-out",
    "text": "Eating out in Regensburg: €30–€135 a month.",
    "source": "Estimate",
    "checked": "2026-10-16",
    "estimate": true,
    "words": "abendess almuerzo auswart averag budget cafeteria cante cantin cena comedor comer cost cout cuesta dehor dejeun diner dinn durchschnitt eat eating esse fuera kantin kost kostet lunch mang meal media mensa mensual mensuel mittagess mois monat monatlich month monthly moyenn normal plan presupuesto repa restaurant resto takeaway typical usual"
  },
  {
    "id": "range:going-out",
    "kind": "range",
    "categoryId": "going-out",
    "text": "Going out in Regensburg: €30–€120 a month.",
    "source": "Estimate",
    "checked": "2026-10-16",
    "estimate": true,
    "words": "ausgeh averag bouldering bowling budget cine cinema climbing club clubbing concert concierto cost cout cuesta cultur cultura durchschnitt escalad escalada feier fete fiesta film freizeit fun going kino kletter konzert kost kostet kultur leisur loisir media mensual mensuel mois monat monatlich month monthly movi moyenn muse museo museum normal ocio party piscin piscina plan pool presupuesto salir schwimm schwimmbad skating soire sorti sortir swimming teatro theat theatr typical usual weekend"
  },
  {
    "id": "range:transport",
    "kind": "range",
    "categoryId": "transport",
    "text": "Transport in Regensburg: €10–€60 a month.",
    "source": "Estimate",
    "checked": "2026-10-16",
    "estimate": true,
    "words": "autobu averag bahn bici bicicleta bicycl bike budget bus commut cost cout cuesta cycling durchschnitt fahrrad fahrt kost kostet media mensual mensuel mobilitat mois monat monatlich month monthly moyenn normal plan presupuesto repair reparacio reparatio reparatur trai transport tren typical usual velo zug"
  },
  {
    "id": "range:shopping",
    "kind": "range",
    "categoryId": "shopping",
    "text": "Shopping in Regensburg: €35–€65 a month.",
    "source": "DSW 22nd Sozialerhebung 2021, clothing national mean €40 (not Regensburg), scaled to Sep 2026 with the Destatis all-items CPI; ±30% spread is our assumption",
    "checked": "2026-10-16",
    "estimate": false,
    "words": "achat averag budget chaussur cloth clothing compra cost cout cuesta durchschnitt einkauf fashio klamott kleidung kost kostet media mensual mensuel moda mode mois monat monatlich month monthly moyenn normal plan presupuesto ropa schuh shoe shopping typical usual vetement zapato"
  },
  {
    "id": "range:other",
    "kind": "range",
    "categoryId": "other",
    "text": "Other in Regensburg: €95–€175 a month.",
    "source": "DSW 22nd Sozialerhebung 2021, other expenses national mean €109 (not Regensburg), scaled to Sep 2026 with the Destatis all-items CPI; ±30% spread is our assumption",
    "checked": "2026-10-16",
    "estimate": false,
    "words": "adult aide argent autr averag ayuda budget claim cost cour cours cout cuesta curso dinero durchschnitt educatio geld grant kost kostet kurs media mensual mensuel mois monat monatlich money month monthly moyenn normal otro plan presupuesto sonstig typical usual volkshochschul zuschus"
  },
  {
    "id": "price:mensa-main-meal-student-price",
    "kind": "price",
    "categoryId": null,
    "text": "Mensa main meal (student price) in Regensburg: €3.80.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg: median student price of the main dishes on the menu in the week 19–23 Oct 2026, a snapshot (the menu page shows the current week)",
    "checked": "2026-10-16",
    "estimate": false,
    "words": "cost cout cuesta kostet main meal mensa precio prei preis pric prix student"
  },
  {
    "id": "price:club-entry",
    "kind": "price",
    "categoryId": null,
    "text": "Club entry in Regensburg: €10.",
    "source": "Estimate",
    "checked": "2026-10-16",
    "estimate": true,
    "words": "club cost cout cuesta entry kostet precio prei preis pric prix"
  },
  {
    "id": "price:gym-per-month",
    "kind": "price",
    "categoryId": null,
    "text": "Gym per month in Regensburg: €29.90.",
    "source": "McFit Regensburg-Reinhausen, 12-month Standard (plus €39 sign-up and €15 twice a year)",
    "checked": "2026-10-16",
    "estimate": false,
    "words": "cost cout cuesta gym kostet month precio prei preis pric prix"
  },
  {
    "id": "tip:cafeteria-surprise-bags",
    "kind": "tip",
    "categoryId": "food",
    "text": "Food & groceries tip: Grab a cafeteria surprise bag. Cafeterias Milchbar, Sammelgebäude (UR) and Architektur (OTH) sell leftovers cheaply via Too Good To Go in the last 30 minutes.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, food waste page: surprise bags via Too Good To Go in the last 30 minutes at the Milchbar, Sammelgebäude and Architektur cafeterias, not every day",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro alimentacio alimentatio architektur astuc bag barato billig bolsa cafeteria cheap cheaply cher cocinar comer comida compra conseil consejo cook cooking cours cuisin eat economi economis einkauf epiceri esse food free good grab grati gratuit groceri grocery gunstig hol koch kostenlo last lebensmittel leftover llevat mang meal milchbar minut nourritur oth pani prend rat repa sammelgebaud save saving sell sorpresa spar supermarch supermarket supermarkt supermercado surpris tip tipp tips too truco uberraschungstut via"
  },
  {
    "id": "tip:eat-at-the-mensa",
    "kind": "tip",
    "categoryId": "eating-out",
    "text": "Eating out tip: Eat at the Mensa. Main dishes at the Uni Regensburg Mensa start at €2.30 for students. Guests pay €6.10 for the same plate.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg menu: the cheapest main dish was €2.30 for students, €3.30 for staff and €6.10 for guests on every weekday of 19–30 Oct 2026 (the menu changes daily)",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "abendess advic ahorrar ahorro almuerzo astuc auswart barato billig cafeteria cante cantin cena cheap cher come comedor comer conseil consejo dehor dejeun diner dinn dish eat eating economi economis esse free fuera grati gratuit guest gunstig iss kantin kostenlo lunch main mang meal mensa mittagess pay plat rat repa restaurant resto save saving spar start student takeaway tip tipp tips truco uni"
  },
  {
    "id": "tip:tap-your-student-id",
    "kind": "tip",
    "categoryId": "eating-out",
    "text": "Eating out tip: Tap your student ID at the till. Paying by card or phone? Also put your student ID on the till terminal, or you are charged the higher price.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg page: the tills take no cash; put the Mensa card or student ID on the terminal as well to get the student price",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "abendess advic ahorrar ahorro almuerzo astuc auswart barato billig cafeteria caiss caja cante cantin card carn cart cena charged cheap cher comedor comer conseil consejo dehor dein dejeun diner dinn eat eating economi economis esse estudiant etudiant free fuera grati gratuit gunstig high kantin kass kostenlo leg lunch mang meal mensa mittagess paying phon pon pose pric put rat repa restaurant resto save saving spar student studierendenauswei takeaway tap terminal till tip tipp tips truco"
  },
  {
    "id": "tip:theatre-at-half-price",
    "kind": "tip",
    "categoryId": "going-out",
    "text": "Going out tip: See a play at half price. Students under 30 pay half price at the Staatstheater; U30 shows are €10 for any seat. Buy at the box office to skip the €1.50 fee.",
    "source": "Staatstheater Regensburg, visitor FAQ: 50% off the regular price until the 30th birthday; U30 shows €10 for any seat; €1.50 fee per ticket online or by phone, none at the box office",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro astuc ausgeh barato billig bouldering bowling box buy cheap cher cine cinema climbing club clubbing concert concierto conseil consejo cultur cultura economi economis escalad escalada fee feier fete fiesta film free freizeit fun geh going grati gratuit gunstig halb half kino kletter konzert kostenlo kultur leisur loisir mitad moiti movi muse museo museum ocio offic party pay piscin piscina play pool precio prei pric prix rat salir save saving schwimm schwimmbad seat see show skating skip soire sorti sortir spar staatstheat student swimming teatro theat theatr tip tipp tips truco u30 under weekend"
  },
  {
    "id": "tip:historisches-museum-free",
    "kind": "tip",
    "categoryId": "going-out",
    "text": "Going out tip: Visit the Historisches Museum free. Students under 30 get into the city's Historisches Museum for free (adults pay €5). Bring your student ID.",
    "source": "Museen der Stadt Regensburg, Historisches Museum: adults €5; free for students under 30 with ID, and for everyone on the first Sunday of the month",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "adult advic ahorrar ahorro astuc ausgeh barato besuch billig bouldering bowling bring cheap cher cine cinema city climbing club clubbing concert concierto conseil consejo cultur cultura economi economis escalad escalada feier fete fiesta film free freizeit fun going grati gratuit gratuitement gunstig historisch kino kletter konzert kostenlo kultur leisur loisir movi muse museo museum ocio party pay piscin piscina pool rat salir save saving schwimm schwimmbad skating soire sorti sortir spar student swimming teatro theat theatr tip tipp tips truco under visit visita weekend"
  },
  {
    "id": "tip:hdbg-museum-free",
    "kind": "tip",
    "categoryId": "going-out",
    "text": "Going out tip: Visit the Bavarian history museum free. Students under 30 get into the Haus der Bayerischen Geschichte for free (adults pay €7), including the 2026/27 Bayernausstellung.",
    "source": "Haus der Bayerischen Geschichte, admission prices valid 8 Jul 2026 to 7 Aug 2027: adults €7, students under 30 free",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "adult advic ahorrar ahorro astuc ausgeh barato bavara bavaria bavarois bayerisch bayernausstellung besuch billig bouldering bowling cheap cher cine cinema climbing club clubbing concert concierto conseil consejo cultur cultura economi economis escalad escalada feier fete fiesta film free freizeit fun geschicht going grati gratuit gratuitement gunstig haus histoir historia history including kino kletter konzert kostenlo kultur leisur loisir movi muse museo museum ocio party pay piscin piscina pool rat salir save saving schwimm schwimmbad skating soire sorti sortir spar student swimming teatro theat theatr tip tipp tips truco under visit visita weekend"
  },
  {
    "id": "tip:cinema-student-price",
    "kind": "tip",
    "categoryId": "going-out",
    "text": "Going out tip: Reserve cinema tickets for free. At Kinos im Andreasstadel students pay €8 instead of €9. Reserve for free rather than buying online, which adds 10%.",
    "source": "Kinos im Andreasstadel, ticket prices: €9 regular, €8 reduced for students with proof; online advance sale adds 10%; reservations are free",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "adds advic ahorrar ahorro andreasstadel astuc ausgeh barato billig bouldering bowling buying cheap cher cine cinema climbing club clubbing concert concierto conseil consejo cultur cultura economi economis entrada escalad escalada feier fete fiesta film free freizeit fun going grati gratuit gratuitement gunstig instead kino kinokart kletter konzert kostenlo kultur leisur loisir movi muse museo museum ocio onlin party pay piscin piscina plac pool rat rath reserv reserva reservi salir save saving schwimm schwimmbad skating soire sorti sortir spar student swimming teatro theat theatr ticket tip tipp tips truco weekend"
  },
  {
    "id": "tip:register-in-person",
    "kind": "tip",
    "categoryId": "going-out",
    "text": "Going out tip: Register in person for free vouchers. Register your main residence in person at a Bürgerbüro: the welcome package includes vouchers for a city tour and a theatre visit.",
    "source": "Stadt Regensburg, welcome package: handed out when you register in person; with a main residence it includes vouchers for a city tour and a theatre visit",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro astuc ausgeh barato billig bons bouldering bowling burgerburo cheap cher cine cinema city climbing club clubbing concert concierto conseil consejo cultur cultura economi economis escalad escalada feier fete fiesta film free freizeit fun going grati gratuit gunstig gutschein hol includ inscri kino kletter konzert kostenlo kultur leisur llevat loisir main meld movi muse museo museum ocio packag party perso persona personlich personn piscin piscina pool rat regist registrat residenc salir save saving schwimm schwimmbad skating soire sorti sortir spar swimming teatro theat theatr tip tipp tips tour truco vale visit voucher weekend welcom"
  },
  {
    "id": "tip:campus-bike-repair",
    "kind": "tip",
    "categoryId": "transport",
    "text": "Transport tip: Fix your bike at Campus Bike Repair. A mobile bike workshop with tools and patch kits comes to the UR campus every week. Bring special parts yourself.",
    "source": "Universität Regensburg, UR Health \"Move\": the mobile workshop Campus Bike Repair comes to campus weekly with tools and patch material; special parts are not provided",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro arregla astuc autobu bahn barato bici bicicleta bicycl bike billig bring bus campu cheap cher chez come commut conseil consejo cycling economi economis fahrrad fahrt fix free grati gratuit gunstig kits kostenlo mobil mobilitat part patch rad rat repair repar reparacio reparatio reparatur repari save saving spar special tip tipp tips tool trai transport tren truco velo week workshop yourself zug"
  },
  {
    "id": "tip:fashion-for-free",
    "kind": "tip",
    "categoryId": "shopping",
    "text": "Shopping tip: Get clothes at Fashion for Free. The Studierendenwerk runs a free clothes swap every semester, and you don't need to bring clothes. Its news page has the next Regensburg date.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, news \"Fashion for free im STWNO\" (6 Aug 2026): free for everyone, no donation needed, every semester; in Regensburg on 9 Dec 2026 in the guest Mensa hall at UR",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "achat advic ahorrar ahorro astuc barato billig bring chaussur cheap cher cloth clothing compra conseil consejo consigu date don economi economis einkauf fashio free grati gratuit gunstig hol klamott kleidung kostenlo moda mode need news next page rat ropa runs save saving schuh semest shoe shopping spar studierendenwerk swap tip tipp tips trouv truco vetement zapato"
  },
  {
    "id": "tip:free-psychological-counselling",
    "kind": "tip",
    "categoryId": "health",
    "text": "Health & pharmacy tip: Use free psychological counselling. The Studierendenwerk offers free one-to-one counselling in German or English, in person, by phone or by video.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, psychological counselling: free short- and medium-term one-to-one counselling in person, by phone or video, in German and English",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro apothek arzt astuc barato beratung billig cheap cher conseil consejo counselling doctor economi economis english farmacia free germa gesundheit grati gratuit gratuita gunstig health kostenlo kostenlos medeci medicament medicamento medicin medico medikament mental nutz offer orientacio perso pharmaci pharmacy phon profit psicologica psicologo psych psycholog psychological psychologiqu psychologisch psychologist psychologu rat salud sant save saving souti spar stres studierendenwerk terapia therapi therapy tip tipp tips truco usa use video"
  },
  {
    "id": "tip:borrow-course-books",
    "kind": "tip",
    "categoryId": "study",
    "text": "Study materials tip: Borrow course books, don't buy them. Borrow core textbooks from the Lehrbuchsammlung in the UR central library for four weeks, renewable up to 12 weeks.",
    "source": "Universität Regensburg library, borrowing print media: textbook collection loans for four weeks, extendable to 12 weeks",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "achet advic ahorrar ahorro astuc barato biblioteca bibliothek bibliothequ billig book borrow buch bucherei buy central cheap cher compr conseil consejo core cour cours curso don druck economi economis emprunt estudio etud four free grati gratuit gunstig imprim imprimir kauf kostenlo lectur lehrbuch lehrbuchsammlung leih library libro lieu livr manual manuel material prestado print printing rat renewabl save saving scan scann spar statt studi studienmaterial studium study textbook tip tipp tips toma truco uni universidad universit university vorlesung week"
  },
  {
    "id": "tip:scan-for-free",
    "kind": "tip",
    "categoryId": "study",
    "text": "Study materials tip: Scan library books for free. Scan reading-room books for free at the UR library's book scanners and save them to your own USB stick.",
    "source": "Universität Regensburg library, borrowing print media, reading rooms: scanning at the book scanners is free, saved to your own USB stick",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro astuc barato biblioteca bibliothek bibliotheksbuch bibliothequ billig book buch bucherei cheap cher conseil consejo cour cours curso druck economi economis escanea estudio etud free grati gratuit gratuitement gunstig imprim imprimir kostenlo lectur library libro livr material own print printing rat reading room save saving scan scann scanner spar stick studi studienmaterial studium study textbook tip tipp tips truco uni universidad universit university usb vorlesung"
  },
  {
    "id": "tip:day-trips-on-the-semester-ticket",
    "kind": "tip",
    "categoryId": "travel",
    "text": "Travel tip: Take day trips on the semester ticket. Since winter 2026/27 the semester ticket again covers trains from Regensburg up to Neustadt an der Donau, at no extra cost.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, semester ticket Regensburg: from winter semester 2026/27 the rail section Sinzing/Riegling to Neustadt a. d. Donau is back in the ticket area",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "abonnement abono advic agai ahorrar ahorro astuc ausflug barato billig cheap cher conseil consejo cost cover day dia donau economi economis excursio excursion extra fais free grati gratuit gunstig haz holiday kostenlo mach neustadt rat reis save saving semest semesterticket semestral semestriel sinc spar tagesausflug take ticket tip tipp tips train travel trip truco urlaub vacacion vacanc vacatio viaj viajar voyag wint"
  },
  {
    "id": "tip:studienstarthilfe",
    "kind": "tip",
    "categoryId": "other",
    "text": "Other tip: Claim the €1,000 study start grant. First-year, under 25 and on benefits such as Bürgergeld or Wohngeld? Apply for a one-off €1,000 grant by the end of the month after you start.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, BAföG Studienstarthilfe: a one-off €1,000 grant, not repaid, for first-time full-time students under 25 who receive social benefits; apply via BAföG Digital by the end of the month after the start",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "adult advic after ahorrar ahorro aide apply argent astuc autr ayuda barato benefit billig burgergeld cheap cher claim conseil consejo cour cours curso debut demand dinero economi economis educatio end estudio etud first free geld grant grati gratuit gunstig hol inicio kostenlo kurs money month off otro pide rat save saving sonstig spar start studienstarthilf study tip tipp tips truco under volkshochschul wohngeld year zuschus"
  },
  {
    "id": "tip:apply-for-a-dorm-room",
    "kind": "tip",
    "categoryId": "rent",
    "text": "Rent tip: Apply for a Studierendenwerk room. The cheapest dorm rooms cost about €215 a month; a WG room averages €459–561. You can apply online at any time.",
    "source": "Universität Regensburg, living in Regensburg: the cheapest Studierendenwerk rooms cost about €215; an average WG room €459–561 (Moses Mendelssohn Institut, Sept 2026); no application deadline",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro alquil apartment appartement apply astuc averag barato bewirb billig casero cautio chambr cheap cheapest cher colocatio conseil consejo cost deposit dorm economi economis fianza flat free grati gratuit gunstig habitacio housing kautio kostenlo landlord logement loyer miet month onlin piso postul proprietair rat rent rental residenc residencia room save saving solicita spar studierendenwerk tenancy time tip tipp tips truco vermiet vivienda wohn wohnheim wohnung zimm"
  },
  {
    "id": "tip:check-wohngeld",
    "kind": "tip",
    "categoryId": "rent",
    "text": "Rent tip: Check if Wohngeld applies to you. No BAföG entitlement in principle, e.g. past the age limit? Wohngeld may help with rent if Regensburg is your main residence.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Wohngeld: possible only without a BAföG entitlement in principle, and the study town must be the main residence",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic age ahorrar ahorro alquil apartment appartement appli astuc bafog barato bekomm billig casero cautio chambr cheap check cher colocatio comprueba conseil consejo correspond deposit dorm droit economi economis entitlement fianza flat free grati gratuit gunstig habitacio help housing kautio kostenlo landlord limit logement loyer main may miet past piso principl proprietair pruf rat rent rental residenc residencia room save saving spar tenancy tip tipp tips truco verifi vermiet vivienda wohn wohngeld wohnheim wohnung zimm"
  },
  {
    "id": "tip:free-tenancy-advice",
    "kind": "tip",
    "categoryId": "rent",
    "text": "Rent tip: Get free tenancy-law advice. Problems with your landlord? Student counselling at the Studierendenwerk refers you to the local Mieterverein for free advice.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, tenancy-law advice: free advice from the local Mieterverein in Regensburg, by referral from student counselling",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro alquil apartment appartement asesoria astuc bail barato billig casero cautio chambr cheap cher colocatio conseil consejo consigu counselling deposit dorm economi economis fianza flat free grati gratuit gratuita gunstig habitacio hol housing kautio kostenlo kostenlos landlord law local logement loyer miet mieterverei mietrechtsberatung obtien piso problem proprietair rat refer rent rental residenc residencia room save saving spar student studierendenwerk tenancy tip tipp tips truco vermiet vivienda wohn wohnheim wohnung zimm"
  },
  {
    "id": "tip:stay-on-family-insurance",
    "kind": "tip",
    "categoryId": "insurance",
    "text": "Insurance tip: Stay on family health insurance. Free cover on a parent's public health insurance lasts until you turn 25 if you earn under €565 a month (€603 in a minijob, 2026).",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, health and care insurance: free family insurance until the 25th birthday; in 2026 up to €565 a month from a regular job or €603 from a minijob",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro assuranc astuc barato billig bleib cheap cher conseil consejo cover earn economi economis familial familiar familienversicherung family free grati gratuit gunstig health insuranc insured kostenlo krankenkass krankenversicherung last maladi medico minijob month mutuell parent public rat rest save saving seguro sigu spar stay tip tipp tips truco turn under until versichert versicherung"
  },
  {
    "id": "tip:software-from-campus-it",
    "kind": "tip",
    "categoryId": "subscriptions",
    "text": "Subscriptions tip: Get Office through the university. Before paying for Office 365 or SPSS, check the UR Campus IT software offer: campus licences are free or discounted for students.",
    "source": "Universität Regensburg Campus IT, software: campus licences free or at special prices; students get discounts on software such as SPSS and Office 365",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "abo abonnement abos advic ahorrar ahorro apps astuc barato befor billig campu cheap check cher conseil consejo consigu discounted economi economis free grati gratuit gunstig hol kostenlo licenc logiciel microsoft obtien offer offic paying programa rat save saving softwar spar spss streaming student subscriptio subscription suscripcio suscripcion through tip tipp tips trav truco uni universidad universit university via"
  },
  {
    "id": "tip:ride-on-your-semester-ticket",
    "kind": "tip",
    "categoryId": "transport-pass",
    "text": "Deutschlandticket / semester ticket tip: Ride the RVV on your semester ticket. Your semester fee already includes €126 (winter semester 2026/27) for unlimited RVV bus and train rides. Your student ID plus photo ID is the ticket.",
    "source": "RVV, semester ticket: a compulsory €126 per semester for unlimited rides in the whole RVV area; the ticket is the student ID plus ID card or passport",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "abonnement abono advic ahorrar ahorro already astuc barato billet billig bus cheap cher conseil consejo deutschlandticket economi economis fahr fee free grati gratuit gunstig includ kostenlo nahverkehr opnv pass photo public rat reseau ride rvv save saving semest semesterticket semestral semestriel spar student ticket tip tipp tips trai transport truco unlimited viaja voyag wint"
  },
  {
    "id": "tip:upgrade-to-deutschlandticket",
    "kind": "tip",
    "categoryId": "transport-pass",
    "text": "Deutschlandticket / semester ticket tip: Upgrade to Deutschlandticket for €22. The upgrade costs €22 a month on top of your semester ticket. Book it for months you travel; cancel by the 10th for the next month.",
    "source": "RVV, semester ticket: from 1 Oct 2026 the Regensburg student surcharge is €22.00 a month; a monthly subscription, cancelled by the 10th of the month",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "10th abonnement abono advic ahorrar ahorro astuc barato billet billig book bus cancel cheap cher conseil consejo cost deutschlandticket economi economis erweiter free grati gratuit gunstig kostenlo month nahverkehr next opnv pasa pass public rat rvv save saving semest semesterticket semestral semestriel spar ticket tip tipp tips top trai transport travel truco upgrad"
  },
  {
    "id": "tip:try-university-sport",
    "kind": "tip",
    "categoryId": "gym",
    "text": "Gym & sports tip: Try university sport before a gym. URsport at the UR Sportzentrum has a gym, pool, sauna and courses at a student rate for UR and OTH students. Compare before you sign up.",
    "source": "Universität Regensburg Sportzentrum, URsport platform: UR and OTH students sign in and buy at the student rate; gym, pool and sauna through the app",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro ante astuc avant barato befor bevor billig cheap cher compar conseil consejo cours deport economi economis essai exercis fitnes fitnessstudio free gehst gimnasio grati gratuit gunstig gym hochschulsport kostenlo musculatio oth pool probi prueba rat rate sall sauna save saving sign spar sport sportzentrum student tip tipp tips training truco try universitair universitario university ursport workout"
  },
  {
    "id": "tip:split-the-rundfunkbeitrag",
    "kind": "tip",
    "categoryId": "utilities",
    "text": "Utilities & Rundfunkbeitrag tip: Share one Rundfunkbeitrag per flat. The fee is €18.36 a month per flat, not per person. In a WG one person registers and you split it; the others deregister.",
    "source": "ARD ZDF Deutschlandradio Beitragsservice, information for students: €18.36 a month per flat; only one adult per flat registers and pays",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro astuc audiovisuell barato bezahl billig broadcasting charg cheap cher compart conseil consejo deregist economi economis fee flat free gebuhr gez grati gratuit gunstig kostenlo licenc licens logement month nebenkost other pagar paie pay payer payment perso piso pro radio rat redevanc register rundfunkbeitrag save saving shar solo spar split suministro tasa teilt televisio tip tipp tips truco utiliti wohnung zahl"
  },
  {
    "id": "tip:rundfunkbeitrag-bafoeg-exemption",
    "kind": "tip",
    "categoryId": "utilities",
    "text": "Utilities & Rundfunkbeitrag tip: Apply for a Rundfunkbeitrag exemption. If you get BAföG and do not live with your parents, apply for an exemption from the €18.36 monthly fee. It is not automatic.",
    "source": "ARD ZDF Deutschlandradio Beitragsservice, information for students: BAföG recipients who do not live with their parents can be exempted on application",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "advic ahorrar ahorro apply astuc audiovisuell automatic bafog barato beantrag befreiung bezahl billig broadcasting charg cheap cher conseil consejo demand economi economis exemptio exencio exoneratio fee flat free gebuhr gez grati gratuit gunstig kostenlo licenc licens live monthly nebenkost pagar parent pay payer payment pide radio rat redevanc rundfunkbeitrag save saving spar suministro tasa televisio tip tipp tips truco utiliti zahl"
  },
  {
    "id": "discount:asia-restaurant-sunrise",
    "kind": "discount",
    "categoryId": "eating-out",
    "text": "Eating out discount: Asia Restaurant Sunrise, Von-Seeckt-Straße 23, 93053 Regensburg: 10% off. Students, every day, on showing a student ID. Not combined with other offers or discounts.",
    "source": "Asia Restaurant Sunrise, home page: 10% off for students, Mon–Sun, on showing a student ID; not combined with other offers or discounts",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "abendess almuerzo angebot asia auswart barato billig cafeteria cante cantin cena cheap cher combined comedor comer day deal dehor dejeun descuento diner dinn discount eat eating ermassigt ermassigung esse estudiant etudiant fuera gunstig kantin lunch mang meal mensa mittagess oferta off offer offr pric rabatt rebaja reduced reductio remis repa restaurant resto seeckt showing strass student studentenrabatt sunris takeaway tarif vergunstigung"
  },
  {
    "id": "discount:mensa-childrens-plate",
    "kind": "discount",
    "categoryId": "eating-out",
    "text": "Eating out discount: Mensa Uni Regensburg, Albertus-Magnus-Straße 2, 93053 Regensburg: A free children's plate for your child, up to their sixth year. For student parents who also have lunch in the Mensa (the university canteen), with a children's-plate Mensa card. You get it at the Mensa card office (Info-Punkt) with a copy of the child's birth certificate and your certificate of enrolment.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg: children of students get a free children's plate up to their sixth year when the parent also has lunch in the Mensa, with a Kinderteller Mensa card from the Mensa card office",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "abendess albertu almuerzo angebot anne ano assiett auswart barato billig birth cafeteria cante cantin card cena certificat cheap cher child childr comedor comer copy deal dehor dejeun descuento diner dinn discount eat eating enfant enrolment ermassigt ermassigung esse estudiant etudiant free fuera grati gratuit gunstig hija hijo infantil info jusqu kantin kind kindertell kostenlos lebensjahr lunch magnu mang meal mensa mittagess oferta offer offic offr parent plat plato pric punkt rabatt rebaja reduced reductio remis repa restaurant resto sechst seinem sexto sixiem sixth strass student studentenrabatt takeaway tarif uni university vergunstigung year"
  },
  {
    "id": "discount:kinos-im-andreasstadel",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Kinos im Andreasstadel, Andreasstraße 28, 93059 Regensburg: €8 instead of €9 per ticket. Students, with valid proof. Special screenings may be priced differently. Booking online in advance adds 10%; reserving a seat is free.",
    "source": "Kinos im Andreasstadel, ticket prices: €9 regular, €8 reduced for students with valid proof; online advance sale adds 10%; reservations are free; prices for special screenings may differ",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "adds advanc andreasstadel andreasstrass angebot ausgeh barato billet billig booking bouldering bowling cheap cher cine cinema climbing club clubbing concert concierto cultur cultura deal descuento differently discount entrada ermassigt ermassigung escalad escalada estudiant etudiant feier fete fiesta film free freizeit fun going gunstig instead kart kino kletter konzert kultur leisur lieu loisir lugar may movi muse museo museum ocio oferta offer offr onlin party piscin piscina pool pric priced pro proof rabatt rebaja reduced reductio remis reserving salir schwimm schwimmbad screening seat skating soire sorti sortir special statt student studentenrabatt swimming tarif teatro theat theatr ticket valid vergunstigung weekend"
  },
  {
    "id": "discount:staatstheater-regensburg",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Staatstheater Regensburg, Bismarckplatz 7, 93047 Regensburg: Half price on regular tickets, and any seat for €10 at shows marked U30 (under 30). Students until their 30th birthday, for tickets in general sale. U30 shows are on selected dates. Show your proof with your ticket at the entrance. Online or by phone there is a €1.50 fee per ticket; at the theatre's box office or evening box office there is none.",
    "source": "Staatstheater Regensburg, visitor FAQ: 50% off the regular price in general sale (Freiverkauf) for students until their 30th birthday; U30 shows on selected dates, €10 for any seat; €1.50 fee per ticket online or by phone, none at the box office or evening box office",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "30th angebot ans asiento ausgeh barato billet billig birthday bismarckplatz bouldering bowling box cheap cher cine cinema climbing club clubbing concert concierto cualqui cultur cultura date deal descuento discount entrada entranc ermassigt ermassigung escalad escalada estudiant etudiant evening fee feier fete fiesta film freizeit fun funcion general going gunstig halb half import jeder kart kennzeichnung kino kletter konzert kultur leisur loisir marcada marked marque menor mitad moiti movi muse museo museum none normal normaux ocio oferta offer offic offr onlin party phon piscin piscina plac platz pool precio prei pric prix proof rabatt rebaja reduced reductio regular remis representation sale salir schwimm schwimmbad seat selected show skating soire sorti sortir staatstheat student studentenrabatt swimming tarif teatro theat theatr ticket u30 under until vergunstigung vorstellung weekend"
  },
  {
    "id": "discount:regensburger-turmtheater",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Regensburger Turmtheater, Watmarkt 5, 93047 Regensburg: €16 instead of €32 for regular shows. Students, pupils and trainees. A show with other prices says so in its description.",
    "source": "Regensburger Turmtheater, tickets: regular shows €32; pupils, students and trainees 50% off (€16); other prices are given in the show descriptions",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "angebot ausgeh barato billig bouldering bowling cheap cher cine cinema climbing club clubbing concert concierto cultur cultura deal descriptio descuento discount ermassigt ermassigung escalad escalada estudiant etudiant feier fete fiesta film freizeit fun funcion going gunstig instead kino kletter konzert kultur leisur lieu loisir lugar movi muse museo museum normal ocio oferta offer offr party piscin piscina pool pric pupil rabatt rebaja reduced reductio regensburg regular remis representation salir says schwimm schwimmbad show skating soire sorti sortir statt student studentenrabatt swimming tarif teatro theat theatr traine turmtheat vergunstigung vorstellung watmarkt weekend"
  },
  {
    "id": "discount:kunstforum-ostdeutsche-galerie",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Kunstforum Ostdeutsche Galerie, Dr.-Johann-Maier-Str. 5, 93049 Regensburg: €4 instead of €6 entry. Students, pupils and trainees.",
    "source": "Kunstforum Ostdeutsche Galerie, your visit: entry €6, reduced €4; pupils, students and trainees are on the list of those who pay the reduced price",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "angebot ausgeh barato billig bouldering bowling cheap cher cine cinema climbing club clubbing concert concierto cultur cultura deal descuento discount eintritt entrada entre entry ermassigt ermassigung escalad escalada estudiant etudiant feier fete fiesta film freizeit fun galeri going gunstig instead johan kino kletter konzert kultur kunstforum leisur lieu loisir lugar maier movi muse museo museum ocio oferta offer offr ostdeutsch party piscin piscina pool pric pupil rabatt rebaja reduced reductio remis salir schwimm schwimmbad skating soire sorti sortir statt str student studentenrabatt swimming tarif teatro theat theatr traine vergunstigung weekend"
  },
  {
    "id": "discount:document-kepler",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: document Kepler, Keplerstraße 5, 93047 Regensburg: Free entry instead of €5. Students under 30, on showing an ID. Public guided tours are priced separately.",
    "source": "Museen der Stadt Regensburg, document Kepler: adults €5; free for students under 30 on showing an ID; public guided tours €8, reduced €5",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "angebot ausgeh barato billig bouldering bowling cheap cher cine cinema climbing club clubbing concert concierto cultur cultura deal descuento discount document eintritt entrada entre entry ermassigt ermassigung escalad escalada estudiant etudiant feier fete fiesta film free frei freizeit fun going grati gratuit guided gunstig instead kepl keplerstrass kino kletter konzert kultur leisur lieu loisir lugar movi muse museo museum ocio oferta offer offr party piscin piscina pool pric priced public rabatt rebaja reduced reductio remis salir schwimm schwimmbad separately showing skating soire sorti sortir statt student studentenrabatt swimming tarif teatro theat theatr tour under vergunstigung weekend"
  },
  {
    "id": "discount:schloss-thurn-und-taxis",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Schloss Thurn und Taxis, Emmeramsplatz 5, 93047 Regensburg: €14 instead of €17 for the guided tour of the state rooms and cloister; €4 instead of €6 for the Treasury and the Marstall (carriage museum). Students, on showing a student ID. The state rooms are open only on a guided tour.",
    "source": "Fürst Thurn und Taxis, visiting Schloss St. Emmeram: guided tour of the state rooms and cloister (Prunkräume & Kreuzgang) €17, reduced €14; Treasury and Marstall €6, reduced €4; reduced for pupils and students on showing their ID",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "angebot apparat ausgeh barato billig bouldering bowling camara carriag carross carruaj cheap cher cine cinema claustro climbing cloist cloitr club clubbing concert concierto cultur cultura deal descuento discount emmeramsplatz ermassigt ermassigung escalad escalada estudiant etudiant feier fete fiesta film freizeit fuhrung fun gala going guiada guide guided gunstig instead kino kletter konzert kreuzgang kultur kutschenmuseum leisur lieu loisir lugar marstall movi muse museo museum ocio oferta offer offr open party piscin piscina pool pric prunkraum rabatt rebaja reduced reductio remis room sala salir sall schatzkamm schlos schwimm schwimmbad showing skating soire sorti sortir stat statt student studentenrabatt swimming tarif taxi teatro tesoro theat theatr thur tour treasury tresor vergunstigung visit visita weekend"
  },
  {
    "id": "discount:westbad",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Westbad, Messerschmittstraße 4, 93049 Regensburg: €4.60 instead of €7.20 for 3 hours; €6.50 instead of €10 for the day. Students aged 15 until their 25th birthday, with valid proof such as a student ID (and an official photo ID if asked) shown at the entrance. Proof brought later is not accepted.",
    "source": "das Stadtwerk Regensburg, Westbad prices: 3 hours €7.20, day €10.00; reduced €4.60 and €6.50 for pupils, students and trainees from 15 until their 25th birthday; proof at the entrance, not later",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "25th accepted aged angebot asked ausgeh barato billig birthday bouldering bowling brought cheap cher cine cinema climbing club clubbing concert concierto cultur cultura day deal descuento dia discount entranc ermassigt ermassigung escalad escalada estudiant etudiant feier fete fiesta film freizeit fun ganz going gunstig heur hora hour instead journe kino kletter konzert kultur later leisur lieu loisir lugar messerschmittstrass movi muse museo museum ocio oferta offer official offr party photo piscin piscina pool pric proof rabatt rebaja reduced reductio remis salir schwimm schwimmbad show skating soire sorti sortir statt student studentenrabatt stund swimming tag tarif teatro theat theatr until valid vergunstigung weekend westbad"
  },
  {
    "id": "discount:sportpark-ost-pool",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Sportpark Ost pool, Zeißstraße 61, 93053 Regensburg: €2.90 instead of €5 per visit. Students aged 15 until their 25th birthday, with valid proof such as a student ID (and an official photo ID if asked) shown at the entrance. Proof brought later is not accepted.",
    "source": "das Stadtwerk Regensburg, Sportpark Ost pool prices: single entry €5.00, reduced €2.90 for pupils, students and trainees from 15 until their 25th birthday; proof at the entrance, not later",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "25th accepted aged angebot asked ausgeh barato besuch billig birthday bouldering bowling brought cheap cher cine cinema climbing club clubbing concert concierto cultur cultura deal descuento discount entranc entre ermassigt ermassigung escalad escalada estudiant etudiant feier fete fiesta film freizeit fun going gunstig hallenbad instead kino kletter konzert kultur later leisur lieu loisir lugar movi muse museo museum ocio oferta offer official offr ost party photo piscin piscina pool pric pro proof rabatt rebaja reduced reductio remis salir schwimm schwimmbad show skating soire sorti sortir sportpark statt student studentenrabatt swimming tarif teatro theat theatr until valid vergunstigung visit visita weekend zeissstrass"
  },
  {
    "id": "discount:donau-arena-skating",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Donau-Arena, Walhalla-Allee 24, 93059 Regensburg: €5 instead of €6 for public ice skating; €6 instead of €7 for disco skating (Discolauf). Students aged 15 until their 25th birthday, with valid proof such as a student ID (and an official photo ID if asked) shown at the entrance. Proof brought later is not accepted. In the skating season only.",
    "source": "das Stadtwerk Regensburg, Donau-Arena public skating prices: single entry €6, reduced €5; Discolauf €7, reduced €6; reduced for pupils, students and trainees from 15 until their 25th birthday; proof at the entrance, not later",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "25th accepted aged alle angebot arena asked ausgeh barato billig birthday bouldering bowling brought cheap cher cine cinema climbing club clubbing concert concierto cultur cultura deal descuento disco discolauf discount donau eislauf entranc ermassigt ermassigung escalad escalada estudiant etudiant feier fete fiesta film freizeit fun going gunstig hielo ice instead kino kletter konzert kultur later leisur lieu loisir lugar movi muse museo museum musica ocio oferta offentlich offer official offr party patinag patinaj photo piscin piscina pool pric proof public publico rabatt rebaja reduced reductio remis salir schwimm schwimmbad seaso show skating soire sorti sortir statt student studentenrabatt swimming tarif teatro theat theatr until valid vergunstigung walhalla weekend"
  },
  {
    "id": "discount:boulderwelt-studi-monday",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Boulderwelt Regensburg, Im Gewerbepark A46, 93059 Regensburg: A day entry for €9.90 on Mondays (\"Studi Monday\"). Students and trainees with valid proof. All day on Mondays, not on public holidays. Shoe rental costs extra.",
    "source": "Boulderwelt Regensburg, prices: Studi Monday, a €9.90 day entry on Mondays all day for students and trainees with valid proof; not on public holidays; shoes rented at the counter for a fee",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "a46 angebot ausgeh barato billig bouldering boulderwelt bowling cheap cher cine cinema climbing club clubbing concert concierto cost cultur cultura day deal descuento dia discount entrada entre entry ermassigt ermassigung escalad escalada estudiant etudiant extra feier fete fiesta film freizeit fun gewerbepark going gunstig holiday journe kino kletter konzert kultur leisur loisir lundi lune monday montag movi muse museo museum ocio oferta offer offr party piscin piscina pool pric proof public rabatt rebaja reduced reductio remis rental salir schwimm schwimmbad shoe skating soire sorti sortir student studentenrabatt studi swimming tageseintritt tarif teatro theat theatr traine valid vergunstigung weekend"
  },
  {
    "id": "discount:super-bowl-student-tuesday",
    "kind": "discount",
    "categoryId": "going-out",
    "text": "Going out discount: Super Bowl Regensburg, Gewerbepark D 44, 93059 Regensburg: Bowling for €1 per game on Tuesdays. Pupils and students.",
    "source": "Super Bowl Regensburg, offers: on Tuesdays pupils and students pay €1 per game (\"Studenten Bowling\")",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "angebot ausgeh barato billig bolo bouldering bowl bowling cheap cher cine cinema climbing club clubbing concert concierto cultur cultura deal descuento dienstag discount ermassigt ermassigung escalad escalada estudiant etudiant feier fete fiesta film freizeit fun game gewerbepark going gunstig kino kletter konzert kultur leisur loisir mardi mart movi muse museo museum ocio oferta offer offr parti partida party piscin piscina pool pric pro pupil rabatt rebaja reduced reductio remis salir schwimm schwimmbad skating soire sorti sortir spiel student studentenrabatt super swimming tarif teatro theat theatr tuesday vergunstigung weekend"
  },
  {
    "id": "discount:alnatura-student-tuesday",
    "kind": "discount",
    "categoryId": "food",
    "text": "Food & groceries discount: Alnatura Super Natur Markt, Dr.-Martin-Luther-Straße 2, 93047 Regensburg: 8% off your whole purchase on Tuesdays. Students with a valid student or pupil ID shown at the till, in every Alnatura store (in Regensburg also Donaustaufer Straße 128 and Joseph-Dahlem-Straße 3). Not on bottle deposits (Pfand), gift cards, books or infant formula, and not with other discounts.",
    "source": "Alnatura, student discount: every Tuesday 8% off the whole purchase for students, trainees and pupils with a valid student or pupil ID, in all Alnatura stores; not on deposits, gift cards, books or infant formula, and not combined with other discounts. Alnatura's store finder lists the Regensburg stores at Dr.-Martin-Luther-Straße 2, Donaustaufer Straße 128 and Joseph-Dahlem-Straße 3",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "achat alimentacio alimentatio alnatura angebot barato billig book bottl card cheap cher cocinar comer comida compra cook cooking cours cuisin dahlem deal dein deposit descuento dienstag discount donaustauf eat einkauf epiceri ermassigt ermassigung esse estudiant etudiant food formula ganz gift groceri grocery gunstig infant joseph koch lebensmittel luth mang mardi markt mart marti meal natur nourritur oferta off offer offr pfand pric pupil purchas rabatt rebaja reduced reductio remis repa show stor strass student studentenrabatt super supermarch supermarket supermarkt supermercado tarif till tuesday valid vergunstigung whol"
  },
  {
    "id": "discount:bellas-kunst-student-haircut",
    "kind": "discount",
    "categoryId": "personal-care",
    "text": "Personal care discount: Bella's Kunst, Alte Manggasse 2, 93047 Regensburg: Men's student haircut: €30 instead of €36. Students. The price list states no other conditions. There is also a women's student haircut at €57, while the other women's cuts cost €48 to €70.",
    "source": "Bella's Kunst, price list: men's haircut €36, student haircut €30; women's student haircut €57; other women's cuts €48 (Schnitt Spezial), €52 (short), €65 (to shoulder length), €70 (long)",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "alte angebot barato barb bella billig care cheap cher cheveux coiffeur condition cort cosmetic cost coup cuidado cuts deal descuento discount ermassigt ermassigung estudiant etudiant friseur gunstig haar haarschnitt hair haircut hairdress herrenhaarschnitt hombr homm instead korperpfleg kunst lieu list lugar manggass men oferta offer offr pelo peluqueria personal personnel pric rabatt rebaja reduced reductio remis soin stat statt student studentenrabatt studierend tarif vergunstigung whil wome"
  },
  {
    "id": "discount:stadtbuecherei-library-card",
    "kind": "discount",
    "categoryId": "study",
    "text": "Study materials discount: Stadtbücherei Regensburg, Haidplatz 8, 93047 Regensburg: €10 instead of €17 for a year's library card. Students, on showing a student ID when the card is made or renewed.",
    "source": "Stadt Regensburg, Stadtbücherei fees: a year's card €17 for adults, €10 reduced; the rules of use it points to give the reduced card to students, trainees and pupils, on proof such as a student ID when the card is made or renewed",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "angebot annuell anual barato biblioteca bibliothek bibliothequ billig book buch bucherei card carn cart cheap cher cour cours curso deal descuento discount druck ermassigt ermassigung estudiant estudio etud etudiant gunstig haidplatz imprim imprimir instead jahresauswei lectur library libro lieu livr lugar made material oferta offer offr pric print printing rabatt rebaja reduced reductio remis renewed scan scann showing stadtbucherei statt student studentenrabatt studi studienmaterial studium study tarif textbook uni universidad universit university vergunstigung vorlesung year"
  },
  {
    "id": "discount:vhs-course-fees",
    "kind": "discount",
    "categoryId": "other",
    "text": "Other discount: Volkshochschule Regensburg, Haidplatz 8, 93047 Regensburg: 10% off course fees at the adult education centre. Regularly enrolled students, on request: show proof in person, or send a copy with the course number, at least one week before the course starts. Not combined with other reductions, not for courses the VHS only co-organises, and the VHS may exclude reductions.",
    "source": "Volkshochschule Regensburg, terms and conditions: 10% off for regularly enrolled students (ordentlich Studierende) on application, with proof at least one week before the course starts; reductions are not combined; not for events the VHS only co-organises, and the VHS may exclude reductions",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "adult adulto aide angebot argent autr ayuda barato befor billig centr centro cheap cher claim combined copy cour cours curso deal descuento dinero discount educacio educatio enrolled ermassigt ermassigung estudiant etudiant exclud fees formatio frai geld grant gunstig haidplatz kurs kursgebuhr least may money numb oferta off offer offr organis otro perso pric proof rabatt rebaja reduced reductio reduction regularly remis request send show sonstig start student studentenrabatt tarif tasa vergunstigung vhs volkshochschul week zuschus"
  },
  {
    "id": "swap:mensa-instead-of-restaurant",
    "kind": "swap",
    "categoryId": "eating-out",
    "text": "Eating out swap: Eat at the Mensa instead of a restaurant. The median main dish at the Uni Regensburg Mensa cost students €3.80 in the week of 19–23 Oct, and the cheapest €2.30. A meal at an inexpensive restaurant costs about €14.50. On a day you would eat out, the Mensa is the cheaper plate. From €14.50 to €3.80 per meal.",
    "source": "Numbeo, Meal at an Inexpensive Restaurant in Regensburg: €14.50 (crowd-sourced; for the whole city, 246 entries by 15 contributors in the past 12 months, updated 20 Oct 2026); Studierendenwerk Niederbayern/Oberpfalz, Mensa Uni Regensburg: median student price of the main dishes on the menu in the week 19–23 Oct 2026, a snapshot (the menu page shows the current week)",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "abendess ahorrar almuerzo alternativ alternativa anstatt auswart barato cafeteria cambiar cante cantin cena cheap cheapest cher come comedor comer cost day dehor dejeun diner dinn dish eat eating economis esse fuera gunstig inexpensiv instead iss kantin lugar lunch main mang meal media mensa mittagess oct plat plutot repa restaurant resto save spar statt stattdess student swap switch takeaway uni week"
  },
  {
    "id": "swap:cinema-student-price",
    "kind": "swap",
    "categoryId": "going-out",
    "text": "Going out swap: See a film at the student price. Show your student proof at Kinos im Andreasstadel: a ticket to a regular screening costs €8 instead of €9. From €9 to €8 per ticket.",
    "source": "Kinos im Andreasstadel, ticket prices: regular €9, reduced €8 for students on showing proof at the cinema; special events can differ",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "ahorrar alternativ alternativa andreasstadel anstatt ausgeh barato bouldering bowling cambiar cheap cher cine cinema climbing club clubbing concert concierto cost cultur cultura economis escalad escalada estudiant etudiant feier fete fiesta film freizeit fun geh going gunstig instead kino kletter konzert kultur leisur loisir lugar movi muse museo museum ocio party piscin piscina plutot pool precio pric proof regular salir save schwimm schwimmbad screening see show skating soire sorti sortir spar statt stattdess student studierendenprei swap swimming switch tarif teatro theat theatr ticket weekend"
  },
  {
    "id": "swap:deutschlandticket-for-travel-months",
    "kind": "swap",
    "categoryId": "transport",
    "text": "Transport swap: Book the Deutschlandticket for a month you travel. Estimate: the saving assumes one Bayern-Ticket day in the month, and every further day adds to it. A Bayern-Ticket for one day costs €34. The student upgrade to the Deutschlandticket costs €22 a month in Regensburg and is valid all day on local and regional trains across Germany. It is a monthly subscription: cancel it by the 10th of a month and it ends with that month, so you can keep it only for the months you travel. From €34 to €22 per month.",
    "source": "Estimate (assumes one Bayern-Ticket day in the month). Deutsche Bahn, Bayern-Ticket: 1 person, 2nd class, one day, €34; RVV, semester ticket: from 1 Oct 2026 the Regensburg student surcharge for the Deutschlandticket is €22.00 a month; a monthly subscription, cancelled by the 10th of the month",
    "checked": "2026-10-20",
    "estimate": true,
    "words": "10th acros adds ahorrar alternativ alternativa anstatt assum autobu bahn barato bayer bici bicicleta bicycl bike book buch bus cambiar cancel cheap cher commut contrata cost cycling day deutschlandticket economis ends estimat fahrrad fahrt furth germany gunstig instead keep local lugar mobilitat mois month monthly plutot prend regional reisemonat repair reparacio reparatio reparatur save saving spar statt stattdess student subscriptio swap switch ticket trai train transport travel tren upgrad valid velo viaj voyag zug"
  },
  {
    "id": "semester:ur:winter",
    "kind": "semester",
    "categoryId": null,
    "text": "Universität Regensburg (UR), winter semester: 1 October to 31 March.",
    "source": "Universität Regensburg, academic calendar: \"The winter semester begins on 1 October and ends on 31 March.\"",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "anfang begi begin clas comienza cour date debut empieza end ende ends fecha fin inicio lectur march octob rentre semest semesterbegin semesterend semestr start term universitat vorlesung vorlesungszeit wint"
  },
  {
    "id": "semester:ur:summer",
    "kind": "semester",
    "categoryId": null,
    "text": "Universität Regensburg (UR), summer semester: 1 April to 30 September.",
    "source": "Universität Regensburg, academic calendar: \"The summer semester lasts from 1 April to 30 September.\"",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "anfang april begi begin clas comienza cour date debut empieza end ende ends fecha fin inicio lectur rentre semest semesterbegin semesterend semestr septemb start summ term universitat vorlesung vorlesungszeit"
  },
  {
    "id": "semester:oth:winter",
    "kind": "semester",
    "categoryId": null,
    "text": "OTH Regensburg, winter semester: 1 October to 14 March.",
    "source": "OTH Regensburg, Studienstart (in German): winter semester 1 October to 14 March",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "anfang begi begin clas comienza cour date debut empieza end ende ends fecha fin inicio lectur march octob oth rentre semest semesterbegin semesterend semestr start term vorlesung vorlesungszeit wint"
  },
  {
    "id": "semester:oth:summer",
    "kind": "semester",
    "categoryId": null,
    "text": "OTH Regensburg, summer semester: 15 March to 30 September.",
    "source": "OTH Regensburg, Studienstart (in German): summer semester 15 March to 30 September",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "anfang begi begin clas comienza cour date debut empieza end ende ends fecha fin inicio lectur march oth rentre semest semesterbegin semesterend semestr septemb start summ term vorlesung vorlesungszeit"
  },
  {
    "id": "fee:oth:2027-03-15",
    "kind": "fee",
    "categoryId": null,
    "text": "OTH Regensburg, semester starting 2027-03-15: The semester fee is €215: Studierendenwerk basic contribution €87, RVV semester ticket €128. Re-registration (the fee is paid with it) opens in 2027-01.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the summer 2027 figure.; Studierendenwerk Niederbayern/Oberpfalz, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the summer 2027 figure.; OTH Regensburg, dates and opening hours (in German): \"Rückmeldung für das SoSe 2027: vorauss. ab 07.01.2027\", re-registration for summer 2027 expected to open on 7 Jan 2027",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "basic beitrag contributio cotisatio cuota einschreibung enrollment enrolment fee fees frai gebuhr inscriptio matricula open oth pagar paid pay payer registratio reinscriptio ruckmeldung rvv semest semesterbeitrag starting studierendenwerk tasa ticket zahl"
  },
  {
    "id": "fee:ur:2027-04-01",
    "kind": "fee",
    "categoryId": null,
    "text": "Universität Regensburg (UR), semester starting 2027-04-01: The semester fee is €215: Studierendenwerk basic contribution €87, RVV semester ticket €128.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the summer 2027 figure.; Studierendenwerk Niederbayern/Oberpfalz, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the summer 2027 figure.",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "basic beitrag contributio cotisatio cuota einschreibung enrollment enrolment fee fees frai gebuhr inscriptio matricula pagar pay payer registratio reinscriptio ruckmeldung rvv semest semesterbeitrag starting studierendenwerk tasa ticket universitat zahl"
  },
  {
    "id": "fee:oth:2027-10-01",
    "kind": "fee",
    "categoryId": null,
    "text": "OTH Regensburg, semester starting 2027-10-01: The semester fee is €222: Studierendenwerk basic contribution €92, RVV semester ticket €130.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the winter 2027/28 figure.; Studierendenwerk Niederbayern/Oberpfalz, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the winter 2027/28 figure.",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "basic beitrag contributio cotisatio cuota einschreibung enrollment enrolment fee fees frai gebuhr inscriptio matricula oth pagar pay payer registratio reinscriptio ruckmeldung rvv semest semesterbeitrag starting studierendenwerk tasa ticket zahl"
  },
  {
    "id": "fee:ur:2027-10-01",
    "kind": "fee",
    "categoryId": null,
    "text": "Universität Regensburg (UR), semester starting 2027-10-01: The semester fee is €222: Studierendenwerk basic contribution €92, RVV semester ticket €130.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the winter 2027/28 figure.; Studierendenwerk Niederbayern/Oberpfalz, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the winter 2027/28 figure.",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "basic beitrag contributio cotisatio cuota einschreibung enrollment enrolment fee fees frai gebuhr inscriptio matricula pagar pay payer registratio reinscriptio ruckmeldung rvv semest semesterbeitrag starting studierendenwerk tasa ticket universitat zahl"
  },
  {
    "id": "checklist:register-your-address",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (first weeks): Register your address. Register at the city’s registration office within two weeks of moving in.",
    "source": "Bundesmeldegesetz § 17 (1): whoever moves into a flat must register with the registration office within two weeks of moving in",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "addres administratif adress ankunft anmeld anmeldung arriv arrival arrive behord bureaucracy checklist city declar demarch direccio document empadronat erst first formular inscrir list lista llegada meld moving neu new nouveau nuevo offic papel paperwork regist registrars registratio student tramit umzug week withi woch"
  },
  {
    "id": "checklist:health-insurance-for-enrolment",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (first weeks): Have your health insurance sent to the university. Your statutory health insurer sends the proof electronically, with the university’s number H0000341; paper proof isn’t accepted. Insured privately or abroad? A statutory insurer checks your status and sends it.",
    "source": "Universität Regensburg, proof of health insurance: needed in electronic form, sent by the statutory insurer with the university number H0000341; paper proof not enough since 1 Jan 2022; private and foreign insurers cannot send it, so a statutory insurer checks the status and sends it",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "abroad accepted administratif ankunft anmeld anmeldung arriv arrival arrive assuranc behord bureaucracy check checklist comuniqu demarch document electronically erst fais first formular h0000341 haz health inscrir insur insuranc insured isn krankenversicherung lass list lista llegada maladi medico meld moving neu new nouveau nuevo numb papel paper paperwork privately proof regist registrars registratio seguro send sent statu statutory student tramit transmettr umzug uni universidad universit university week woch"
  },
  {
    "id": "checklist:residence-permit",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (first weeks, for students from abroad): Apply for your residence permit. From outside the EU? Apply to the city’s foreigners’ office before your entry visa runs out, or within your first 90 days if you came without one.",
    "source": "Universität Regensburg, International Office, residence permit for non-EU students: apply to the responsible foreigners’ office before an entry visa runs out; without a visa, within the first 90 days of the stay",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "abroad administratif ankunft anmeld anmeldung apply arriv arrival arrive aufenthaltserlaubni beantrag befor behord bureaucracy came checklist city days demand demarch document entry erst first foreigner formular inscrir list lista llegada moving neu new nouveau nuevo offic outsid papel paperwork permiso permit regist registrars registratio residenc residencia runs sejour solicita student titr tramit umzug visa week withi without woch"
  },
  {
    "id": "checklist:open-a-bank-account",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (first weeks): Open a bank account. Anyone legally resident in the EU has the right to a basic account, even without a fixed address.",
    "source": "Zahlungskontengesetz § 31 (1): every consumer legally resident in the European Union, including people without a fixed address, has the right to a basic payment account",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "abre account addres administratif ankunft anmeld anmeldung anyon arriv arrival arrive bancair bancaria bank bankkonto basic behord bureaucracy checklist compt cuenta demarch document eroffn erst even first fixed formular inscrir legally list lista llegada moving neu new nouveau nuevo open ouvr papel paperwork regist registrars registratio resident right student tramit umzug week without woch"
  },
  {
    "id": "checklist:register-for-the-rundfunkbeitrag",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (first weeks): Sort out the Rundfunkbeitrag. One adult per flat registers and pays it; in a shared flat, agree who does.",
    "source": "ARD ZDF Deutschlandradio Beitragsservice, information for students: €18.36 a month per flat; only one adult per flat registers and pays",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "administratif adult agre ankunft anmeld anmeldung arriv arrival arrive audiovisuell behord bureaucracy checklist demarch document erst first flat formular inscrir kummer list lista llegada moving neu new nouveau nuevo ocupat papel paperwork pays radiodifusio redevanc regist register registrars registratio regl rundfunkbeitrag shared sort student tasa tramit umzug week woch"
  },
  {
    "id": "checklist:apply-for-bafoeg",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (money to claim): Apply for BAföG. Apply through BAföG Digital as early as you can: it is paid from the month your application arrives, never before your studies begin.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, BAföG: apply through BAföG Digital, as early as possible; funding is granted from the month the application arrives, at the earliest from the start of studies; the Regensburg office serves Universität Regensburg and OTH Regensburg",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "administratif ankunft anmeld anmeldung applicatio apply arriv arrival arrive bafog beantrag befor begi behord bureaucracy checklist claim demand demarch digital document early erst first formular inscrir list lista llegada money month moving neu never new nouveau nuevo paid papel paperwork regist registrars registratio solicita student studi through tramit umzug week woch"
  },
  {
    "id": "checklist:claim-the-study-start-grant",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (money to claim, for students under 25): Claim the study start grant. Starting your first degree under 25 and on social benefits? A one-off €1,000 that you never pay back.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, BAföG Studienstarthilfe: a one-off €1,000 grant, not repaid, for first-time full-time students under 25 who receive social benefits; apply via BAföG Digital by the end of the month after the start",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "administratif aide ankunft anmeld anmeldung arriv arrival arrive ayuda back behord benefit bureaucracy checklist claim degre demand demarch demarrag document empezar erst estudiar etud first formular grant hol inscrir list lista llegada money moving neu never new nouveau nuevo off papel paperwork pay pide regist registrars registratio social start starting student studienstarthilf study tramit umzug under week woch"
  },
  {
    "id": "checklist:keep-kindergeld",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (money to claim, for students under 25): Keep Kindergeld coming. Your parents can get Kindergeld for you during a first degree, until the day before your 25th birthday.",
    "source": "Bundesagentur für Arbeit, Familienkasse, Kindergeld from 18: paid between 18 and the completed 25th year for a child in a first training or degree; the 25th year ends with the day before the 25th birthday",
    "checked": "2026-11-10",
    "estimate": false,
    "words": "25th administratif allocation ankunft anmeld anmeldung arriv arrival arrive befor behord birthday bureaucracy checklist claim coming dafur day degre demarch document during erst familial first formular gard hijo inscrir keep kindergeld list lista llegada mant money moving neu new nouveau nuevo papel paperwork parent prestacio regist registrars registratio sorg student tramit umzug under until week weiterlauft woch"
  },
  {
    "id": "checklist:stay-on-family-insurance",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (money to claim, for students under 25): Stay on family health insurance. Free until your 25th birthday while you earn little. Check before you take on a bigger job.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, health and care insurance: free family insurance until the 25th birthday; in 2026 up to €565 a month from a regular job or €603 from a minijob",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "25th administratif ankunft anmeld anmeldung arriv arrival arrive assuranc befor behord bigg birthday bleib bureaucracy check checklist claim demarch document earn erst familial familiar familienversicherung family first formular free health inscrir insuranc job list lista littl llegada money moving neu new nouveau nuevo papel paperwork regist registrars registratio rest seguro sigu stay student take tramit umzug under until week whil woch"
  },
  {
    "id": "checklist:check-wohngeld",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (money to claim): Check Wohngeld. No BAföG entitlement in principle? Wohngeld may help with rent, with Regensburg as your main residence.",
    "source": "Studierendenwerk Niederbayern/Oberpfalz, Wohngeld: possible only without a BAföG entitlement in principle, and the study town must be the main residence",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "administratif aide alquil ankunft anmeld anmeldung arriv arrival arrive ayuda bafog behord bureaucracy check checklist claim comprueba demarch document entitlement erst first formular help inscrir list lista llegada logement main may money moving neu new nouveau nuevo papel paperwork principl pruf regist registrars registratio rent residenc student tramit umzug verifi week woch wohngeld"
  },
  {
    "id": "checklist:rundfunkbeitrag-exemption",
    "kind": "checklist",
    "categoryId": null,
    "text": "Checklist for new students (money to claim, for students on BAföG): Apply for the Rundfunkbeitrag exemption. On BAföG and not living with your parents? You can be exempted, on application.",
    "source": "ARD ZDF Deutschlandradio Beitragsservice, information for students: BAföG recipients who do not live with their parents can be exempted on application",
    "checked": "2026-10-20",
    "estimate": false,
    "words": "administratif ankunft anmeld anmeldung applicatio apply arriv arrival arrive bafog beantrag befreiung behord bureaucracy checklist claim demand demarch document erst exempted exemptio exencio exoneratio first formular inscrir list lista living llegada money moving neu new nouveau nuevo papel paperwork parent redevanc regist registrars registratio rundfunkbeitrag solicita student tasa tramit umzug week woch"
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
