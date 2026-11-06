import type { Messages } from '../en';

// Ajustes → Recordatorio semanal en español (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 4): una línea
// tranquila a la semana de que toca la revisión, a través de la cuenta, desactivada hasta que se activa.
export const reminder: Messages['reminder'] = {
  intro:
    'Una vez a la semana, este móvil muestra una línea corta de que toca tu revisión semanal. No dice nada de tu ' +
    'dinero, y está desactivado hasta que lo actives.',
  loading: 'Cargando…',
  unavailable: 'Los recordatorios no están configurados en esta versión de la app.',
  signedOut: 'El recordatorio llega a través de tu cuenta: inicia sesión primero en este móvil.',
  toAccount: 'Ir a «Tu cuenta»',
  needsCode: 'Tu cuenta tiene verificación en dos pasos: introduce primero el código de tu app de autenticación.',
  installFirst:
    'En un iPhone o iPad, el recordatorio necesita la app en tu pantalla de inicio: en Safari, toca Compartir, luego ' +
    '«Añadir a pantalla de inicio», y ábrela desde ahí.',
  noPush: 'Este navegador no puede mostrar recordatorios. El recordatorio en el calendario, desde la revisión, funciona en todas partes.',
  denied:
    'Las notificaciones están bloqueadas para StudentsBudget. Permítelas en los ajustes de tu móvil o de tu ' +
    'navegador y vuelve aquí.',
  day: 'Día',
  time: 'Hora',
  hint: 'Elijas el día que elijas, la revisión mira la semana hasta ahora, de lunes a domingo.',
  turnOn: 'Activar el recordatorio',
  save: 'Guardar cambios',
  turnOff: 'Desactivar',
  status: {
    on: (day: string, time: string) => `El recordatorio está activado: ${day.toLowerCase()} a las ${time}.`,
    off: 'El recordatorio está desactivado.',
    dismissed: 'No ha cambiado nada: no se permitieron las notificaciones.',
    notSupported: 'El servicio push de este navegador no es uno al que la app pueda enviar.',
    failed: 'No ha funcionado. Comprueba tu conexión y vuelve a intentarlo.',
  },
  calendar:
    '¿Prefieres tu calendario? La revisión puede añadirle un recordatorio semanal en su lugar. Usa solo uno de los ' +
    'dos, para no recibir ambos.',
  toCheckIn: 'Abrir la revisión',
  everyDay: ['Los lunes', 'Los martes', 'Los miércoles', 'Los jueves', 'Los viernes', 'Los sábados', 'Los domingos'],
  summaryOff: 'Desactivado',
  summaryOn: (day: string, time: string) => `${day} a las ${time}`,
};
