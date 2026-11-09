import type { Messages } from '../en';
import { byCount } from './count';

// Preguntas en español (fase de IA, chunk 10, docs/superpowers/plans/2026-11-09-ai-phase-1.md): preguntas sobre el
// propio presupuesto, respondidas con el plan, los movimientos y los datos con fuente de la app sobre Regensburg.
export const ask: Messages['ask'] = {
  intro:
    'Pregunta sobre tu propio presupuesto: qué te queda, adónde va tu dinero o cómo gastar menos en Regensburg. Las ' +
    'respuestas usan tu plan, tus últimos movimientos y los datos con fuente de la app sobre Regensburg.',
  question: 'Tu pregunta',
  questionHint: 'Como mucho 300 caracteres. Cada pregunta cuenta para las seis de hoy.',
  submit: 'Preguntar',
  thinking: 'Pensando…',
  asked: 'Tu pregunta',
  answer: 'Respuesta',
  left: (count: number) =>
    byCount(count, { one: `Te queda ${count} pregunta hoy.`, other: `Te quedan ${count} preguntas hoy.` }),
  full: 'Ya son seis preguntas en esta conversación. Empieza de nuevo para preguntar más.',
  startOver: 'Empezar de nuevo',
  estimate:
    'Algunos importes de esta respuesta no salen de tus datos ni de los datos con fuente sobre Regensburg: tómalos como estimaciones.',
  sources: 'Fuentes',
  semester: (term: string, university: string) => `${term} en la ${university}`,
  fee: (university: string) => `Tasa semestral en la ${university}`,
  problems: {
    dailyLimit: 'Ya has usado las preguntas de hoy. Vuelve a preguntar mañana.',
    busy: 'Ahora llegan demasiadas preguntas. Inténtalo de nuevo más tarde.',
    refused: 'La app no puede responder a esa pregunta aquí.',
    failed: 'Algo salió mal con la respuesta. Vuelve a preguntar.',
    unavailable: 'Ahora no hay respuesta posible. Inténtalo de nuevo más tarde.',
    offline: 'No tienes conexión. Las respuestas necesitan conexión.',
    timeout: 'La respuesta tardó demasiado. Vuelve a preguntar.',
  },
  unavailable: 'Las preguntas no forman parte de esta versión de la app.',
  loading: 'Cargando…',
  signedOut: 'Las preguntas funcionan a través de tu cuenta: inicia sesión primero en este móvil.',
  needsCode: 'Tu cuenta tiene verificación en dos pasos: introduce primero el código de tu app de autenticación.',
  toAccount: 'Ir a «Tu cuenta»',
  switchedOff: 'Las funciones de IA están desactivadas en este móvil. Puedes volver a activarlas en Ajustes, en «Tu cuenta».',
  noPlan: 'Las respuestas salen de tu plan, así que configúralo primero.',
  toSetup: 'Configurar tu plan',
  link: 'Pregunta sobre tu presupuesto',
};
