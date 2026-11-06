import type { Messages } from '../en';

// Los gráficos en español: el periodo y el mes, los cuatro gráficos, sus leyendas, tooltips, tablas y lo que oye un
// lector de pantalla de cada uno. Un periodo va tras una coma ("Gastos por categoría, octubre de 2026"), porque puede
// ser un mes o "agosto de 2026 a octubre de 2026".

/** Frases unidas con un espacio, sin las que faltan. */
const sentences = (...parts: (string | null)[]) => parts.filter((part) => part !== null).join(' ');

export const charts: Messages['charts'] = {
  noPlan: 'Configura tu plan para ver a dónde va el dinero.',
  startSetup: 'Empezar la configuración',
  periodLabel: 'Periodo',
  period: (months) => (months === 1 ? 'Este mes' : `${months} meses`),
  monthLabel: 'Mes',
  previous: 'Anterior',
  next: 'Siguiente',
  periodRange: (first, last) => `${first} a ${last}`,
  // Tras "en": "Aún no hay gastos registrados en estos 3 meses."
  theseMonths: (months) => `estos ${months} meses`,
  noSpending: (when) => `Aún no hay gastos registrados en ${when}.`,
  noIncome: (when) => `Aún no hay ingresos registrados en ${when}.`,
  nothing: (when) => `Aún no hay nada registrado en ${when}.`,
  lastSixMonths: 'Últimos 6 meses',
  series: {
    spent: 'Gastado',
    planned: 'Previsto',
    income: 'Ingresos',
    saved: 'Ahorrado',
    short: 'Más gastado que ingresado',
  },
  ofPlanned: (amount, planned) => `${amount} de ${planned}`,
  bucket: 'Todo lo demás',
  // Como mucho 16 caracteres (colors.test.ts); la tabla y el tooltip muestran el nombre completo.
  shortNames: { utilities: 'Suministros', 'transport-pass': 'Abono transporte', health: 'Salud' },
  styles: { donut: 'Anillo', bars: 'Barras', table: 'Tabla', columns: 'Columnas', line: 'Línea' },
  spending: {
    title: 'Gastos por categoría',
    styleLabel: 'Vista de los gastos',
    category: 'Categoría',
    notPlanned: 'Sin prever',
    // El periodo puede ser un rango, así que va tras dos puntos.
    nothingSpent: (period) => `Todavía no hay gastos: ${period}.`,
    centre: 'gastado',
    caption: (period) =>
      sentences(`Gastos por categoría, ${period}.`, 'Cada categoría lleva a sus registros.'),
    donutSummary: (period, slices) =>
      sentences(`Gráfico de anillo de lo gastado, ${period}: ${slices}.`, 'Debajo están las mismas cifras.'),
    barsSummary: (period, withPlanned) =>
      sentences(
        `Gráfico de barras de lo gastado en cada categoría, ${period}${withPlanned ? ', frente a lo previsto' : ''}.`,
        'Las mismas cifras están en la tabla.',
      ),
  },
  income: {
    title: 'Ingresos por fuente',
    styleLabel: 'Vista de los ingresos',
    source: 'Fuente',
    centre: 'ingresos',
    caption: (period) => `Ingresos por fuente, ${period}. Cada fuente lleva a sus registros.`,
    donutSummary: (period, slices) =>
      `Gráfico de anillo de los ingresos por fuente, ${period}: ${slices}. Debajo están las mismas cifras.`,
    barsSummary: (period) =>
      `Gráfico de barras de los ingresos por fuente, ${period}. Las mismas cifras están en la tabla.`,
  },
  savings: {
    title: 'Ahorrado cada mes',
    styleLabel: 'Vista del ahorro',
    month: 'Mes',
    saved: (amount) => `${amount} ahorrados`,
    short: (amount) => `${amount} más gastados que ingresados`,
    explain: (period) => `Ingresos menos gastos, ${period}. El dinero que mueves entre tus cuentas no cuenta.`,
    caption: (period) => `Ingresos menos gastos por mes, ${period}. Cada mes lleva a sus registros.`,
    summary: (line, period, headline) =>
      `${line ? 'Gráfico de líneas' : 'Gráfico de columnas'} de los ingresos menos los gastos de cada mes, ` +
      `${period}, ${headline}. Las mismas cifras están en la tabla.`,
  },
  overTime: {
    title: (category) => `${category} a lo largo del tiempo`,
    category: 'Categoría',
    styleLabel: 'Vista de la categoría',
    caption: (category, period) => `${category} por mes, ${period}. Cada mes lleva a sus registros.`,
    summary: (line, category, period) =>
      `${line ? 'Gráfico de líneas' : 'Gráfico de columnas'} de lo gastado en ${category} cada mes, ${period}. ` +
      'Las mismas cifras están en la tabla.',
  },
};
