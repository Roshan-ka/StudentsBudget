import type { Messages } from '../en';

// La pestaña Consejos en español: consejos, descuentos y las palabras de la línea de ahorro. Los consejos, descuentos
// e ideas de ahorro en sí son contenido de la ciudad; sus palabras en español van en src/i18n/city/es (chunk 8).
export const tips: Messages['tips'] = {
  tabsLabel: 'Consejos o descuentos',
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
  saved: 'Guardado en este móvil.',
  saveFailed: 'No se ha podido guardar tu respuesta. Inténtalo de nuevo.',
  heard: {
    works: (place) => `${place}: guardado como que sigue funcionando.`,
    outdated: (place) => `${place}: guardado como que ya no funciona.`,
    moves: (saved, direction) => `${saved} ${direction === 'up' ? 'Sube' : 'Baja'} en la lista.`,
    failed: (place) => `${place}: no se ha podido guardar tu respuesta. Inténtalo de nuevo.`,
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
