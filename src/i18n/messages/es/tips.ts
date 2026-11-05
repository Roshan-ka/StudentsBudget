import type { Messages } from '../en';
import { byCount } from './count';

// La pestaña Consejos en español: consejos, descuentos y las palabras de la línea de ahorro. Los consejos, descuentos
// e ideas de ahorro en sí son contenido de la ciudad; sus palabras en español van en src/i18n/city/es (chunk 8).
export const tips: Messages['tips'] = {
  tabsLabel: 'Consejos, descuentos o trucos',
  tips: 'Consejos',
  discounts: 'Descuentos',
  all: 'Todos',
  more: 'Más',
  tipsIntro: 'Formas locales de pagar menos como estudiante. Cada consejo dice de dónde sale.',
  tipsFor: 'Mostrar consejos de',
  discountsIntro:
    'Descuentos para estudiantes en Regensburg. Cada uno dice dónde se indica. Dile a la app si uno sigue ' +
    'funcionando: tus respuestas se guardan en este móvil. Los que confirmas suben; los que marcas como que ya no ' +
    'funcionan, o que llevan 8 semanas sin confirmar, bajan.',
  discountsFor: 'Mostrar descuentos de',
  loadFailed: 'No se han podido cargar los descuentos. Inténtalo más tarde.',
  votes: { works: 'Sigue funcionando', outdated: 'Ya no funciona' },
  voteGroup: (place) => `${place}: ¿sigue funcionando?`,
  markedOutdated: (date) => `Lo marcaste como que ya no funciona el ${date}`,
  mayBeOutdated: 'Puede estar desactualizado',
  lastConfirmed: (date) => `Confirmado por última vez el ${date}`,
  /** Lo que otros estudiantes han confirmado este semestre (P2.6), visible con la sesión iniciada. */
  confirmations: (count) =>
    byCount(count, { one: '1 confirmación este semestre', other: `${count} confirmaciones este semestre` }),
  notWorking: (count) =>
    byCount(count, { one: '1 persona dice que ya no funciona', other: `${count} personas dicen que ya no funciona` }),
  othersSignIn: 'Inicia sesión para ver lo que han confirmado otros estudiantes.',
  saved: 'Guardado en este móvil.',
  saveFailed: 'No se ha podido guardar tu respuesta. Inténtalo de nuevo.',
  heard: {
    works: (place) => `${place}: guardado como que sigue funcionando.`,
    outdated: (place) => `${place}: guardado como que ya no funciona.`,
    moves: (saved, direction) => `${saved} ${direction === 'up' ? 'Sube' : 'Baja'} en la lista.`,
    failed: (place) => `${place}: no se ha podido guardar tu respuesta. Inténtalo de nuevo.`,
  },
  /** El feed de trucos: trucos para ahorrar publicados por estudiantes. */
  hacks: {
    tab: 'Trucos',
    intro:
      'Trucos para ahorrar publicados por estudiantes, con sus propias palabras. La app no los comprueba: los ' +
      'votos muestran qué funcionó.',
    signedOut: 'Inicia sesión para leer y publicar trucos de estudiantes.',
    toAccount: 'Ir a «Tu cuenta»',
    off:
      'Las publicaciones de estudiantes necesitan una cuenta, y las cuentas no están configuradas en esta ' +
      'versión de la app.',
    loading: 'Cargando publicaciones…',
    loadFailed: 'No se pudieron cargar las publicaciones. Revisa tu conexión e inténtalo de nuevo.',
    tryAgain: 'Intentar de nuevo',
    lastLoaded: (when) => `Tal como se cargó la última vez, ${when}.`,
    empty: 'Aún no hay publicaciones.',
    postsFor: 'Mostrar publicaciones de',
    posts: 'Publicaciones',
    cities: { regensburg: 'Regensburg', anywhere: 'En cualquier sitio' },
    noName: 'Alguien',
    yours: 'Tu publicación',
    form: {
      open: 'Publicar un truco',
      heading: 'Publicar un truco',
      body: 'Tu truco',
      bodyHint: 'Di qué, dónde y cuánto, si lo sabes. De 10 a 500 caracteres.',
      category: 'Categoría',
      city: 'Dónde',
      link: 'Enlace (opcional)',
      linkHint: 'Una página que lo muestre, que empiece por https://',
      post: 'Publicar',
      cancel: 'Cancelar',
      posted: 'Publicado.',
      nameFirst: 'Elige primero el nombre con el que aparecen tus publicaciones.',
      errors: {
        short: 'Escribe al menos 10 caracteres.',
        long: 'Quédate en 500 caracteres como mucho.',
        link: 'Pon un enlace que empiece por https://, o deja el campo vacío.',
        dailyLimit: 'Has publicado 5 trucos en un día. Vuelve a publicar mañana.',
        invalid: 'La publicación no se pudo guardar así. Revisa el texto y el enlace.',
        offline: 'No tienes conexión. Para publicar hace falta conexión.',
        failed: 'No se pudo guardar la publicación. Inténtalo de nuevo.',
      },
    },
    delete: 'Borrar',
    deleteQuestion: '¿Borrar esta publicación? Ya nadie la verá.',
    keep: 'Mantenerla',
    deleted: 'Publicación borrada.',
    deleteFailed: 'No se pudo borrar la publicación. Inténtalo de nuevo.',
    vote: {
      group: 'Tu voto sobre esta publicación',
      up: 'Me gusta',
      worked: 'Me funcionó',
      outdated: 'Desactualizado',
    },
    report: 'Denunciar',
    reportQuestion: '¿Denunciar esta publicación? Desaparece para ti al momento, y para todos cuando suficientes ' +
      'estudiantes la denuncian.',
    reportCancel: 'Cancelar',
    reported: 'Denunciada. Ya no verás esta publicación.',
    gone: 'Esta publicación ya no está.',
    voteFailed: 'No se pudo guardar tu voto. Inténtalo de nuevo.',
    reportFailed: 'No se pudo enviar la denuncia. Inténtalo de nuevo.',
    counts: (ups, worked, outdated) => `Votos: ${ups} · Funcionó: ${worked} · Desactualizado: ${outdated}`,
  },
  swap: {
    line: (title, saving, per) => `Prueba esto: ${title} · ahorra unos ${saving} por ${per}`,
    estimate: (line) => `${line} (estimación)`,
    details: (title) => `Detalles: ${title}`,
    sources: 'De dónde salen estas cifras',
    sourceOf: (amount) => `De dónde salen ${amount}`,
    relatedTip: 'Consejo relacionado',
  },
};
