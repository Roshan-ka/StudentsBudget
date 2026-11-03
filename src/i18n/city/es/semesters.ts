// Los textos de los semestres en español (src/data/semesters.ts): fuentes de las fechas, nombres y fuentes de las
// partes de la cuota y la fuente de la rematriculación. No tienen id y en parte salen de plantillas, así que cada
// texto inglés está aquí literalmente como clave: si cambia, city.test.ts marca la traducción como desfasada.

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';

const basicEn = (semester: string) =>
  `${STWNO}, basic contribution statute (scanned PDF, in German), § 2: €87.00 for summer semester 2027 and €92.00 per semester from winter semester 2027/28; § 3: for students of Universität Regensburg and OTH Regensburg, due with re-registration. This is the ${semester} figure.`;
const basicEs = (semester: string) =>
  `${STWNO}, estatuto de la contribución básica (PDF escaneado, en alemán), § 2: 87,00 € para el semestre de verano 2027 y 92,00 € por semestre desde el semestre de invierno 2027/28; § 3: para estudiantes de la Universität Regensburg y la OTH Regensburg, se paga con la rematriculación. Esta es la cifra del ${semester}.`;
const ticketEn = (semester: string) =>
  `${STWNO}, semester ticket statute of 12 Oct 2026 (scanned PDF, in German), § 3: €128.00 for summer semester 2027 and €130.00 for winter semester 2027/28; § 1: for students of OTH Regensburg and Universität Regensburg (with the statute's exemptions), due with re-registration. This is the ${semester} figure.`;
const ticketEs = (semester: string) =>
  `${STWNO}, estatuto del abono semestral del 12 de octubre de 2026 (PDF escaneado, en alemán), § 3: 128,00 € para el semestre de verano 2027 y 130,00 € para el semestre de invierno 2027/28; § 1: para estudiantes de la OTH Regensburg y la Universität Regensburg (con las exenciones del estatuto), se paga con la rematriculación. Esta es la cifra del ${semester}.`;

export const semesters: Record<string, string> = {
  'Universität Regensburg, academic calendar: "The winter semester begins on 1 October and ends on 31 March."':
    'Universität Regensburg, calendario académico: «El semestre de invierno empieza el 1 de octubre y termina el 31 de marzo.»',
  'Universität Regensburg, academic calendar: "The summer semester lasts from 1 April to 30 September."':
    'Universität Regensburg, calendario académico: «El semestre de verano va del 1 de abril al 30 de septiembre.»',
  'OTH Regensburg, Studienstart (in German): winter semester 1 October to 14 March':
    'OTH Regensburg, Studienstart (en alemán): semestre de invierno del 1 de octubre al 14 de marzo',
  'OTH Regensburg, Studienstart (in German): summer semester 15 March to 30 September':
    'OTH Regensburg, Studienstart (en alemán): semestre de verano del 15 de marzo al 30 de septiembre',
  'Studierendenwerk basic contribution': 'Contribución básica del Studierendenwerk',
  'RVV semester ticket': 'Abono semestral del RVV',
  [basicEn('summer 2027')]: basicEs('semestre de verano 2027'),
  [basicEn('winter 2027/28')]: basicEs('semestre de invierno 2027/28'),
  [ticketEn('summer 2027')]: ticketEs('semestre de verano 2027'),
  [ticketEn('winter 2027/28')]: ticketEs('semestre de invierno 2027/28'),
  'OTH Regensburg, dates and opening hours (in German): "Rückmeldung für das SoSe 2027: vorauss. ab 07.01.2027", re-registration for summer 2027 expected to open on 7 Jan 2027':
    'OTH Regensburg, fechas y horarios (en alemán): «Rückmeldung für das SoSe 2027: vorauss. ab 07.01.2027», se espera que la rematriculación para el verano de 2027 abra el 7 de enero de 2027',
};
