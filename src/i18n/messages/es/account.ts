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
    pitch: 'Tu presupuesto de estudiante en Regensburg: planifica, registra y ahorra.',
    withAccount: 'Con cuenta',
    signIn: 'Ya tengo una cuenta',
    create: 'Crear una cuenta',
    accountWhy: 'Con una cuenta, tu plan queda guardado y está en cada móvil en el que inicies sesión.',
    withoutAccount: 'Sin cuenta',
    guest: 'Seguir sin cuenta',
    guestNote: 'Tus datos se quedan solo en este móvil. Puedes crear una cuenta más tarde en Ajustes.',
  },
};
