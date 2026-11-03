// Die Semestertexte auf Deutsch (src/data/semesters.ts): Quellen der Semesterdaten, Namen und Quellen der Teile des
// Semesterbeitrags und die Quelle der Rückmeldung. Sie haben keine id und werden zum Teil aus Vorlagen gebaut, daher
// steht hier jeder englische Text wörtlich als Schlüssel: Ändert er sich, meldet city.test.ts die Übersetzung als
// veraltet. Seiten auf Deutsch brauchen hier kein "(in German)".

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';

const basicEn = (semester: string) =>
  `${STWNO}, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the ${semester} figure.`;
const basicDe = (semester: string) =>
  `${STWNO}, Satzung über den Grundbeitrag (eingescanntes PDF), § 2: 87,00 € für das Sommersemester 2027 und 92,00 € pro Semester ab dem Wintersemester 2027/28; § 3: für Studierende der Universität Regensburg und der OTH Regensburg, fällig mit der Rückmeldung. Das ist der Betrag für das ${semester}.`;
const ticketEn = (semester: string) =>
  `${STWNO}, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the ${semester} figure.`;
const ticketDe = (semester: string) =>
  `${STWNO}, Satzung über das Semesterticket vom 12. Okt. 2026 (eingescanntes PDF), § 3: 128,00 € für das Sommersemester 2027 und 130,00 € für das Wintersemester 2027/28; § 1: für Studierende der OTH Regensburg und der Universität Regensburg (mit den Ausnahmen der Satzung), fällig mit der Rückmeldung. Das ist der Betrag für das ${semester}.`;

export const semesters: Record<string, string> = {
  'Universität Regensburg, academic calendar: "The winter semester begins on 1 October and ends on 31 March."':
    'Universität Regensburg, Akademischer Kalender: „Das Wintersemester beginnt am 1. Oktober und endet am 31. März.“',
  'Universität Regensburg, academic calendar: "The summer semester lasts from 1 April to 30 September."':
    'Universität Regensburg, Akademischer Kalender: „Das Sommersemester dauert vom 1. April bis 30. September.“',
  'OTH Regensburg, Studienstart (in German): winter semester 1 October to 14 March':
    'OTH Regensburg, Studienstart: Wintersemester 1. Oktober bis 14. März',
  'OTH Regensburg, Studienstart (in German): summer semester 15 March to 30 September':
    'OTH Regensburg, Studienstart: Sommersemester 15. März bis 30. September',
  'Studierendenwerk basic contribution': 'Grundbeitrag des Studierendenwerks',
  'RVV semester ticket': 'RVV-Semesterticket',
  [basicEn('summer 2027')]: basicDe('Sommersemester 2027'),
  [basicEn('winter 2027/28')]: basicDe('Wintersemester 2027/28'),
  [ticketEn('summer 2027')]: ticketDe('Sommersemester 2027'),
  [ticketEn('winter 2027/28')]: ticketDe('Wintersemester 2027/28'),
  'OTH Regensburg, dates and opening hours (in German): "Rückmeldung für das SoSe 2027: vorauss. ab 07.01.2027", re-registration for summer 2027 expected to open on 7 Jan 2027':
    'OTH Regensburg, Termine und Öffnungszeiten: „Rückmeldung für das SoSe 2027: vorauss. ab 07.01.2027“, die Rückmeldung für das Sommersemester 2027 öffnet voraussichtlich am 7. Jan. 2027',
};
