import type { Messages } from '../en';

// Einrichtung und Plan bearbeiten auf Deutsch: der Assistent, seine Schritte, die Prüfungen und Zeilen aus draft.ts,
// der Hinweis zum Installieren. "Automatisch hinzufügen" muss so heißen wie der Schalter in recurring (Chunk 12).
export const setup: Messages['setup'] = {
  headingNew: 'Richte deinen Plan ein',
  headingEdit: 'Passe deinen Plan an',
  stepOf: (step, total) => `Schritt ${step} von ${total}`,
  titles: {
    'city-rent': 'Stadt und Miete',
    accounts: 'Konten',
    income: 'Einnahmen',
    fixed: 'Fixkosten',
    'one-offs': 'Einmalige Kosten',
    guesses: 'Schätzungen',
    envelopes: 'Umschläge',
  },
  accountsInSettings: 'Deine Konten sind schon in den Einstellungen angelegt.',
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
    checkGuess: (name) => `Prüfe die Schätzung für ${name}.`,
    checkBudget: 'Prüfe den Betrag deines Alltagsbudgets.',
    addEnvelope: (name) => `Gib einen Betrag für ${name} ein`,
  },
  cityRent: {
    city: 'Stadt',
    onlyCity: 'Regensburg ist vorerst die einzige Stadt.',
    rent: 'Miete pro Monat',
    rooms: (range) => `Zimmer hier: ${range}`,
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
    later: 'Bekommst du BAföG oder ein Stipendium? Trag es später unter Plan bearbeiten in den Einstellungen ein.',
  },
  fixed: {
    intro:
      'Was zahlst du jeden Monat, in Euro? Deine Miete ist schon aus Schritt 1 drin. Lass weg, was du nicht zahlst.',
    later: 'Abos, Fitnessstudio, Nebenkosten und Rundfunkbeitrag kannst du später unter Plan bearbeiten in den Einstellungen ergänzen.',
    rent: (amount) => `Miete: ${amount} im Monat`,
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
  guesses: {
    intro:
      'Geh nach Gefühl, in Euro. Gib 0 ein, wenn du dafür nichts ausgibst. Lass weg, was du nicht weißt. ' +
      'Schätzungen werden einmal gespeichert und lassen sich später nicht ändern.',
    question: (topic) => `Wie viel gibst du schätzungsweise im Monat für ${topic} aus?`,
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
    budgetIntro: 'Ein Alltagsbudget ist freiwillig: Damit bekommt jeder Umschlag unten einen Vorschlag.',
    budgetQuestion: 'Wie viel willst du im Monat für den Alltag ausgeben, ohne Miete und Fixkosten?',
    typicalSpend: (range) => `Studierende hier geben dafür meist etwa ${range} im Monat aus.`,
    estimates: (list, count) =>
      `${list.charAt(0).toUpperCase()}${list.slice(1)} ${count === 1 ? 'ist eine Schätzung' : 'sind Schätzungen'}.`,
    whereFrom: 'Woher das kommt',
    askEdit: 'Wie viel willst du dir für jeden dieser Bereiche im Monat erlauben, in Euro? Du kannst das jederzeit ändern.',
    askNew:
      'Wie viel willst du dir für jeden dieser Bereiche im Monat erlauben, in Euro? Ändern und weitere Umschläge ' +
      'wie Studienmaterial oder Reisen hinzufügen kannst du unter Plan bearbeiten in den Einstellungen.',
    useSuggested: 'Vorschläge übernehmen',
    fillsOnly: 'Das füllt nur die Umschläge, die du noch nicht festgelegt hast.',
    studentsHere: 'Studierende hier',
    suggested: (amount) => `Vorschlag: ${amount}`,
    below: 'Weniger, als Studierende hier meist brauchen.',
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
  editPlan: {
    summary: 'Einnahmen, Fixkosten und Umschläge',
    heading: 'Plan',
    body:
      'Ändere deine Umschläge und einmaligen Kosten, ergänze Einnahmen, Fixkosten und Umschläge, die die Einrichtung ' +
      'übersprungen hat, oder geh den ganzen Plan noch einmal durch. Die Schätzungen aus ' +
      'der Einrichtung bleiben, wie sie sind.',
    link: 'Plan bearbeiten',
  },
};
