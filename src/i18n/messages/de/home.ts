import type { Messages } from '../en';

// Home auf Deutsch: die Begrüßung, was diesen Monat bleibt, die Umschläge, der Budgetvorschlag und die Konten.

const available = (amount: string) =>
  `Nach Fixkosten und Rücklagen stehen dir im Monat ${amount} zur Verfügung.`;

export const home: Messages['home'] = {
  greeting: (name) => `Hallo ${name}`,
  acrossAccounts: (total) => `Auf allen Konten: ${total}`,
  missingRates: (currencies, count) =>
    count === 1 ? `Wechselkurs für ${currencies} fehlt` : `Wechselkurse für ${currencies} fehlen`,
  leftThisMonth: {
    heading: 'Diesen Monat noch frei',
    overThisMonth: { before: '', after: ' zu viel diesen Monat' },
    weekOver: (amount) => `Diese Woche: ${amount} zu viel`,
    weekSafe: (amount) => `Diese Woche: ${amount} frei`,
  },
  envelopes: {
    heading: 'Umschläge',
    barLabel: (category) => `${category} diesen Monat`,
    left: (left, planned) => `Noch ${left} von ${planned} diesen Monat`,
    over: (over, planned) => `${over} über den geplanten ${planned} diesen Monat`,
  },
  suggestedBudget: {
    show: 'Budgetvorschlag ansehen',
    updated: 'Umschläge aktualisiert.',
    heading: 'Budgetvorschlag',
    perMonth: (category) => `${category} pro Monat`,
    studentsHere: 'Studierende hier',
    lastMonth: (month) => `Deine Ausgaben im ${month}`,
    nothingToGoOn: 'Noch keine Anhaltspunkte',
    nothingAvailable:
      'Noch ist nichts zu verteilen: Nach Fixkosten und Rücklagen bleibt von deinen Einnahmen nichts übrig. ' +
      'Deinen Plan kannst du unter Einstellungen → Plan ändern.',
    available,
    availableWithinBudget: (amount, budget) =>
      `${available(amount)} Diese Beträge halten dein Alltagsbudget von ${budget} ein.`,
    availableBelowBudget: (amount, budget) =>
      `${available(amount)} Das ist weniger als dein Alltagsbudget von ${budget}, daher bleiben diese Beträge bei ${amount}.`,
    leftForSavings: (amount) => `${amount} bleiben zum Sparen`,
    overAvailable: (amount) => `${amount} mehr als verfügbar`,
    use: 'Dieses Budget übernehmen',
    notNow: 'Nicht jetzt',
    moreCategories: 'Weitere Kategorien',
    replaces: 'Damit werden die Beträge in deinen Umschlägen ersetzt.',
    fixAmounts: 'Korrigiere die markierten Beträge, um dieses Budget zu übernehmen.',
    enterOne: 'Gib mindestens einen Betrag ein, um dieses Budget zu übernehmen.',
    failed: 'Das wurde nicht gespeichert. Versuch es noch einmal.',
  },
};
