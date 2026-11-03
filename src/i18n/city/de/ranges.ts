import type { RangeWords } from '..';

// Die Quellen der Spannen in der Einrichtung und auf der Startseite auf Deutsch, nach Kategorie (CITIES.regensburg
// .ranges in src/data/cities.ts). 'Estimate' bleibt 'Estimate': Die App zeigt dafür ihr eigenes Wort ("Schätzung").

export const ranges: Record<string, RangeWords> = {
  rent: { source: 'Universität Regensburg: günstigstes Zimmer des Studierendenwerks etwa 215 €, WG-Zimmer 459–561 €' },
  food: {
    source:
      'DSW, 22. Sozialerhebung 2021, bundesweiter Mittelwert 194 € (nicht Regensburg), mit den Lebensmittelpreisen von Destatis auf Sept. 2026 hochgerechnet; die Spanne von ±30 % ist unsere Annahme',
  },
  'eating-out': { source: 'Estimate' },
  'going-out': { source: 'Estimate' },
  transport: { source: 'Estimate' },
  shopping: {
    source:
      'DSW, 22. Sozialerhebung 2021, bundesweiter Mittelwert für Kleidung 40 € (nicht Regensburg), mit dem Verbraucherpreisindex von Destatis auf Sept. 2026 hochgerechnet; die Spanne von ±30 % ist unsere Annahme',
  },
  other: {
    source:
      'DSW, 22. Sozialerhebung 2021, bundesweiter Mittelwert für sonstige Ausgaben 109 € (nicht Regensburg), mit dem Verbraucherpreisindex von Destatis auf Sept. 2026 hochgerechnet; die Spanne von ±30 % ist unsere Annahme',
  },
};
