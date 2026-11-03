import type { Messages } from '../en';

// Le choix de la langue en français (plan 2, chunk 10).
export const language: Messages['language'] = {
  heading: 'Langue',
  label: 'Langue',
  hint: 'Seulement sur ce téléphone. Les montants et les dates suivent la langue.',
  draft: (name) => `${name} (brouillon)`,
};
