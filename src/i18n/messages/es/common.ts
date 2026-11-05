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
  privacy: {
    label: 'Sobre tus datos',
    continue: 'Continuar',
    cancel: 'Cancelar',
    account:
      'Tu cuenta la guarda Supabase, en Fráncfort (UE): tu correo electrónico, tu contraseña (guardada solo como ' +
      'hash), el idioma de tu móvil, tu nombre de usuario, si estudias o ya terminaste y tu promoción, y una copia ' +
      'de los datos que sincronizas. Otros estudiantes solo ven tu nombre de usuario, si estudias o ya terminaste y ' +
      'tu promoción, junto a tus publicaciones. Si la cuenta necesita un código, para confirmarla o para una nueva ' +
      'contraseña, llega por correo. Puedes eliminar la cuenta cuando quieras en Ajustes.',
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
      'Cualquier estudiante con cuenta puede leer tu publicación, con tu nombre de usuario, si estudias o ya ' +
      'terminaste y tu promoción, y votarla o denunciarla. Puedes borrarla cuando quieras.',
    hackVotes:
      'Tus votos cuentan en los totales que todos los estudiantes ven en la publicación; nadie ve quién votó. Una ' +
      'denuncia oculta la publicación para ti al momento, y para todos cuando suficientes estudiantes la han ' +
      'denunciado, hasta que la moderación de la app decida.',
    translate:
      'Traducir abre el Traductor de Google en una pestaña nueva, con el texto de la publicación en su dirección. ' +
      'Google recibe el texto y la dirección de internet de tu móvil.',
  },
};
