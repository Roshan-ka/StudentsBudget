import type { Messages } from '../en';
import { NNBSP } from './count';

// Le choix de la langue en français (plan 2, chunk 10).
export const language: Messages['language'] = {
  heading: 'Langue',
  label: 'Langue',
  hint: `Seulement sur ce téléphone. Les montants suivent la langue${NNBSP}; les dates, la région (Allemagne).`,
  draft: (name) => `${name} (brouillon)`,
};
