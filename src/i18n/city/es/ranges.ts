import type { RangeWords } from '..';

// Las fuentes de las horquillas de la configuración y de Inicio en español, por categoría (CITIES.regensburg.ranges en
// src/data/cities.ts). 'Estimate' se queda como 'Estimate': la app muestra para ello su propia palabra ("Estimación").

export const ranges: Record<string, RangeWords> = {
  rent: {
    source:
      'Universität Regensburg: habitación más barata del Studierendenwerk unos 215 €, habitación en piso compartido 459–561 €',
  },
  food: {
    source:
      'DSW, 22.ª Sozialerhebung 2021, media nacional 194 € (no de Regensburg), ajustada a sept. 2026 con los precios de alimentos de Destatis; el margen de ±30 % es una suposición nuestra',
  },
  'eating-out': { source: 'Estimate' },
  'going-out': { source: 'Estimate' },
  transport: { source: 'Estimate' },
  shopping: {
    source:
      'DSW, 22.ª Sozialerhebung 2021, media nacional en ropa 40 € (no de Regensburg), ajustada a sept. 2026 con el IPC general de Destatis; el margen de ±30 % es una suposición nuestra',
  },
  other: {
    source:
      'DSW, 22.ª Sozialerhebung 2021, media nacional en otros gastos 109 € (no de Regensburg), ajustada a sept. 2026 con el IPC general de Destatis; el margen de ±30 % es una suposición nuestra',
  },
};
