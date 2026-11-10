import type { Messages } from '../en';
import { byCount } from './count';

// La sincronización y la vinculación en español: los códigos de problema guardados (src/sync/problem.ts), la línea
// de estado bajo "Sincronizar ahora", lo que oye un lector de pantalla después y la vinculación de este móvil.
export const sync: Messages['sync'] = {
  problems: {
    updateNeeded: 'Esta app necesita una actualización para sincronizar.',
    signedOut: 'Tu sesión ha caducado. Cierra sesión y vuelve a iniciarla; tus cambios esperan en este móvil.',
    failed: 'No se ha podido sincronizar ahora. Tus cambios esperan en este móvil; inténtalo de nuevo.',
    heldBack: (count) =>
      byCount(count, {
        one: '1 cambio no se puede sincronizar: esta app lo rechaza. Se queda en este móvil.',
        other: `${count} cambios no se pueden sincronizar: esta app los rechaza. Se quedan en este móvil.`,
      }),
  },
  status: {
    offline: 'Sin conexión. Los cambios que hagas ahora esperan en este móvil.',
    offlineWaiting: (count) =>
      byCount(count, {
        one: 'Sin conexión: 1 cambio espera en este móvil.',
        other: `Sin conexión: ${count} cambios esperan en este móvil.`,
      }),
    notYet: 'Aún sin sincronizar',
    synced: (when) => `Sincronizado ${when}`,
    line: (state, waiting) =>
      waiting === 0
        ? `${state}.`
        : `${state}. ${byCount(waiting, { one: '1 cambio pendiente', other: `${waiting} cambios pendientes` })}.`,
    justNow: 'ahora mismo',
    // "min" es un símbolo, sin punto, así que la línea no acaba en "min..".
    minutesAgo: (minutes) => `hace ${minutes} min`,
    at: (dateTime) => `el ${dateTime}`,
    before: 'hace un tiempo',
    otherAccount: 'Este móvil está vinculado a otra cuenta.',
  },
  result: {
    finished: 'Sincronización terminada.',
    offline: 'Sin sincronizar: no tienes conexión. Los cambios esperan en este móvil.',
    otherAccount: 'Sin sincronizar: este móvil está vinculado a otra cuenta.',
    problem: (problem) => `Sin sincronizar: ${problem}`,
  },
  stale: {
    entries: (count) => byCount(count, { one: `${count} registro`, other: `${count} registros` }),
    others: (count) => byCount(count, { one: `${count} elemento más`, other: `${count} elementos más` }),
  },
  section: {
    heading: 'Sincronización',
    syncNow: 'Sincronizar ahora',
    automatic: 'Este móvil se sincroniza solo mientras la app está abierta. «Sincronizar ahora» lo hace al momento.',
  },
  link: {
    heading: 'Vincular este móvil',
    checking: 'Vinculando este móvil a tu cuenta…',
    linking: 'Vinculando este móvil…',
    uploaded: 'Tu cuenta tiene ahora los datos de este móvil.',
    loaded: (contents) => `Cargado de tu cuenta: ${contents}.`,
    question: (phone, account) =>
      `Este móvil y tu cuenta tienen datos. Este móvil: ${phone}. Tu cuenta: ${account}. ` +
      '¿Cuáles deben conservar ambos?',
    staleWarning: (stale) =>
      `Si conservas los datos de este móvil, se borra de tu cuenta lo que solo tiene ella (${stale}), y de tus ` +
      'otros móviles cuando sincronicen.',
    replaceWarning:
      'Usar los datos de tu cuenta sustituye todo lo que hay en este móvil. ¿Quieres una copia antes? Exporta una ' +
      'copia de seguridad en Ajustes → Copia de seguridad y datos.',
    keepPhone: 'Conservar los datos de este móvil',
    useAccount: 'Usar los datos de mi cuenta',
    otherAccount:
      'Este móvil tiene los datos de otra cuenta, así que se mantiene separado de esta. Para sincronizarlo, cierra ' +
      'sesión e iníciala con esa cuenta. Para usar esta cuenta aquí, borra todo en este móvil (Ajustes → Copia de ' +
      'seguridad y datos); los cambios aún no sincronizados se pierden.',
    tryAgain: 'Intentar de nuevo',
    problems: {
      unfinished:
        'El último guardado de tu cuenta no terminó y este móvil no tiene datos para ponerlos en su lugar, así que ' +
        'aún no está vinculado.',
      unreadable:
        'Tu cuenta tiene datos que esta app no puede leer, así que este móvil no está vinculado. Una actualización ' +
        'de la app puede ayudar.',
      failed: 'No se ha podido vincular este móvil a tu cuenta. Comprueba tu conexión e inténtalo de nuevo.',
      offline: 'No tienes conexión. Para vincular este móvil hace falta conexión.',
    },
  },
};
