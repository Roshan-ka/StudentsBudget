import type { Messages } from '../en';

// Sync und Verknüpfen auf Deutsch: die gespeicherten Problem-Codes (src/sync/problem.ts), die Statuszeile unter
// "Jetzt synchronisieren", was ein Screenreader danach hört, und das Verknüpfen dieses Handys auf der Kontoseite.
export const sync: Messages['sync'] = {
  problems: {
    updateNeeded: 'Diese App braucht ein Update, um zu synchronisieren.',
    signedOut: 'Deine Anmeldung ist abgelaufen. Melde dich ab und wieder an; deine Änderungen warten auf diesem Handy.',
    failed: 'Gerade ließ sich nicht synchronisieren. Deine Änderungen warten auf diesem Handy; versuch es noch einmal.',
    heldBack: (count) =>
      count === 1
        ? '1 Änderung lässt sich nicht synchronisieren: Diese App lehnt sie ab. Sie bleibt auf diesem Handy.'
        : `${count} Änderungen lassen sich nicht synchronisieren: Diese App lehnt sie ab. Sie bleiben auf diesem Handy.`,
  },
  status: {
    offline: 'Offline. Was du jetzt änderst, wartet auf diesem Handy.',
    offlineWaiting: (count) =>
      `Offline: ${count} ${count === 1 ? 'Änderung wartet' : 'Änderungen warten'} auf diesem Handy.`,
    notYet: 'Noch nicht synchronisiert',
    synced: (when) => `Synchronisiert ${when}`,
    line: (state, waiting) =>
      waiting === 0
        ? `${state}.`
        : `${state}. ${waiting} ${waiting === 1 ? 'Änderung wartet' : 'Änderungen warten'}.`,
    justNow: 'gerade eben',
    // Ausgeschrieben, weil die Zeile mit einem Punkt endet ("vor 2 Min.." wäre doppelt).
    minutesAgo: (minutes) => `vor ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`,
    at: (dateTime) => `am ${dateTime}`,
    before: 'vor einiger Zeit',
    otherAccount: 'Dieses Handy ist mit einem anderen Konto verknüpft.',
  },
  result: {
    finished: 'Synchronisierung abgeschlossen.',
    offline: 'Nicht synchronisiert: Du bist offline. Änderungen warten auf diesem Handy.',
    otherAccount: 'Nicht synchronisiert: Dieses Handy ist mit einem anderen Konto verknüpft.',
    problem: (problem) => `Nicht synchronisiert: ${problem}`,
  },
  stale: {
    entries: (count) => `${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`,
    others: (count) => `${count} ${count === 1 ? 'weiterer Posten' : 'weitere Posten'}`,
  },
  section: {
    heading: 'Synchronisierung',
    syncNow: 'Jetzt synchronisieren',
    automatic: 'Dieses Handy synchronisiert von selbst, solange die App offen ist. „Jetzt synchronisieren“ tut es sofort.',
  },
  link: {
    heading: 'Dieses Handy verknüpfen',
    checking: 'Dieses Handy wird mit deinem Konto verknüpft …',
    linking: 'Dieses Handy wird verknüpft …',
    uploaded: 'Dein Konto enthält jetzt die Daten dieses Handys.',
    loaded: (contents) => `Aus deinem Konto geladen: ${contents}.`,
    question: (phone, account) =>
      `Dieses Handy und dein Konto enthalten beide Daten. Dieses Handy: ${phone}. Dein Konto: ${account}. ` +
      'Welche Daten sollen beide behalten?',
    staleWarning: (stale) =>
      `Behältst du die Daten dieses Handys, löscht das, was nur dein Konto hat (${stale}), aus deinem Konto und von ` +
      'deinen anderen Handys, sobald sie das nächste Mal synchronisieren.',
    replaceWarning:
      'Die Daten deines Kontos ersetzen alles auf diesem Handy. Vorher eine Kopie? Exportier ein Backup unter ' +
      'Einstellungen → Backup und Daten.',
    keepPhone: 'Daten dieses Handys behalten',
    useAccount: 'Daten meines Kontos nutzen',
    otherAccount:
      'Dieses Handy enthält die Daten eines anderen Kontos und bleibt deshalb von diesem getrennt. Um es zu ' +
      'synchronisieren, melde dich ab und mit jenem Konto an. Um stattdessen dieses Konto hier zu nutzen, lösch alles ' +
      'auf diesem Handy (Einstellungen → Backup und Daten); noch nicht synchronisierte Änderungen gehen verloren.',
    tryAgain: 'Noch einmal versuchen',
    problems: {
      unfinished:
        'Das letzte Speichern deines Kontos wurde nicht fertig, und dieses Handy hat keine Daten, die an seine Stelle ' +
        'treten könnten. Deshalb ist es noch nicht verknüpft.',
      unreadable:
        'Dein Konto enthält Daten, die diese App nicht lesen kann, deshalb ist dieses Handy nicht verknüpft. Ein ' +
        'App-Update könnte helfen.',
      failed: 'Dieses Handy ließ sich nicht mit deinem Konto verknüpfen. Prüf deine Verbindung und versuch es noch einmal.',
      offline: 'Du bist offline. Zum Verknüpfen dieses Handys braucht es eine Verbindung.',
    },
  },
};
