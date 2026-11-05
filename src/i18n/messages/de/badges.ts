import type { Messages } from '../en';

// Abzeichen auf Deutsch: Namen und Fortschritt (badges.ts), die Abzeichen-Seite und die Karte auf der Startseite.
// Die Namen nennen auch der Check-in (check-in.ts) und die Einleitung hier: Ändert sich einer, ändern sich alle.

const weeks = (count: number) => `${count} ${count === 1 ? 'Woche' : 'Wochen'}`;

export const badges: Messages['badges'] = {
  names: {
    'under-budget-week': 'Unter-Budget-Woche',
    'logging-streak': 'Eintragsserie',
    'ramen-royalty': 'Ramen-Majestät',
    'latte-survivor': 'Latte-Survivor',
  },
  progress: {
    underBudgetCount: (count) => `${weeks(count)} unter Budget`,
    underBudgetOf: (count, goal) => `${count} von ${goal} Wochen`,
    streakStart: 'Eine Serie beginnt mit einer Woche, in der du deine Umschlag-Ausgaben selbst erfasst',
    streakNew: 'Eine neue Serie beginnt mit einer Woche, in der du deine Umschlag-Ausgaben selbst erfasst',
    streakPaused: (count) => `Deine Serie ruht bei ${weeks(count)}`,
    streakOf: (count, goal) => `${count} von ${goal} Wochen am Stück`,
    streakRun: (count) => `${weeks(count)} am Stück`,
    ramenFirst: 'Deine erste volle Woche mit Lebensmitteln setzt die Marke',
    ramenBest: (amount, weekOf, earned) =>
      `Günstigste Lebensmittelwoche bisher: ${amount} (Woche vom ${weekOf})` +
      `${earned ? '' : '. Eine günstigere Woche bringt es dir'}`,
    latteFirstLogging: 'Dein erster voller Monat mit Einträgen setzt die Marke',
    latteFirstEatingOut: 'Dein erster voller Monat mit Essen auswärts setzt die Marke',
    latteTarget: (amount, month) =>
      `Ein Monat mit höchstens ${amount} für Essen auswärts bringt es dir (die Hälfte dessen, was du im ${month} ` +
      'ausgegeben hast)',
    latteHit: (month, amount, markAmount, markMonth) =>
      `${month}: ${amount} für Essen auswärts statt ${markAmount} im ${markMonth}`,
  },
  tiers: { bronze: 'Bronze', silver: 'Silber', gold: 'Gold' },
  notEarned: 'Noch nicht erhalten',
  earned: (date) => `Erhalten am ${date}`,
  tierEarned: (tier, date) => `${tier} · erhalten am ${date}`,
  rules: {
    underBudget: (gold, wholeSemester) =>
      'Zählt eine Woche, in der du Umschlag-Ausgaben selbst erfasst und nicht mehr ausgibst als ihren Anteil an deinen ' +
      'Umschlägen: was zu Wochenbeginn von ihnen übrig war, verteilt auf die restlichen Wochen des Monats. ' +
      `Bronze bei 4 Wochen, Silber bei 12, Gold bei ${gold}${wholeSemester ? ': ein ganzes Semester' : ''}.`,
    streak: 'Wochen am Stück, in denen du Umschlag-Ausgaben selbst erfasst. Du erhältst es bei 4 Wochen.',
    ramen: 'Du erhältst es für eine volle Woche, die bei Lebensmitteln weniger kostet als jede Woche davor.',
    latte:
      'Du erhältst es für einen Monat mit höchstens halb so viel Essen auswärts wie in deinem ersten vollen Monat, in ' +
      'dem es welches gab. Es zählen nur Monate, in denen du Umschlag-Ausgaben selbst erfasst.',
  },
  howItWorks: 'So funktionieren Abzeichen',
  intro:
    'Jede Woche wird ab dem Mittwoch nach ihrem Ende gespeichert, wenn du die App das nächste Mal öffnest, sodass ' +
    'Ausgaben, die du am Montag oder Dienstag dafür erfasst, noch zählen. Deine Abzeichen kommen aus diesen Wochen und ' +
    'deinen Einträgen. Eine Woche, die du im Check-in als weg markierst, lässt deine Serie, wie sie ist, und zählt ' +
    'nicht für Unter-Budget-Woche oder Ramen-Majestät.',
  listLabel: 'Deine Abzeichen',
  noPlan: 'Richte deinen Plan ein, um Abzeichen zu sammeln.',
  startSetup: 'Einrichtung starten',
  card: {
    heading: 'Abzeichen',
    earnedOf: (earned, total) => `${earned} von ${total} erhalten`,
    next: (name) => `Als Nächstes: ${name}`,
    seeAll: 'Alle Abzeichen ansehen',
  },
};
