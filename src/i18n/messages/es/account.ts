import type { Messages } from '../en';

// La cuenta en español: la tarjeta "Tu cuenta" en Ajustes y la línea sobre ella en la configuración.
export const account: Messages['account'] = {
  card: {
    heading: 'Tu cuenta',
    signedIn: (email) => `Sesión iniciada como ${email}.`,
    secondStep: (email) => `Casi has iniciado sesión como ${email}: escribe el código de tu app de autenticación.`,
    signedOut: 'Opcional: inicia sesión o crea una cuenta. Sin cuenta, todo se queda en este móvil.',
    manage: 'Gestionar cuenta',
    finish: 'Terminar de iniciar sesión',
    signIn: 'Iniciar sesión',
  },
  setupLink: {
    question: '¿Usas StudentsBudget en otro móvil?',
    signedIn: 'Trae tus datos de tu cuenta',
    secondStep: 'Termina de iniciar sesión para traer tus datos',
    signedOut: 'Inicia sesión para traer tus datos',
  },
  start: {
    /** Sobre el titular, con un pin. */
    place: 'Para estudiantes en Regensburg',
    headline: 'Tu dinero, en orden para tu vida de estudiante.',
    pitch: 'Planifica tu mes, registra tus gastos en segundos y consulta precios locales con sus fuentes.',
    /** Lo que hace la app, una línea cada cosa, en una tarjeta. */
    features: {
      plan: 'Planifica tu mes',
      log: 'Registra gastos en segundos',
      week: 'Conoce tu presupuesto semanal',
      tips: 'Consejos locales con fuentes',
    },
    signIn: 'Ya tengo una cuenta',
    create: 'Crear una cuenta',
    guest: 'Seguir sin cuenta',
    signedOut: 'Has cerrado sesión. Tus datos se han borrado de este móvil.',
    back: 'Atrás',
    /** Los formularios de las páginas de inicio (13-11-2026): su titular y la línea debajo. */
    signInHeading: 'Iniciar sesión',
    signInLine: 'Tu plan y tus registros vuelven desde tu cuenta.',
    createHeading: 'Crea tu cuenta',
    createLine: 'Guarda tu plan y úsalo en cada móvil.',
  },
};
