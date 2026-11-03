import type { Messages } from '../en';

// Der Tipps-Tab auf Deutsch: Tipps, Rabatte und die Worte der Spar-Zeile. Die Tipps, Rabatte und Spartipps selbst
// sind Stadtinhalte; ihre deutschen Worte, auch das "per" der Spar-Zeile, stehen in src/i18n/city/de (Plan 2).
export const tips: Messages['tips'] = {
  tabsLabel: 'Tipps oder Rabatte',
  tips: 'Tipps',
  discounts: 'Rabatte',
  all: 'Alle',
  more: 'Mehr',
  tipsIntro: 'Wie Studierende vor Ort weniger zahlen. Jeder Tipp sagt, woher er stammt.',
  tipsFor: 'Tipps zeigen für',
  discountsIntro:
    'Rabatte für Studierende in Regensburg. Bei jedem steht, wo er genannt wird. Sag der App, ob einer noch gilt: ' +
    'Deine Antworten werden auf diesem Handy gespeichert. Bestätigte rücken nach oben; solche, die du als ungültig ' +
    'markierst oder die 8 Wochen lang nicht bestätigt wurden, rücken nach unten.',
  discountsFor: 'Rabatte zeigen für',
  loadFailed: 'Die Rabatte ließen sich nicht laden. Versuch es später noch einmal.',
  votes: { works: 'Gilt noch', outdated: 'Gilt nicht mehr' },
  voteGroup: (place) => `${place}: Gilt das noch?`,
  markedOutdated: (date) => `Du hast das am ${date} als ungültig markiert`,
  mayBeOutdated: 'Vielleicht veraltet',
  lastConfirmed: (date) => `Zuletzt bestätigt am ${date}`,
  saved: 'Auf diesem Handy gespeichert.',
  saveFailed: 'Deine Antwort ließ sich nicht speichern. Versuch es noch einmal.',
  heard: {
    works: (place) => `${place}: als gültig gespeichert.`,
    outdated: (place) => `${place}: als ungültig gespeichert.`,
    moves: (saved, direction) => `${saved} Er rückt in der Liste ${direction === 'up' ? 'nach oben' : 'nach unten'}.`,
    failed: (place) => `${place}: Deine Antwort ließ sich nicht speichern. Versuch es noch einmal.`,
  },
  swap: {
    line: (title, saving, per) => `Probier das: ${title} · spar etwa ${saving} pro ${per}`,
    estimate: (line) => `${line} (Schätzung)`,
    details: (title) => `Details zu ${title}`,
    sources: 'Woher diese Zahlen kommen',
    sourceOf: (amount) => `Woher ${amount} kommt`,
    relatedTip: 'Passender Tipp',
  },
};
