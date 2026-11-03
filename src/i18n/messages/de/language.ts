import type { Messages } from '../en';

// Die Sprachauswahl auf Deutsch. Entwurf (Plan 1, Chunk 10).
export const language: Messages['language'] = {
  heading: 'Sprache',
  label: 'Sprache',
  hint: 'Nur auf diesem Handy. Geldbeträge und Daten folgen der Sprache.',
  draft: (name: string) => `${name} (Entwurf)`,
};
