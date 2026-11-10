import type { ChecklistWords } from '..';

// Die Checkliste auf Deutsch, nach ihrer id (src/data/checklist.ts). Nur die Worte: Gruppe, Zielgruppe, Tipp, Links und
// Prüfdaten bleiben in den Daten, und jede Zahl der englischen Fassung steht auch hier (getestet in city.test.ts). Ein
// Punkt, der sich auf einen Tipp stützt, nennt dessen Quelle mit denselben Worten wie der Tipp.

const STWNO = 'Studierendenwerk Niederbayern/Oberpfalz';

export const checklist: Record<string, ChecklistWords> = {
  'register-your-address': {
    title: 'Melde deine Adresse an',
    body: 'Melde dich innerhalb von zwei Wochen nach dem Einzug bei der Meldebehörde der Stadt an.',
    source: 'Bundesmeldegesetz § 17 Abs. 1: Wer eine Wohnung bezieht, hat sich innerhalb von zwei Wochen nach dem Einzug bei der Meldebehörde anzumelden',
  },
  'health-insurance-for-enrolment': {
    title: 'Lass deine Krankenversicherung an die Uni melden',
    body: 'Deine gesetzliche Krankenkasse schickt den Nachweis elektronisch, mit der Hochschulnummer H0000341; Papiernachweise gelten nicht. Privat oder im Ausland versichert? Eine gesetzliche Kasse prüft deinen Status und meldet ihn.',
    source:
      'Universität Regensburg, Krankenversicherungsnachweis: in elektronischer Form nötig, von der gesetzlichen Krankenkasse mit der Hochschulnummer H0000341 gemeldet; Papierbescheinigungen reichen seit dem 1. Jan. 2022 nicht mehr; private und ausländische Versicherer können ihn nicht senden, daher prüft eine gesetzliche Kasse den Status und meldet ihn',
  },
  'residence-permit': {
    title: 'Beantrage deine Aufenthaltserlaubnis',
    body: 'Von außerhalb der EU? Beantrage sie bei der Ausländerbehörde der Stadt, bevor dein Einreisevisum abläuft, oder in deinen ersten 90 Tagen, wenn du ohne Visum gekommen bist.',
    source:
      'Universität Regensburg, International Office, Aufenthaltserlaubnis für Nicht-EU-Studierende: vor Ablauf eines eventuellen Visums bei der zuständigen Ausländerbehörde beantragen; ohne Visum innerhalb der ersten 90 Tage des Aufenthalts',
  },
  'open-a-bank-account': {
    title: 'Eröffne ein Bankkonto',
    body: 'Wer sich rechtmäßig in der EU aufhält, hat Anspruch auf ein Basiskonto, auch ohne festen Wohnsitz.',
    source:
      'Zahlungskontengesetz § 31 Abs. 1: Jeder Verbraucher mit rechtmäßigem Aufenthalt in der Europäischen Union, einschließlich Personen ohne festen Wohnsitz, hat Anspruch auf ein Basiskonto',
  },
  'register-for-the-rundfunkbeitrag': {
    title: 'Kümmere dich um den Rundfunkbeitrag',
    body: 'Pro Wohnung meldet sich eine erwachsene Person an und zahlt; in einer WG sprecht ab, wer.',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, Informationen für Studierende: 18,36 € im Monat pro Wohnung; nur eine erwachsene Person pro Wohnung meldet sich an und zahlt',
  },
  'apply-for-bafoeg': {
    title: 'Beantrage BAföG',
    body: 'Stell den Antrag über BAföG Digital, so früh du kannst: Gezahlt wird ab dem Monat, in dem er eingeht, nie vor Studienbeginn.',
    source: `${STWNO}, BAföG: Antrag über BAföG Digital, am besten so früh wie möglich; die Förderung wird ab dem Monat des Antragseingangs bewilligt, frühestens ab Studienbeginn; das Regensburger Amt ist für die Universität Regensburg und die OTH Regensburg zuständig`,
  },
  'claim-the-study-start-grant': {
    title: 'Hol dir die Studienstarthilfe',
    body: 'Du beginnst dein erstes Studium, bist unter 25 und beziehst Sozialleistungen? Einmalig 1.000 €, die du nie zurückzahlst.',
    source: `${STWNO}, BAföG-Studienstarthilfe: einmalig 1.000 €, nicht zurückzuzahlen, für Erststudierende in Vollzeit unter 25, die Sozialleistungen beziehen; Antrag über BAföG Digital bis zum Ende des Monats nach Studienbeginn`,
  },
  'keep-kindergeld': {
    title: 'Sorg dafür, dass das Kindergeld weiterläuft',
    body: 'Deine Eltern können für dein erstes Studium Kindergeld bekommen, bis zum Tag vor deinem 25. Geburtstag.',
    source:
      'Bundesagentur für Arbeit, Familienkasse, Kindergeld ab 18 Jahren: gezahlt zwischen dem 18. und dem vollendeten 25. Lebensjahr für ein Kind in seiner ersten Ausbildung oder seinem ersten Studium; das 25. Lebensjahr endet mit dem Tag vor dem 25. Geburtstag',
  },
  'stay-on-family-insurance': {
    title: 'Bleib in der Familienversicherung',
    body: 'Kostenlos bis zu deinem 25. Geburtstag, solange du wenig verdienst. Prüf es, bevor du einen größeren Job annimmst.',
    source: `${STWNO}, Kranken- und Pflegeversicherung: kostenlose Familienversicherung bis zum 25. Geburtstag; 2026 bis zu 565 € im Monat aus einer regulären Beschäftigung oder 603 € aus einem Minijob`,
  },
  'check-wohngeld': {
    title: 'Prüf das Wohngeld',
    body: 'Grundsätzlich kein BAföG-Anspruch? Wohngeld kann bei der Miete helfen, wenn Regensburg dein Hauptwohnsitz ist.',
    source: `${STWNO}, Wohngeld: nur möglich ohne grundsätzlichen BAföG-Anspruch, und der Studienort muss der Hauptwohnsitz sein`,
  },
  'rundfunkbeitrag-exemption': {
    title: 'Beantrage die Befreiung vom Rundfunkbeitrag',
    body: 'Du bekommst BAföG und wohnst nicht bei deinen Eltern? Dann kannst du dich auf Antrag befreien lassen.',
    source: 'ARD ZDF Deutschlandradio Beitragsservice, Informationen für Studierende: Wer BAföG bekommt und nicht bei den Eltern wohnt, kann sich auf Antrag befreien lassen',
  },
};
