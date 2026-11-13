import type { Messages } from '../en';
import { byCount } from './count';

// El inicio de sesión y la seguridad en español: auth-errors.ts y credentials.ts, el formulario, el paso del código,
// la vista con la sesión iniciada (account-view.tsx), Inicio de sesión y seguridad, la verificación en dos pasos y
// las llaves de acceso.
export const auth: Messages['auth'] = {
  errors: {
    invalidCredentials: 'El correo o la contraseña no son correctos.',
    accountExists: 'Este correo ya tiene una cuenta. Inicia sesión.',
    weakPassword: 'Esta contraseña es demasiado fácil de adivinar. Elige una más larga.',
    checkEmail: 'Revisa la dirección de correo: necesita una @ y un dominio, como nombre@ejemplo.com.',
    signupDisabled: 'Ahora mismo no se pueden crear cuentas nuevas.',
    emailDisabled: 'Ahora mismo no se puede iniciar sesión con correo.',
    notConfirmed: 'Esta cuenta aún tiene que confirmarse con el código de su correo.',
    tooMany: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
    codeWrongOrExpired: 'Ese código es incorrecto o ha caducado. Mira el correo más reciente o pide un código nuevo.',
    waitForCode: 'Demasiados correos por ahora. Espera un minuto y pide un código nuevo.',
    emailNotSent: 'No se ha podido enviar el correo. Inténtalo más tarde.',
    samePassword: 'Esa es tu contraseña actual. Elige otra.',
    codeFailed: 'Ese código no ha funcionado. Los códigos cambian cada 30 segundos: escribe el más reciente.',
    codeExpired: 'Ha tardado un poco. Escribe el código más reciente de tu app de autenticación.',
    factorGone:
      'La verificación en dos pasos se ha desactivado para esta cuenta. Cierra sesión y vuelve a iniciarla.',
    setupOpen: 'Hay una configuración anterior aún abierta. Inténtalo de nuevo.',
    enrollOff: 'Ahora mismo no se puede activar la verificación en dos pasos.',
    verifyOff: 'Ahora mismo no se pueden comprobar los códigos. Inténtalo más tarde.',
    connectionChanged:
      'Tu conexión cambió mientras se comprobaba el código. Vuelve a escribir el código más reciente.',
    signInAgain: 'Cierra sesión, vuelve a iniciarla con tu código e inténtalo otra vez.',
    tooManyPasskeys: 'Tu cuenta tiene tantas llaves de acceso como puede guardar. Quita una primero.',
    passkeyOnAccount: 'Esta llave de acceso ya está en tu cuenta.',
    passkeyExpired: 'Ha tardado un poco. Inténtalo de nuevo.',
    passkeyOnDevice: 'Este dispositivo ya tiene una llave de acceso para tu cuenta.',
    unreachable: 'No se puede contactar con el servidor de cuentas. Comprueba tu conexión e inténtalo de nuevo.',
    sessionEnded: 'Esta sesión ha terminado. Cierra sesión y vuelve a iniciarla.',
    general: 'Algo ha salido mal. Inténtalo de nuevo.',
  },
  unavailable: {
    disabled: 'Las llaves de acceso están desactivadas ahora mismo.',
    wrongSite: 'Las llaves de acceso no funcionan en esta copia de la app.',
  },
  passkeyUnavailable: (reason) => `${reason} Inicia sesión con tu correo y tu contraseña.`,
  passkeyFailed:
    'Esa llave de acceso no ha funcionado. Inténtalo de nuevo o inicia sesión con tu correo y tu contraseña.',
  offline: 'No tienes conexión. Para iniciar sesión hace falta conexión.',
  check: {
    enterEmail: 'Escribe tu correo.',
    enterPassword: 'Escribe tu contraseña.',
    shortPassword: (min) => `Usa al menos ${min} caracteres para la contraseña.`,
    code: 'Escribe el código de 6 cifras de tu app de autenticación.',
    emailCode: 'Escribe el código de 6 cifras del correo.',
  },
  view: {
    off: 'Las cuentas no están configuradas en esta copia de la app. Todo se queda en este móvil.',
    checking: 'Comprobando tu cuenta…',
  },
  signIn: {
    headingSignIn: 'Iniciar sesión',
    headingCreate: 'Crear una cuenta',
    optional: 'Opcional. Sin cuenta, todo se queda en este móvil.',
    iosHint:
      'En el iPhone, inicia sesión dentro de la app de la pantalla de inicio: Safari y la app guardan datos y ' +
      'sesiones por separado.',
    email: 'Correo',
    password: 'Contraseña',
    minLength: (min) => `Al menos ${min} caracteres.`,
    signIn: 'Iniciar sesión',
    create: 'Crear cuenta',
    toSignIn: '¿Tienes una cuenta? Inicia sesión',
    toCreate: '¿Primera vez aquí? Crea una cuenta',
    forgot: '¿Has olvidado tu contraseña?',
    /** Al crear: el nombre del primer grupo; el segundo es postingName.heading. */
    details: 'Datos de acceso',
    /** La línea entre el formulario y la llave de acceso. */
    or: 'o',
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
  },
  /** El código del correo tras crear una cuenta (P2.4). La dirección va en negrita en medio de la frase. */
  confirm: {
    heading: 'Confirma tu correo',
    prompt: { before: 'Escribe el código de 6 cifras que hemos enviado a ', after: '. Sirve durante 60 minutos.' },
    code: 'Código de 6 cifras',
    confirm: 'Confirmar',
    sendAgain: 'Enviar un código nuevo',
    resent: 'Un código nuevo va de camino. Usa el más reciente.',
    back: 'Volver',
  },
  /** «¿Has olvidado tu contraseña?» (P2.4): el correo y luego su código. La dirección va en negrita en la frase. */
  reset: {
    heading: 'Restablecer tu contraseña',
    intro: 'Escribe el correo de tu cuenta y le enviaremos un código de 6 cifras.',
    send: 'Enviar código',
    prompt: { before: 'Si ', after: ' tiene una cuenta, le hemos enviado un código de 6 cifras. Sirve durante 60 minutos.' },
    code: 'Código de 6 cifras',
    confirm: 'Continuar',
    sendAgain: 'Enviar un código nuevo',
    resent: 'Un código nuevo va de camino. Usa el más reciente.',
    back: 'Volver',
  },
  /** El último paso: con la sesión iniciada por el código, una contraseña nueva lo termina. */
  newPassword: {
    heading: 'Elige una contraseña nueva',
    prompt: { before: 'Sesión iniciada como ', after: ' con el código de tu correo. Elige una contraseña nueva para terminar.' },
    password: 'Contraseña nueva',
    save: 'Guardar contraseña',
    signOut: 'Cerrar sesión',
  },
  secondStep: {
    heading: 'Verificación en dos pasos',
    prompt: { before: 'Escribe el código de tu app de autenticación para ', after: '.' },
    ended: { before: 'Esta sesión de ', after: ' ha terminado, quizá porque se completó en otro dispositivo.' },
    signInAgain: 'Volver a iniciar sesión',
    code: 'Código de 6 cifras',
    continue: 'Continuar',
    otherAccount: 'Usar otra cuenta',
  },
  signedIn: {
    heading: 'Sesión iniciada',
    as: { before: 'Sesión iniciada como ', after: '.' },
    keeps:
      'Al cerrar sesión, primero se sincroniza y luego se borran tus datos de este móvil. Al volver a iniciar sesión, tu cuenta te los devuelve.',
    signOut: 'Cerrar sesión',
    syncing: 'Sincronizando y cerrando sesión…',
    confirm: '¿Cerrar sesión en este móvil?',
    cancel: 'Cancelar',
    unsynced: (count) =>
      byCount(count, {
        one: `${count} cambio todavía no está en tu cuenta.`,
        other: `${count} cambios todavía no están en tu cuenta.`,
      }),
    unsyncedOffline:
      'No tienes conexión. Mantén la sesión iniciada y sincroniza más tarde, o cierra sesión y pierde estos cambios.',
    unsyncedFailed:
      'No se pudieron enviar. Mantén la sesión iniciada y sincroniza más tarde, o cierra sesión y pierde estos cambios.',
    stay: 'Mantener la sesión',
    signOutAnyway: 'Cerrar sesión y perderlos',
    wipeFailed:
      'Has cerrado sesión, pero no se pudieron borrar los datos de este móvil. Bórralos en Copia de seguridad y datos.',
    passwordChanged: 'Contraseña cambiada.',
  },
  /** Ajustes → Tu cuenta → Eliminar mi cuenta (P2.5). La palabra que se escribe es la de la copia de seguridad. */
  deleteAccount: {
    heading: 'Eliminar mi cuenta',
    intro:
      'Elimina tu cuenta y todo lo que guarda, para siempre: no se puede deshacer. Los datos de este móvil se ' +
      'quedan, igual que los de tus otros móviles, que dejan de estar vinculados.',
    backup: 'Exportar antes una copia de seguridad',
    password: 'Contraseña',
    code: 'Código de 6 cifras',
    codeNeeded: 'Tu cuenta tiene verificación en dos pasos: escribe también el código de tu app de autenticación.',
    button: 'Eliminar mi cuenta',
    deleting: 'Eliminando tu cuenta…',
    failed: 'No se ha podido eliminar tu cuenta. Inténtalo de nuevo.',
    done: 'Tu cuenta está eliminada. Todo lo de este móvil se queda.',
  },
  security: {
    heading: 'Inicio de sesión y seguridad',
    intro:
      'Siempre puedes iniciar sesión con tu contraseña. Una llave de acceso es una forma más rápida. Con la ' +
      'verificación en dos pasos activada, después de cualquiera de las dos se pide un código de tu app de ' +
      'autenticación, así que una contraseña robada no abre nada por sí sola.',
  },
  twoStep: {
    heading: 'Verificación en dos pasos',
    badges: { on: 'Activada', off: 'Desactivada', settingUp: 'Configurando' },
    offline: 'No tienes conexión. Para activar o desactivar la verificación en dos pasos hace falta conexión.',
    checking: 'Comprobando la verificación en dos pasos…',
    unknown: 'No se ha podido comprobar si la verificación en dos pasos está activada.',
    tryAgain: 'Intentar de nuevo',
    offIntro:
      'Actívala y, al iniciar sesión, también se pedirá un código de 6 cifras de una app de autenticación, como ' +
      'Google Authenticator, Microsoft Authenticator o 2FAS, así que tu contraseña sola ya no abre tu cuenta.',
    turnOn: 'Activar',
    setupIntro: 'Añade StudentsBudget a tu app de autenticación y escribe el código que muestra.',
    restarted:
      'Así la configuración empieza de nuevo. Si tu app de autenticación ya tiene una entrada de StudentsBudget de ' +
      'la configuración sin terminar, bórrala: sus códigos no funcionan.',
    openApp: 'Abrir en la app de autenticación',
    typeKey: 'O escribe esta clave en la app:',
    scan: 'O escanea este código desde otro dispositivo:',
    qrAlt: 'Código QR para la app de autenticación',
    keepKey:
      'Apunta la clave y guárdala en un lugar seguro, lejos de este móvil. Si pierdes tu app de autenticación, al ' +
      'escribir la clave en una nueva obtienes los mismos códigos. Los datos de este móvil se quedan igual.',
    code: 'Código de 6 cifras',
    cancel: 'Cancelar',
    onIntro: 'Al iniciar sesión se pide el código de tu app de autenticación.',
    lostApp:
      '¿Has perdido la app? Si apuntaste la clave, al escribirla en una app de autenticación nueva obtienes los ' +
      'mismos códigos.',
    turnOff: 'Desactivar',
    confirmOff:
      '¿Desactivar la verificación en dos pasos? Tu contraseña sola volverá a abrir tu cuenta. Después puedes ' +
      'borrar la entrada de StudentsBudget de tu app de autenticación.',
    alreadyOn: 'La verificación en dos pasos ya está activada.',
    isOn: 'La verificación en dos pasos está activada.',
    isOff: 'La verificación en dos pasos está desactivada.',
    setupCancelled: 'Configuración cancelada.',
    cancelledElsewhere: 'Esta configuración se canceló, quizá desde otro móvil. Toca Activar para empezar de nuevo.',
  },
  /** Tu cuenta → Funciones de IA (fase de IA, chunk 5): el interruptor de este móvil, activado al principio. */
  ai: {
    heading: 'Funciones de IA',
    use: 'Usar las funciones de IA en este móvil',
    hint:
      'Envían lo que escribes a Anthropic (Claude), en EE. UU., dentro de un cupo diario para tu cuenta. ' +
      'Desactivadas, no se envía nada a Anthropic, y Añadir rápido lee tus líneas en este móvil.',
  },
  /** El nombre con el que alguien publica en el feed de trucos: se pide al crear la cuenta y se cambia después. */
  postingName: {
    heading: 'Tu nombre en las publicaciones',
    intro: 'Otros estudiantes lo ven junto a tus publicaciones. Tu correo sigue oculto.',
    username: 'Nombre de usuario',
    usernameHint: 'De 3 a 20 caracteres: letras a–z, números o _. Los demás lo ven como @nombre.',
    label: 'Eres',
    labels: { student: 'Estudiante', graduate: 'Graduado/a', alumni: 'Exalumno/a' },
    batch: 'Promoción (opcional)',
    batchHint: 'El año en que terminas o terminaste, por ejemplo 2027.',
    batchShort: (year) => `Promoción ${year}`,
    none: 'Aún no tienes nombre. Elige uno ahora o antes de tu primera publicación.',
    loading: 'Comprobando tu nombre…',
    loadFailed: 'No se pudo leer tu nombre en las publicaciones. Inténtalo más tarde.',
    pick: 'Elegir un nombre',
    change: 'Cambiar',
    save: 'Guardar nombre',
    cancel: 'Cancelar',
    saved: 'Nombre guardado.',
    errors: {
      empty: 'Escribe un nombre de usuario.',
      characters: 'Usa solo letras a–z, números y _ en el nombre de usuario.',
      short: 'El nombre de usuario necesita al menos 3 caracteres.',
      long: 'El nombre de usuario puede tener como mucho 20 caracteres.',
      reserved: 'Ese nombre de usuario está reservado para la app. Elige otro.',
      taken: 'Ese nombre de usuario ya está ocupado. Elige otro.',
      batch: 'Escribe la promoción como un año, por ejemplo 2027.',
      checkFailed: 'No se pudo comprobar el nombre de usuario. Revisa tu conexión e inténtalo de nuevo.',
      saveFailed: 'No se pudo guardar tu nombre. Inténtalo de nuevo.',
    },
  },
  /** Inicio de sesión y seguridad → Contraseña: la nueva; la actual solo si esta sesión empezó con ella. */
  changePassword: {
    heading: 'Contraseña',
    intro:
      'Cambia la contraseña con la que inicias sesión. ¿La has olvidado? Inicia sesión con una llave de acceso y ' +
      'podrás poner una nueva aquí sin la antigua.',
    open: 'Cambiar contraseña',
    current: 'Contraseña actual',
    next: 'Contraseña nueva',
    save: 'Guardar contraseña',
    cancel: 'Cancelar',
    changed: 'Contraseña cambiada.',
    wrongCurrent: 'Esa no es tu contraseña actual.',
  },
  passkeys: {
    heading: 'Llaves de acceso',
    count: (count) =>
      count === 0 ? 'Ninguna todavía' : byCount(count, { one: '1 llave de acceso', other: `${count} llaves de acceso` }),
    intro:
      'Inicia sesión con Face ID, una huella o el PIN de tu móvil en lugar de tu contraseña. La llave de acceso se ' +
      'queda contigo, en tu móvil o en tu gestor de contraseñas; tu cuenta guarda su clave pública, que no permite ' +
      'iniciar sesión a nadie.',
    offline: 'No tienes conexión. Las llaves de acceso necesitan conexión.',
    signIn: 'Iniciar sesión con una llave de acceso',
    checking: 'Comprobando tus llaves de acceso…',
    unknown: 'No se han podido cargar tus llaves de acceso.',
    tryAgain: 'Intentar de nuevo',
    unnamed: 'Llave de acceso',
    added: (dateTime) => `Añadida el ${dateTime}`,
    lastUsed: (day) => `; usada por última vez el ${day}`,
    removeOne: (name, dateTime) => `Quitar ${name}, añadida el ${dateTime}`,
    remove: 'Quitar',
    removeQuestion:
      '¿Quitar esta llave de acceso? Dejará de iniciar tu sesión; tu contraseña y cualquier otra llave de acceso ' +
      'siguen funcionando. Después también puedes borrarla de tu móvil o de tu gestor de contraseñas.',
    cancel: 'Cancelar',
    add: 'Añadir una llave de acceso',
    unsupported: 'Este navegador no puede crear llaves de acceso.',
    addFailed: 'No se ha podido añadir la llave de acceso. Inténtalo de nuevo.',
    removeFailed: 'No se ha podido quitar la llave de acceso. Inténtalo de nuevo.',
    addedStatus: 'Llave de acceso añadida.',
    removedStatus: 'Llave de acceso quitada.',
  },
};
