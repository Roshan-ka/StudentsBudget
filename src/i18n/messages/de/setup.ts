import type { Messages } from '../en';

// Einrichtung und Plan bearbeiten auf Deutsch: der Assistent, seine Schritte, die Prüfungen und Zeilen aus draft.ts,
// der Hinweis zum Installieren. "Automatisch hinzufügen" muss so heißen wie der Schalter in recurring (Chunk 12).
export const setup: Messages['setup'] = {
  headingNew: 'Richte deinen Plan ein',
  headingEdit: 'Plan bearbeiten',
  stepOf: (step, total) => `Schritt ${step} von ${total}`,
  titles: {
    accounts: 'Konten',
    income: 'Einnahmen',
    fixed: 'Fixkosten',
    'one-offs': 'Einmalige Kosten',
    envelopes: 'Umschläge',
  },
  accountsInSettings: 'Deine Konten sind schon angelegt, unter Einstellungen → Konten und Umbuchungen.',
  saveFailed: 'Dein Plan konnte nicht gespeichert werden. Versuch es noch einmal.',
  back: 'Zurück',
  next: 'Weiter',
  save: 'Plan speichern',
  problems: {
    checkAmount: (name) => `Prüfe den Betrag für ${name}.`,
    addAccount: 'Lege mindestens ein Konto an',
    nameAccounts: 'Gib jedem Konto einen Namen.',
    checkOpening: (name, number) => `Prüfe den Anfangsstand für ${name ?? `Konto ${number}`}.`,
    foreignAmount: (currency, name) => `Gib den Betrag in ${currency} für ${name} ein.`,
    nameOneOffs: 'Gib allen einmaligen Kosten einen Namen.',
    checkOneOff: (name, number) => `Prüfe den Betrag für ${name ?? `einmalige Kosten ${number}`}.`,
    dueMonth: 'Wähle einen Monat nach diesem.',
    checkBudget: 'Prüfe den Betrag deines Alltagsbudgets.',
    addEnvelope: (name) => `Gib einen Betrag für ${name} ein`,
  },
  accounts: {
    intro: 'Wo liegt dein Geld? Der Anfangsstand ist das, was heute auf jedem Konto ist.',
    account: (number) => `Konto ${number}`,
    name: 'Name',
    type: 'Art',
    bank: 'Bank',
    cash: 'Bargeld',
    currency: 'Währung',
    opening: 'Anfangsstand',
    remove: (number) => `Konto ${number} entfernen`,
    add: 'Konto hinzufügen',
    prefilled: { localBank: 'Bank hier', homeBank: 'Bank zu Hause', cash: 'Bargeld' },
  },
  income: {
    intro:
      'Wie viel kommt jeden Monat herein, in Euro? Lass weg, was du nicht bekommst. Schwankt es, gib einen ' +
      'niedrigen Schätzwert an.',
    savings: {
      before:
        'Lebst du von Ersparnissen? Trag unter Andere Einnahmen ein, was du davon im Monat brauchst, und schalte ',
      automatic: 'Automatisch hinzufügen',
      after: ' aus, damit Geld, das schon auf deinem Konto ist, nicht doppelt zählt.',
    },
    later: 'Bekommst du BAföG oder ein Stipendium? Trag es später unter Einstellungen → Plan → Plan bearbeiten ein.',
  },
  fixed: {
    intro: 'Was zahlst du jeden Monat, in Euro? Lass weg, was du nicht zahlst.',
    rentLabel: 'Miete pro Monat',
    rooms: (range) => `Zimmer hier: ${range}`,
    later:
      'Abos, Fitnessstudio, Nebenkosten, Rundfunkbeitrag und einmalige Kosten wie den Semesterbeitrag kannst du ' +
      'später unter Einstellungen → Plan → Plan bearbeiten ergänzen.',
  },
  oneOffs: {
    intro:
      'Große Kosten, die einmal anfallen, etwa ein Semesterbeitrag oder eine Kaution. Bis zum Fälligkeitsmonat legen ' +
      'wir jeden Monat einen Teil zurück. Überspring das, wenn du keine hast. Kosten ohne Betrag werden nicht ' +
      'gespeichert.',
    oneOff: (number) => `Einmalige Kosten ${number}`,
    name: 'Name',
    amount: 'Betrag',
    leftOut: 'Ohne Betrag werden diese Kosten nicht gespeichert.',
    due: 'Fällig im Monat',
    remove: (number) => `Einmalige Kosten ${number} entfernen`,
    add: 'Einmalige Kosten hinzufügen',
    feeOffer: (amount, month) => `Semesterbeitrag hinzufügen${amount === null ? '' : `: ${amount}`}, fällig im ${month}`,
  },
  topics: {
    food: 'Lebensmittel',
    'eating-out': 'Essen auswärts',
    'going-out': 'Ausgehen',
    transport: 'Mobilität',
    shopping: 'Einkäufe',
    other: 'Sonstiges',
  },
  envelopes: {
    budgetIntroNew: (amount) =>
      `Ein Alltagsbudget ist freiwillig. Ohne eins teilen die Vorschläge auf, was nach Miete und Fixkosten übrig ist: ${amount}.`,
    budgetIntroEdit: (amount) =>
      'Ein Alltagsbudget ist freiwillig. Ohne eins teilen die Vorschläge auf, was nach Miete, Fixkosten und den ' +
      `Rücklagen für einmalige Kosten übrig ist: ${amount}.`,
    budgetQuestion: 'Wie viel willst du im Monat für den Alltag ausgeben, ohne Miete und Fixkosten?',
    typicalSpend: (range) => `Studierende hier geben dafür meist etwa ${range} im Monat aus.`,
    estimates: (list, count) =>
      `${list.charAt(0).toUpperCase()}${list.slice(1)} ${count === 1 ? 'ist eine Schätzung' : 'sind Schätzungen'}.`,
    whereFrom: 'Woher das kommt',
    askEdit: 'Wie viel willst du dir für jeden dieser Bereiche im Monat erlauben, in Euro? Du kannst das jederzeit ändern.',
    askNew:
      'Wie viel willst du dir für jeden dieser Bereiche im Monat erlauben, in Euro? Ändern und weitere Umschläge ' +
      'wie Studienmaterial oder Reisen hinzufügen kannst du unter Einstellungen → Plan → Plan bearbeiten.',
    useSuggested: 'Vorschläge übernehmen',
    fillsOnly: 'Das füllt nur die Umschläge, die du noch nicht festgelegt hast.',
    studentsHere: 'Studierende hier',
    suggested: (amount) => `Vorschlag: ${amount}`,
    below: 'Weniger, als Studierende hier meist brauchen.',
    belowSome: (count) => `${count} davon liegen unter dem, was Studierende hier meist brauchen.`,
  },
  lines: {
    available: (amount) => `Verfügbar ${amount}`,
    planned: (amount) => `Geplant ${amount}`,
    overBy: (amount) => `${amount} zu viel`,
    ofBudget: (planned, budget) => `${planned} von deinem Budget von ${budget}`,
    overBudget: (over, budget) => `${over} über deinem Budget von ${budget}`,
    range: (label, range) => `${label}: ${range}`,
    rangeEstimate: (label, range) => `${label}: ${range} (Schätzung)`,
  },
  installHint:
    'Installiere zuerst: Tippe auf Teilen → Zum Home-Bildschirm und richte die App dort ein. In Safari eingegebene ' +
    'Daten bleiben in Safari.',
  setupRow: { title: 'Plan einrichten', summary: 'Dein Plan ist noch nicht eingerichtet' },
  editPlan: {
    summary: 'Einnahmen, Fixkosten und Umschläge',
    heading: 'Plan',
    body:
      'Ändere deine Umschläge, ergänze einmalige Kosten wie den Semesterbeitrag und die Einnahmen, Fixkosten und ' +
      'Umschläge, die die Einrichtung übersprungen hat, oder geh den ganzen Plan noch einmal durch.',
    link: 'Plan bearbeiten',
  },
};
