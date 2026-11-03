import type { DiscountWords } from '..';

// Die Rabatte auf Deutsch, nach ihrer id (src/data/discounts.ts). Nur die Worte: Orte behalten ihren Namen (außer
// einem mit einem gewöhnlichen Wort darin), Adressen bleiben, wie der Ort sie angibt. Jede Zahl der englischen Fassung
// steht auch hier (getestet in city.test.ts).

const STADTWERK = 'das Stadtwerk Regensburg';
const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';
/** Bei den Bädern und der Eishalle des Stadtwerks gilt der Studierendenpreis so, und alle drei Seiten sagen es. */
const STADTWERK_STUDENTS =
  'Studierende von 15 Jahren bis zum 25. Geburtstag, mit gültigem Nachweis wie dem Studierendenausweis (und auf Nachfrage einem amtlichen Lichtbildausweis), am Eingang vorgezeigt. Ein später nachgereichter Nachweis zählt nicht.';
const PUPILS_STUDENTS_TRAINEES = 'Schülerinnen und Schüler, Studierende und Auszubildende';

export const discounts: Record<string, DiscountWords> = {
  'asia-restaurant-sunrise': {
    offer: '10 % Rabatt',
    conditions: 'Studierende, jeden Tag, gegen Vorlage des Studierendenausweises. Nicht mit anderen Angeboten oder Rabatten kombinierbar.',
    source: 'Asia Restaurant Sunrise, Startseite: 10 % Rabatt für Studierende, Mo–So, gegen Vorlage des Studierendenausweises; nicht mit anderen Angeboten oder Rabatten kombinierbar',
  },
  'mensa-childrens-plate': {
    offer: 'Ein kostenloser Kinderteller für dein Kind, bis zu seinem sechsten Lebensjahr',
    conditions:
      'Für studierende Eltern, die ebenfalls in der Mensa zu Mittag essen, mit einer Kinderteller-Mensakarte. Die bekommst du in der Mensakartenstelle (Info-Punkt) mit einer Kopie der Geburtsurkunde deines Kindes und deiner Immatrikulationsbescheinigung.',
    source: `${STWNO}, Mensa Uni Regensburg: Kinder von Studierenden bekommen bis zu ihrem sechsten Lebensjahr einen kostenlosen Kinderteller, wenn der Elternteil ebenfalls in der Mensa zu Mittag isst, mit einer Kinderteller-Mensakarte aus der Mensakartenstelle`,
  },
  'kinos-im-andreasstadel': {
    offer: '8 € statt 9 € pro Karte',
    conditions:
      'Studierende, mit gültigem Nachweis. Sondervorstellungen können anders kosten. Online im Vorverkauf kommen 10 % dazu; einen Platz zu reservieren ist kostenlos.',
    source: 'Kinos im Andreasstadel, Eintrittspreise: 9 € regulär, 8 € ermäßigt für Studierende mit gültigem Nachweis; der Online-Vorverkauf kostet 10 % mehr; Reservierungen sind kostenlos; Preise für Sondervorstellungen können abweichen',
  },
  'staatstheater-regensburg': {
    offer: 'Halber Preis für reguläre Karten, und jeder Platz für 10 € bei Vorstellungen mit U30-Kennzeichnung (unter 30)',
    conditions:
      'Studierende bis zum 30. Geburtstag, für Karten im Freiverkauf. U30-Vorstellungen gibt es an ausgewählten Terminen. Zeig deinen Nachweis mit der Karte am Eingang. Online oder telefonisch kostet jede Karte 1,50 € Gebühr; an der Theaterkasse oder der Abendkasse nichts.',
    source: 'Staatstheater Regensburg, Besucher-FAQ: 50 % Ermäßigung auf den regulären Preis im Freiverkauf für Studierende bis zum 30. Geburtstag; U30-Vorstellungen an ausgewählten Terminen, 10 € auf jedem Platz; 1,50 € Gebühr pro Karte online oder telefonisch, keine an der Theaterkasse oder Abendkasse',
  },
  'regensburger-turmtheater': {
    offer: '16 € statt 32 € für reguläre Vorstellungen',
    conditions: `${PUPILS_STUDENTS_TRAINEES}. Hat eine Vorstellung andere Preise, steht das in ihrer Beschreibung.`,
    source: `Regensburger Turmtheater, Karten: reguläre Vorstellungen 32 €; ${PUPILS_STUDENTS_TRAINEES} 50 % Ermäßigung (16 €); andere Preise stehen in den Beschreibungen der Vorstellungen`,
  },
  'kunstforum-ostdeutsche-galerie': {
    offer: '4 € statt 6 € Eintritt',
    conditions: `${PUPILS_STUDENTS_TRAINEES}.`,
    source: `Kunstforum Ostdeutsche Galerie, Ihr Besuch: Eintritt 6 €, ermäßigt 4 €; ${PUPILS_STUDENTS_TRAINEES} stehen auf der Liste derer, die den ermäßigten Preis zahlen`,
  },
  'document-kepler': {
    offer: 'Freier Eintritt statt 5 €',
    conditions: 'Studierende unter 30, gegen Vorlage eines Ausweises. Öffentliche Führungen kosten extra.',
    source: 'Museen der Stadt Regensburg, document Kepler: Erwachsene 5 €; frei für Studierende unter 30 gegen Vorlage eines Ausweises; öffentliche Führungen 8 €, ermäßigt 5 €',
  },
  'schloss-thurn-und-taxis': {
    offer:
      '14 € statt 17 € für die Führung durch Prunkräume und Kreuzgang; 4 € statt 6 € für Schatzkammer und Marstall (Kutschenmuseum)',
    conditions: 'Studierende, gegen Vorlage des Studierendenausweises. Die Prunkräume sind nur mit Führung zu sehen.',
    source: 'Fürst Thurn und Taxis, Besuch von Schloss St. Emmeram: Führung durch Prunkräume & Kreuzgang 17 €, ermäßigt 14 €; Schatzkammer und Marstall 6 €, ermäßigt 4 €; ermäßigt für Schülerinnen und Schüler sowie Studierende gegen Vorlage ihres Ausweises',
  },
  westbad: {
    offer: '4,60 € statt 7,20 € für 3 Stunden; 6,50 € statt 10 € für den ganzen Tag',
    conditions: STADTWERK_STUDENTS,
    source: `${STADTWERK}, Preise Westbad: 3 Stunden 7,20 €, Tageskarte 10,00 €; ermäßigt 4,60 € und 6,50 € für ${PUPILS_STUDENTS_TRAINEES} von 15 Jahren bis zum 25. Geburtstag; Nachweis am Eingang, nicht nachträglich`,
  },
  'sportpark-ost-pool': {
    place: 'Hallenbad Sportpark Ost',
    offer: '2,90 € statt 5 € pro Besuch',
    conditions: STADTWERK_STUDENTS,
    source: `${STADTWERK}, Preise Hallenbad Sportpark Ost: Einzeleintritt 5,00 €, ermäßigt 2,90 € für ${PUPILS_STUDENTS_TRAINEES} von 15 Jahren bis zum 25. Geburtstag; Nachweis am Eingang, nicht nachträglich`,
  },
  'donau-arena-skating': {
    offer: '5 € statt 6 € beim öffentlichen Eislauf; 6 € statt 7 € beim Discolauf',
    conditions: `${STADTWERK_STUDENTS} Nur in der Eislaufsaison.`,
    source: `${STADTWERK}, Preise öffentlicher Eislauf in der Donau-Arena: Einzeleintritt 6 €, ermäßigt 5 €; Discolauf 7 €, ermäßigt 6 €; ermäßigt für ${PUPILS_STUDENTS_TRAINEES} von 15 Jahren bis zum 25. Geburtstag; Nachweis am Eingang, nicht nachträglich`,
  },
  'boulderwelt-studi-monday': {
    offer: 'Tageseintritt für 9,90 € am Montag („Studi Monday“)',
    conditions: 'Studierende und Auszubildende mit gültigem Nachweis. Montags den ganzen Tag, nicht an Feiertagen. Leihschuhe kosten extra.',
    source: 'Boulderwelt Regensburg, Preise: Studi Monday, ein Tageseintritt für 9,90 € montags den ganzen Tag für Studierende und Auszubildende mit gültigem Nachweis; nicht an Feiertagen; Schuhe gegen Gebühr an der Theke',
  },
  'super-bowl-student-tuesday': {
    offer: 'Bowling für 1 € pro Spiel am Dienstag',
    conditions: 'Schülerinnen und Schüler sowie Studierende.',
    source: 'Super Bowl Regensburg, Angebote: Dienstags zahlen Schülerinnen und Schüler sowie Studierende 1 € pro Spiel („Studenten Bowling“)',
  },
  'alnatura-student-tuesday': {
    offer: '8 % Rabatt auf deinen ganzen Einkauf am Dienstag',
    conditions:
      'Studierende mit gültigem Studierenden- oder Schülerausweis, an der Kasse vorgezeigt, in jedem Alnatura-Markt (in Regensburg auch Donaustaufer Straße 128 und Joseph-Dahlem-Straße 3). Nicht auf Pfand, Gutscheine, Bücher oder Säuglingsnahrung und nicht mit anderen Rabatten.',
    source: 'Alnatura, Studierendenrabatt: jeden Dienstag 8 % Rabatt auf den ganzen Einkauf für Studierende, Auszubildende sowie Schülerinnen und Schüler mit gültigem Studierenden- oder Schülerausweis, in allen Alnatura-Märkten; nicht auf Pfand, Gutscheine, Bücher oder Säuglingsnahrung und nicht mit anderen Rabatten kombinierbar. Die Marktsuche von Alnatura nennt in Regensburg die Märkte Dr.-Martin-Luther-Straße 2, Donaustaufer Straße 128 und Joseph-Dahlem-Straße 3',
  },
  'bellas-kunst-student-haircut': {
    offer: 'Studierenden-Herrenhaarschnitt: 30 € statt 36 €',
    conditions:
      'Studierende. Die Preisliste nennt keine weiteren Bedingungen. Es gibt auch einen Studierenden-Damenhaarschnitt für 57 €, während die anderen Damenschnitte 48 € bis 70 € kosten.',
    source: "Bella's Kunst, Preisliste: Herrenhaarschnitt 36 €, Studierendenhaarschnitt 30 €; Studierenden-Damenhaarschnitt 57 €; andere Damenschnitte 48 € (Schnitt Spezial), 52 € (kurz), 65 € (bis Schulterlänge), 70 € (lang)",
  },
  'stadtbuecherei-library-card': {
    offer: '10 € statt 17 € für einen Jahresausweis der Bücherei',
    conditions: 'Studierende, gegen Vorlage des Studierendenausweises beim Ausstellen oder Verlängern des Ausweises.',
    source: 'Stadt Regensburg, Gebühren der Stadtbücherei: Jahresausweis 17 € für Erwachsene, ermäßigt 10 €; die verlinkte Benutzungsordnung gibt den ermäßigten Ausweis Studierenden, Auszubildenden sowie Schülerinnen und Schülern, gegen einen Nachweis wie den Studierendenausweis beim Ausstellen oder Verlängern',
  },
  'vhs-course-fees': {
    offer: '10 % Rabatt auf Kursgebühren an der Volkshochschule',
    conditions:
      'Ordentlich Studierende, auf Antrag: Zeig den Nachweis persönlich oder schick eine Kopie mit der Kursnummer, spätestens eine Woche vor Kursbeginn. Nicht mit anderen Ermäßigungen kombinierbar, nicht für Kurse, die die VHS nur mitveranstaltet, und die VHS kann Ermäßigungen ausschließen.',
    source: 'Volkshochschule Regensburg, AGB: 10 % Rabatt für ordentlich Studierende auf Antrag, mit Nachweis spätestens eine Woche vor Kursbeginn; Ermäßigungen werden nicht kombiniert; nicht für Veranstaltungen, die die VHS nur mitveranstaltet, und die VHS kann Ermäßigungen ausschließen',
  },
};
