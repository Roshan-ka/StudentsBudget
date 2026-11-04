import type { Messages } from '../en';

// La selección de idioma en español (plan 2, chunk 3).
export const language: Messages['language'] = {
  heading: 'Idioma',
  label: 'Idioma',
  hint: 'Solo en este móvil. Los importes siguen el idioma; las fechas, la región (Alemania).',
  draft: (name) => `${name} (borrador)`,
};
