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
};
