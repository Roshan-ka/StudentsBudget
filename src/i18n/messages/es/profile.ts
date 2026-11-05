import type { Messages } from '../en';
import { byCount } from './count';

// El perfil en español: Ajustes → Perfil, las comprobaciones de profile.ts y la nota sobre la cuota semestral.
// "Cuota semestral" es el nombre del gasto puntual que se ofrece.
export const profile: Messages['profile'] = {
  heading: 'Perfil',
  summaryNone: 'Aún sin rellenar',
  intro:
    'Tu perfil se guarda en este móvil y va en cualquier copia de seguridad que exportes, y en tu cuenta cuando ' +
    'guardas en ella.',
  name: 'Tu nombre',
  nameHint: 'Opcional. Inicio te saluda con este nombre.',
  university: 'Universidad',
  notSet: 'Sin indicar',
  otherUniversity: 'Otra',
  semesterStart: 'Inicio del semestre',
  semesterEnd: 'Fin del semestre',
  weeks: (weeks) => byCount(weeks, { one: `Tu semestre: ${weeks} semana.`, other: `Tu semestre: ${weeks} semanas.` }),
  period: (term, university, period) => `${term} en ${university}: ${period}. Cambia las fechas si las tuyas son otras.`,
  winter: 'Semestre de invierno',
  summer: 'Semestre de verano',
  save: 'Guardar perfil',
  clearDates: 'Borrar las fechas del semestre',
  saved: 'Perfil guardado.',
  saveFailed: 'No se ha podido guardar tu perfil. Inténtalo de nuevo.',
  problems: {
    both: 'Indica las dos fechas del semestre o deja ambas vacías.',
    full: 'Escribe cada fecha del semestre completa.',
    year: 'Escribe el año de cada fecha del semestre con cuatro cifras, como 2026.',
    endAfterStart: 'Elige una fecha de fin posterior a la de inicio.',
    tooLong: 'Un semestre dura como mucho un año. Elige una fecha de fin anterior.',
  },
  semesterFee: 'Cuota semestral',
  fee: {
    noFee: 'Ninguna página indica aún la cuota de este semestre, así que el importe lo pones tú.',
    dueReRegistration: (month) => `Se paga en ${month}, cuando se espera que abra la rematriculación.`,
    dueBeforeSemester: (month) => `Se paga en ${month}, el mes antes de que empiece el semestre.`,
    reRegistration: 'rematriculación',
  },
};
