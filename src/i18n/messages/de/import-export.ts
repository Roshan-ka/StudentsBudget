import type { Messages } from '../en';

// Optionen → Import und Export auf Deutsch (CSV-Import und -Export, docs/superpowers/plans/2026-11-09-csv-import-export.md):
// ein Kontoauszug hinein, die Einträge als Tabellendatei hinaus.
export const importExport: Messages['importExport'] = {
  summary: 'Kontoauszug importieren oder Einträge exportieren',
  import: {
    heading: 'Kontoauszug importieren',
    hint:
      'Lade einen Kontoauszug als CSV von der Website oder App deiner Bank herunter und wähle ihn hier. Auszüge von ' +
      'Sparkasse, DKB, N26 und Revolut werden erkannt. Die Datei wird nur auf diesem Handy gelesen und nicht gespeichert.',
    file: 'Auszugsdatei (CSV)',
    noPlan: 'Richte zuerst deinen Plan ein: Der Import rechnet jede Zeile darauf an.',
    toSetup: 'Zur Einrichtung',
    reading: 'Datei wird gelesen …',
    recognised: (bank, rows, from, to) => `${bank}: ${rows} ${rows === 1 ? 'Zeile' : 'Zeilen'}, ${from} bis ${to}`,
    account: 'Importieren in',
    submit: 'Importieren',
    choose: 'Andere Datei wählen',
    problems: {
      tooBig: 'Die Datei ist zu groß für einen Kontoauszug: höchstens 2 MB und 5.000 Zeilen.',
      empty: 'In dieser Datei sind keine Zeilen, die die App lesen kann.',
      creditCard: (bank) =>
        `Das ist ein Kreditkarten-Export der ${bank}, den die App noch nicht lesen kann. Exportiere stattdessen den Auszug deines Girokontos.`,
      failed: 'Die Datei konnte nicht gelesen werden.',
      noRate: (currency) =>
        `Für ${currency} gibt es noch keinen Wechselkurs. Gib einen unter Optionen → Konten und Umbuchungen ein und importiere dann erneut.`,
      noAccount: 'Dieses Konto gibt es nicht mehr. Wähle ein anderes.',
      saveFailed: 'Der Import konnte nicht gespeichert werden.',
    },
  },
  match: {
    heading: 'Welche Spalte enthält was?',
    intro:
      'Die App erkennt die Spalten dieser Datei nicht. Sag, welche Spalte was enthält: Sie merkt sich deine Wahl für ' +
      'die nächste Datei mit denselben Spalten.',
    remembered: 'Zugeordnet wie bei deiner letzten Datei mit diesen Spalten.',
    date: 'Datum',
    dateOrder: 'Das Datum steht',
    orders: { dmy: 'Tag zuerst (31.10.2026)', ymd: 'Jahr zuerst (2026-10-31)', mdy: 'Monat zuerst (10/31/2026)' },
    amountKind: 'Der Betrag steht',
    amountKinds: { one: 'In einer Spalte, mit Minus für Ausgaben', two: 'In zwei Spalten: Soll und Haben' },
    amount: 'Betrag',
    out: 'Soll (Ausgaben)',
    in: 'Haben (Einnahmen)',
    payee: 'Wer bezahlt wurde oder dich bezahlt hat',
    purpose: 'Verwendungszweck (optional)',
    currency: 'Währung (optional)',
    none: 'Keine',
    preview: 'Die ersten Zeilen, wie die App sie liest',
    unreadable: 'Mit diesen Spalten nicht lesbar',
    use: 'Diese Spalten verwenden',
    twice: 'Wähle für jedes davon eine andere Spalte.',
    file: (rows, from, to) => `Deine Datei: ${rows} ${rows === 1 ? 'Zeile' : 'Zeilen'}, ${from} bis ${to}`,
  },
  result: {
    heading: 'Import abgeschlossen',
    added: (entries, transfers) => {
      const counted = `${entries} ${entries === 1 ? 'Eintrag' : 'Einträge'} hinzugefügt`;
      return transfers === 0 ? `${counted}.` : `${counted}, davon ${transfers} ${transfers === 1 ? 'Umbuchung' : 'Umbuchungen'}.`;
    },
    nothing: 'Nichts Neues: Jede Zeile war schon in der App oder wurde ausgelassen.',
    opening: (account, amount) =>
      `Der Anfangsstand von ${account} hat sich um ${amount} verschoben: Einige Zeilen lagen vor dem Tag, an dem du das Konto angelegt hast, also bleibt sein Stand heute gleich.`,
    skipped: (count) => `Ausgelassen (${count})`,
    reasons: {
      unreadable: 'Nicht lesbar',
      pending: 'Bei der Bank noch vorgemerkt',
      internal: 'Eine Bewegung innerhalb der Bank',
      zero: 'Ein Betrag von null',
      currency: 'Nicht in der Währung des Kontos',
      future: 'Nach heute datiert',
      beforePlan: 'Von vor dem Start deines Plans',
      otherCurrencyTransfer: 'Eine Umbuchung auf ein Konto in anderer Währung',
      noTransferAccount: 'Kein Konto in der App für die Umbuchung',
      duplicate: 'Schon in der App',
    },
    undo: 'Diesen Import rückgängig machen',
    undone: (count) => `Import rückgängig gemacht: ${count} ${count === 1 ? 'Eintrag' : 'Einträge'} entfernt.`,
    another: 'Weitere Datei importieren',
  },
  export: {
    heading: 'Als Tabelle exportieren',
    hint: 'Speichert alle Einträge als CSV-Datei für Excel, Numbers oder Google Tabellen. Um deine Daten auf ein anderes Handy zu bringen, nimm das Backup.',
    empty: 'Noch keine Einträge zum Exportieren.',
    button: 'Einträge exportieren',
    shareTitle: 'StudentsBudget-Einträge',
    shared: 'Einträge geteilt.',
    downloaded: (fileName) => `Download gestartet: ${fileName}`,
    shareFailed: 'Das Teilen-Menü hat sich nicht geöffnet. Du kannst die Datei stattdessen herunterladen.',
    downloadInstead: 'Stattdessen herunterladen',
    failed: 'Deine Einträge konnten nicht exportiert werden.',
  },
  columns: { currency: 'Währung', eur: 'Betrag in EUR' },
  transferTo: (account) => `An ${account}`,
};
