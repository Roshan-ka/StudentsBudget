import type { Messages } from '../en';

// El mes a mes en español: la línea de Inicio, la página y las líneas de reveal-text.ts.
export const reveal: Messages['reveal'] = {
  link: (month) => `Mira cómo fue ${month}`,
  intro: 'Cómo fue cada mes terminado frente a tus sobres.',
  notYet: (month) => `Tu primer resumen llega cuando termine ${month}.`,
  recap: {
    savings: (amount) => `Sobraron ${amount} → ahorro`,
    over: (amount) => `${amount} por encima del plan`,
    onPlan: 'Justo según el plan',
  },
  spentOf: (spent, planned) => `${spent} gastados de ${planned}`,
  noPlan: 'Configura tu plan para ver cómo va cada mes.',
};
