import type { Messages } from '../en';

// La selección de idioma en español (plan 2, chunk 3).
export const language: Messages['language'] = {
  heading: 'Idioma',
  label: 'Idioma',
  hint: 'Solo en este móvil. Los importes y las fechas siguen el idioma.',
  draft: (name) => `${name} (borrador)`,
};
