import type { TipWords } from '..';

// Die Tipps auf Deutsch, nach ihrer id (src/data/tips.ts). Nur die Worte: Zahlen, Links, Prüfdaten und Kategorien
// bleiben in den Daten, und jede Zahl der englischen Fassung steht auch hier (getestet in city.test.ts). Namen von
// Orten, Stellen und Angeboten bleiben, wie sie heißen.

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';

export const tips: Record<string, TipWords> = {
  'cafeteria-surprise-bags': {
    title: 'Hol dir eine Überraschungstüte in der Cafeteria',
    body: 'Die Cafeterien Milchbar, Sammelgebäude (UR) und Architektur (OTH) verkaufen in den letzten 30 Minuten Reste günstig über Too Good To Go.',
    source: `${STWNO}, Seite zu Lebensmittelabfällen: Überraschungstüten über Too Good To Go in den letzten 30 Minuten in den Cafeterien Milchbar, Sammelgebäude und Architektur, nicht jeden Tag`,
  },
  'eat-at-the-mensa': {
    title: 'Iss in der Mensa',
    body: 'Hauptgerichte in der Mensa der Uni Regensburg gibt es für Studierende ab 2,30 €. Gäste zahlen für denselben Teller 6,10 €.',
    source: `${STWNO}, Speiseplan der Mensa Uni Regensburg: Das günstigste Hauptgericht kostete an jedem Werktag vom 19. bis 30. Okt. 2026 2,30 € für Studierende, 3,30 € für Bedienstete und 6,10 € für Gäste (der Speiseplan wechselt täglich)`,
  },
  'tap-your-student-id': {
    title: 'Leg an der Kasse deinen Studierendenausweis auf',
    body: 'Zahlst du mit Karte oder Handy? Leg zusätzlich deinen Studierendenausweis auf das Kassenterminal, sonst zahlst du den höheren Preis.',
    source: `${STWNO}, Seite der Mensa Uni Regensburg: Die Kassen nehmen kein Bargeld; zusätzlich die Mensakarte oder den Studierendenausweis auf das Terminal legen, um den Studierendenpreis zu bekommen`,
  },
  'theatre-at-half-price': {
    title: 'Geh zum halben Preis ins Theater',
    body: 'Studierende unter 30 zahlen am Staatstheater den halben Preis; U30-Vorstellungen kosten 10 € auf jedem Platz. Kauf an der Theaterkasse, dann sparst du die Gebühr von 1,50 €.',
    source: 'Staatstheater Regensburg, Besucher-FAQ: 50 % Ermäßigung auf den regulären Preis bis zum 30. Geburtstag; U30-Vorstellungen 10 € auf jedem Platz; 1,50 € Gebühr pro Karte online oder telefonisch, keine an der Theaterkasse',
  },
  'historisches-museum-free': {
    title: 'Besuch das Historische Museum kostenlos',
    body: 'Studierende unter 30 kommen kostenlos ins Historische Museum der Stadt (Erwachsene zahlen 5 €). Bring deinen Studierendenausweis mit.',
    source: 'Museen der Stadt Regensburg, Historisches Museum: Erwachsene 5 €; kostenlos für Studierende unter 30 mit Ausweis und für alle am ersten Sonntag im Monat',
  },
  'hdbg-museum-free': {
    title: 'Besuch das Museum der Bayerischen Geschichte kostenlos',
    body: 'Studierende unter 30 kommen kostenlos ins Haus der Bayerischen Geschichte (Erwachsene zahlen 7 €), auch in die Bayernausstellung 2026/27.',
    source: 'Haus der Bayerischen Geschichte, Eintrittspreise gültig vom 8. Juli 2026 bis 7. August 2027: Erwachsene 7 €, Studierende unter 30 frei',
  },
  'cinema-student-price': {
    title: 'Reservier Kinokarten kostenlos',
    body: 'In den Kinos im Andreasstadel zahlen Studierende 8 € statt 9 €. Reservier kostenlos, statt online zu kaufen: Das kostet 10 % mehr.',
    source: 'Kinos im Andreasstadel, Eintrittspreise: 9 € regulär, 8 € ermäßigt für Studierende mit Nachweis; der Online-Vorverkauf kostet 10 % mehr; Reservierungen sind kostenlos',
  },
  'register-in-person': {
    title: 'Melde dich persönlich an und hol dir Gutscheine',
    body: 'Melde deinen Hauptwohnsitz persönlich in einem Bürgerbüro an: Das Willkommenspaket enthält Gutscheine für eine Stadtführung und einen Theaterbesuch.',
    source: 'Stadt Regensburg, Willkommenspaket: gibt es bei der persönlichen Anmeldung; mit Hauptwohnsitz enthält es Gutscheine für eine Stadtführung und einen Theaterbesuch',
  },
  'campus-bike-repair': {
    title: 'Reparier dein Rad bei Campus Bike Repair',
    body: 'Eine mobile Fahrradwerkstatt mit Werkzeug und Flickzeug kommt jede Woche auf den UR-Campus. Spezielle Ersatzteile bringst du selbst mit.',
    source: 'Universität Regensburg, UR Health „Move“: Die mobile Werkstatt Campus Bike Repair kommt wöchentlich mit Werkzeug und Flickmaterial auf den Campus; Spezialteile werden nicht gestellt',
  },
  'fashion-for-free': {
    title: 'Hol dir Kleidung bei Fashion for Free',
    body: 'Das Studierendenwerk veranstaltet jedes Semester eine kostenlose Kleidertauschbörse, und du musst keine Kleidung mitbringen. Den nächsten Termin in Regensburg findest du auf seiner News-Seite.',
    source: `${STWNO}, News „Fashion for free im STWNO“ (6. Aug. 2026): kostenlos für alle, keine Spende nötig, jedes Semester; in Regensburg am 9. Dez. 2026 im Gästesaal der Mensa an der UR`,
  },
  'free-psychological-counselling': {
    title: 'Nutz die kostenlose psychologische Beratung',
    body: 'Das Studierendenwerk bietet kostenlose Einzelberatung auf Deutsch oder Englisch an, persönlich, telefonisch oder per Video.',
    source: `${STWNO}, psychologische Beratung: kostenlose kurz- und mittelfristige Einzelberatung persönlich, telefonisch oder per Video, auf Deutsch und Englisch`,
  },
  'borrow-course-books': {
    title: 'Leih Lehrbücher aus, statt sie zu kaufen',
    body: 'Leih Standardlehrbücher aus der Lehrbuchsammlung der Zentralbibliothek der UR für vier Wochen aus, verlängerbar auf bis zu 12 Wochen.',
    source: 'Bibliothek der Universität Regensburg, Ausleihe von Printmedien: Lehrbuchsammlung für vier Wochen, verlängerbar auf 12 Wochen',
  },
  'scan-for-free': {
    title: 'Scann Bibliotheksbücher kostenlos',
    body: 'Scann Bücher aus dem Lesesaal kostenlos an den Buchscannern der UR-Bibliothek und speicher sie auf deinem eigenen USB-Stick.',
    source: 'Bibliothek der Universität Regensburg, Ausleihe von Printmedien, Lesesäle: Scannen an den Buchscannern ist kostenlos, gespeichert auf dem eigenen USB-Stick',
  },
  'day-trips-on-the-semester-ticket': {
    title: 'Mach Tagesausflüge mit dem Semesterticket',
    body: 'Seit dem Winter 2026/27 gilt das Semesterticket wieder für Züge von Regensburg bis Neustadt an der Donau, ohne Aufpreis.',
    source: `${STWNO}, Semesterticket Regensburg: Ab dem Wintersemester 2026/27 gehört der Bahnabschnitt Sinzing/Riegling bis Neustadt a. d. Donau wieder zum Geltungsbereich`,
  },
  studienstarthilfe: {
    title: 'Hol dir die Studienstarthilfe von 1.000 €',
    body: 'Im ersten Semester, unter 25 und mit Leistungen wie Bürgergeld oder Wohngeld? Beantrag bis zum Ende des Monats nach Studienbeginn einmalig 1.000 €.',
    source: `${STWNO}, BAföG-Studienstarthilfe: einmalig 1.000 €, nicht zurückzuzahlen, für Erststudierende in Vollzeit unter 25, die Sozialleistungen beziehen; Antrag über BAföG Digital bis zum Ende des Monats nach Studienbeginn`,
  },
  'apply-for-a-dorm-room': {
    title: 'Bewirb dich für ein Zimmer beim Studierendenwerk',
    body: 'Die günstigsten Wohnheimzimmer kosten etwa 215 € im Monat; ein WG-Zimmer kostet im Schnitt 459–561 €. Bewerben kannst du dich jederzeit online.',
    source: 'Universität Regensburg, Wohnen in Regensburg: Die günstigsten Zimmer des Studierendenwerks kosten etwa 215 €; ein WG-Zimmer im Schnitt 459–561 € (Moses Mendelssohn Institut, Sept. 2026); keine Bewerbungsfrist',
  },
  'check-wohngeld': {
    title: 'Prüf, ob du Wohngeld bekommen kannst',
    body: 'Grundsätzlich kein BAföG-Anspruch, etwa weil du über der Altersgrenze bist? Dann kann Wohngeld bei der Miete helfen, wenn Regensburg dein Hauptwohnsitz ist.',
    source: `${STWNO}, Wohngeld: nur möglich ohne grundsätzlichen BAföG-Anspruch, und der Studienort muss der Hauptwohnsitz sein`,
  },
  'free-tenancy-advice': {
    title: 'Hol dir kostenlose Mietrechtsberatung',
    body: 'Ärger mit deinem Vermieter? Die Sozialberatung des Studierendenwerks vermittelt dich für eine kostenlose Beratung an den Mieterverein vor Ort.',
    source: `${STWNO}, Mietrechtsberatung: kostenlose Beratung durch den Mieterverein Regensburg, vermittelt über die Sozialberatung`,
  },
  'stay-on-family-insurance': {
    title: 'Bleib in der Familienversicherung',
    body: 'Die kostenlose Familienversicherung über die gesetzliche Krankenversicherung eines Elternteils gilt bis zu deinem 25. Geburtstag, wenn du unter 565 € im Monat verdienst (603 € im Minijob, 2026).',
    source: `${STWNO}, Kranken- und Pflegeversicherung: kostenlose Familienversicherung bis zum 25. Geburtstag; 2026 bis zu 565 € im Monat aus einer regulären Beschäftigung oder 603 € aus einem Minijob`,
  },
  'software-from-campus-it': {
    title: 'Hol dir Office über die Uni',
    body: 'Bevor du für Office 365 oder SPSS zahlst, schau ins Softwareangebot von Campus IT der UR: Campuslizenzen sind für Studierende kostenlos oder günstiger.',
    source: 'Universität Regensburg Campus IT, Software: Campuslizenzen kostenlos oder zu Sonderpreisen; Studierende bekommen Rabatte auf Software wie SPSS und Office 365',
  },
  'ride-on-your-semester-ticket': {
    title: 'Fahr mit dem Semesterticket im RVV',
    body: 'Dein Semesterbeitrag enthält schon 126 € (Wintersemester 2026/27) für unbegrenzte Fahrten mit Bus und Bahn im RVV. Dein Studierendenausweis und ein Lichtbildausweis sind das Ticket.',
    source: 'RVV, Semesterticket: verpflichtend 126 € pro Semester für unbegrenzte Fahrten im gesamten RVV-Gebiet; das Ticket ist der Studierendenausweis plus Personalausweis oder Reisepass',
  },
  'upgrade-to-deutschlandticket': {
    title: 'Erweitere auf das Deutschlandticket für 22 €',
    body: 'Das Upgrade kostet 22 € im Monat zusätzlich zu deinem Semesterticket. Buch es für Monate, in denen du reist; kündige bis zum 10. für den nächsten Monat.',
    source: 'RVV, Semesterticket: Ab 1. Okt. 2026 beträgt der Regensburger Studierendenzuschlag 22,00 € im Monat; ein Monatsabo, kündbar bis zum 10. des Monats',
  },
  'try-university-sport': {
    title: 'Probier Hochschulsport, bevor du ins Fitnessstudio gehst',
    body: 'URsport im Sportzentrum der UR bietet Fitnessstudio, Schwimmbad, Sauna und Kurse zum Studierendentarif für Studierende der UR und der OTH. Vergleich, bevor du dich anmeldest.',
    source: 'Sportzentrum der Universität Regensburg, Plattform URsport: Studierende der UR und der OTH melden sich an und buchen zum Studierendentarif; Fitnessstudio, Schwimmbad und Sauna über die App',
  },
  'split-the-rundfunkbeitrag': {
    title: 'Teilt euch einen Rundfunkbeitrag pro Wohnung',
    body: 'Der Beitrag kostet 18,36 € im Monat pro Wohnung, nicht pro Person. In einer WG meldet sich eine Person an, und ihr teilt ihn; die anderen melden sich ab.',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, Informationen für Studierende: 18,36 € im Monat pro Wohnung; nur eine erwachsene Person pro Wohnung meldet sich an und zahlt',
  },
  'rundfunkbeitrag-bafoeg-exemption': {
    title: 'Beantrag die Befreiung vom Rundfunkbeitrag',
    body: 'Wenn du BAföG bekommst und nicht bei deinen Eltern wohnst, beantrag die Befreiung vom Beitrag von 18,36 € im Monat. Sie gilt nicht automatisch.',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, Informationen für Studierende: Wer BAföG bekommt und nicht bei den Eltern wohnt, kann sich auf Antrag befreien lassen',
  },
};
