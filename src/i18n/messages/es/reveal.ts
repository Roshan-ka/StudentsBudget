import type { Messages } from '../en';

// El mes a mes en español: la línea de Inicio, la página y las líneas de reveal-text.ts.
export const reveal: Messages['reveal'] = {
  link: (month) => `Mira cómo fue ${month}`,
  intro: 'Cómo fue cada mes terminado frente a tus sobres.',
  notYet: (month) => `Tu primer resumen llega cuando termine ${month}.`,
  adjust: 'Cambiar mis sobres',
  recap: {
    savings: (label, amount) => `${label}: sobraron ${amount} → ahorro`,
    over: (label, amount) => `${label}: ${amount} por encima del plan`,
    onPlan: (label) => `${label}: justo según el plan`,
  },
  noPlan: 'Configura tu plan para ver cómo va cada mes.',
  startSetup: 'Empezar la configuración',
};
