import type { Messages } from '../en';
import { byCount } from './count';

// Textos que comparten varias áreas: el campo de fecha, el de importe, la fuente de una horquilla y los recuentos.
export const common: Messages['common'] = {
  dateField: {
    label: 'Fecha',
    pickDay: 'Elige un día',
    today: 'Hoy',
    yesterday: 'Ayer',
    letters: { day: 'D', month: 'M', year: 'A' },
    hint: (example) => `Escríbela, por ejemplo ${example}, o abre el calendario.`,
    notADate: (example) => `Eso no es una fecha. Escríbela así: ${example}.`,
    openCalendar: (field) => `Abrir el calendario: ${field}`,
    calendarTitle: 'Elige una fecha',
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    earlierYears: 'Años anteriores',
    laterYears: 'Años siguientes',
    chooseMonth: 'Elige un mes',
    chooseYear: 'Elige un año',
    goToToday: 'Ir a hoy',
    close: 'Cerrar',
  },
  amountField: {
    positive: 'Escribe un importe mayor que 0, como 250 o 12,50.',
    number: 'Escribe un número, como 250 o 12,50.',
    overdrawn: 'En descubierto (bajo cero)',
  },
  source: {
    label: 'Fuente',
    of: (what) => `Fuente: ${what}`,
    checked: (date) => `comprobado el ${date}`,
  },
  accountOption: (name, currency) => `${name} (${currency})`,
  counts: {
    accounts: (count) => byCount(count, { one: `${count} cuenta`, other: `${count} cuentas` }),
    entries: (count) => byCount(count, { one: `${count} registro`, other: `${count} registros` }),
    plan: 'tu plan',
  },
  estimate: 'Estimación',
  /** Notas únicas sobre los datos (`PrivacyNote`), una vez por móvil, antes de que una función envíe datos. */
  legal: {
    back: 'Volver',
    onlyDeEn: 'Esta página solo está en alemán e inglés, así que se muestra en inglés.',
    label: 'Información legal',
    privacy: 'Privacidad',
    impressum: 'Aviso legal',
    privacySummary: 'Qué guarda y envía la app, y tus derechos',
    impressumSummary: 'Quién gestiona StudentsBudget',
  },
  privacy: {
    label: 'Sobre tus datos',
    more: 'Más en la política de privacidad',
    continue: 'Continuar',
    cancel: 'Cancelar',
    account:
      'Tu cuenta la guarda Supabase, en Fráncfort (UE): tu correo electrónico, tu contraseña (guardada solo como ' +
      'hash), el idioma de tu móvil, tu nombre de usuario, si estudias o ya terminaste y tu promoción, y una copia ' +
      'de los datos que sincronizas. Otros estudiantes solo ven tu nombre de usuario, si estudias o ya terminaste y ' +
      'tu promoción, junto a tus publicaciones. Si la cuenta necesita un código, para confirmarla o para una nueva ' +
      'contraseña, llega por correo. Puedes eliminar la cuenta cuando quieras en Ajustes → Tu cuenta.',
    passkey:
      'El gestor de contraseñas de tu móvil guarda la llave de acceso y puede sincronizarla con tus otros ' +
      'dispositivos (el llavero de iCloud o el Gestor de contraseñas de Google, por ejemplo). Tu cuenta guarda ' +
      'solo su clave pública, con la que nadie puede iniciar sesión.',
    rates:
      'Mientras una cuenta use una moneda distinta del euro, la app pide a Frankfurter (frankfurter.dev) el tipo ' +
      'de cambio del Banco Central Europeo, como mucho una vez al día. Solo envía los códigos de moneda; como ' +
      'cualquier web, Frankfurter ve la dirección de internet de tu móvil.',
    votes:
      'Con la sesión iniciada, tus votos van a tu cuenta al sincronizar y cuentan en los totales que otros ' +
      'estudiantes ven para este semestre. Nadie ve quién votó.',
    post:
      'Cualquier estudiante con cuenta puede leer lo que publicas aquí, un truco, un comentario o un descuento, con ' +
      'tu nombre de usuario, si estudias o ya terminaste y tu promoción, y denunciarlo; los trucos y los descuentos ' +
      'también se pueden votar. Puedes borrarlo cuando quieras.',
    hackVotes:
      'Tus votos cuentan en los totales que todos los estudiantes ven en la publicación; nadie ve quién votó. Una ' +
      'denuncia oculta la publicación para ti al momento, y para todos cuando suficientes estudiantes la han ' +
      'denunciado, hasta que la moderación de la app decida.',
    translate:
      'Traducir abre el Traductor de Google en una pestaña nueva, con el texto de la publicación en su dirección. ' +
      'Google recibe el texto y la dirección de internet de tu móvil.',
    reminder:
      'Tu cuenta (Supabase, en Fráncfort) guarda la dirección push de este móvil, el día y la hora que elijas, tu ' +
      'zona horaria y tu idioma, y actualiza la zona y el idioma cuando cambian en el móvil. El recordatorio pasa ' +
      'por el servicio push del fabricante de tu navegador (Apple, Google, Mozilla o Microsoft), que ve que llega ' +
      'un mensaje, pero no lo que dice.',
    ai:
      'Las funciones de IA envían lo que escribes, con lo que cada una necesita de tu presupuesto (como los nombres ' +
      'de tus categorías y cuentas, o las cifras de tu plan), a Groq, un servicio de IA, en EE. UU., para responderlo. ' +
      'Los números de cuenta y de tarjeta, las direcciones de correo y los números de teléfono se quitan antes. Tu ' +
      'cuenta registra cuántas veces usas cada función al día. Puedes desactivarlas en Ajustes → Tu cuenta.',
  },
};
