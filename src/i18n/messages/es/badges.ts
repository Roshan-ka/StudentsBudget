import type { Messages } from '../en';
import { byCount } from './count';

// Las insignias en español: nombres y progreso (badges.ts), la página de insignias y la tarjeta de Inicio. La
// revisión semanal (check-in.ts) y la introducción de aquí nombran algunas: si cambia un nombre, cambian todos.

const weeks = (count: number) => byCount(count, { one: `${count} semana`, other: `${count} semanas` });

export const badges: Messages['badges'] = {
  names: {
    'under-budget-week': 'Semana bajo presupuesto',
    'logging-streak': 'Racha de registros',
    'ramen-royalty': 'Realeza del ramen',
    'latte-survivor': 'Superviviente del latte',
  },
  progress: {
    underBudgetCount: (count) => `${weeks(count)} bajo presupuesto`,
    underBudgetOf: (count, goal) => `${count} de ${goal} semanas`,
    streakStart: 'Una racha empieza con una semana en la que registras por tu cuenta los gastos de los sobres',
    streakNew: 'Una nueva racha empieza con una semana en la que registras por tu cuenta los gastos de los sobres',
    streakPaused: (count) => `Tu racha está en pausa en ${weeks(count)}`,
    streakOf: (count, goal) => `${count} de ${goal} semanas seguidas`,
    streakRun: (count) => byCount(count, { one: `${count} semana seguida`, other: `${count} semanas seguidas` }),
    ramenFirst: 'Tu primera semana completa de compras de comida marca la referencia',
    ramenBest: (amount, weekOf, earned) =>
      `La semana de comida más barata hasta ahora: ${amount} (semana del ${weekOf})` +
      `${earned ? '' : '. Una semana más barata la consigue'}`,
    latteFirstLogging: 'Tu primer mes completo de registros marca la referencia',
    latteFirstEatingOut: 'Tu primer mes completo con comidas fuera marca la referencia',
    latteTarget: (amount, month) =>
      `Un mes con ${amount} o menos en comer fuera la consigue (la mitad de lo que gastaste en ${month})`,
    latteHit: (month, amount, markAmount, markMonth) =>
      `${month}: ${amount} en comer fuera, frente a ${markAmount} en ${markMonth}`,
  },
  tiers: { bronze: 'Bronce', silver: 'Plata', gold: 'Oro' },
  notEarned: 'Aún no conseguida',
  earned: (date) => `Conseguida el ${date}`,
  tierEarned: (tier, date) => `${tier} · conseguida el ${date}`,
  rules: {
    underBudget: (gold, wholeSemester) =>
      'Cuenta una semana en la que registras por tu cuenta los gastos de los sobres y no gastas más que su parte de ' +
      'tus sobres: lo que quedaba de ellos al empezar la semana, repartido entre las semanas que quedan del mes. ' +
      `Bronce a las 4 semanas, plata a las 12, oro a las ${gold}${wholeSemester ? ': un semestre entero' : ''}.`,
    streak: 'Semanas seguidas en las que registras por tu cuenta los gastos de los sobres. Se consigue a las 4 semanas.',
    ramen: 'La consigue una semana completa que cuesta menos en comida que todas las anteriores.',
    latte:
      'La consigue un mes con como mucho la mitad de comidas fuera que tu primer mes completo que tuvo alguna. Solo ' +
      'cuentan los meses en los que registras por tu cuenta los gastos de los sobres.',
  },
  howItWorks: 'Cómo funcionan las insignias',
  intro:
    'Cada semana se guarda a partir del miércoles siguiente a su final, la próxima vez que abres la app, así que los ' +
    'gastos que registres para ella el lunes o el martes aún cuentan. Tus insignias salen de esas semanas y de tus ' +
    'registros. Una semana que marcas como fuera en la revisión deja tu racha como está y no cuenta para Semana bajo ' +
    'presupuesto ni Realeza del ramen.',
  listLabel: 'Tus insignias',
  noPlan: 'Configura tu plan para empezar a conseguir insignias.',
  startSetup: 'Empezar la configuración',
  card: {
    heading: 'Insignias',
    earnedOf: (earned, total) => `${earned} de ${total} conseguidas`,
    next: (name) => `Siguiente: ${name}`,
    seeAll: 'Ver todas las insignias',
  },
};
