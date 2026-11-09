import type { Messages } from '../en';

// Fragen auf Deutsch (KI-Phase, Chunk 10, docs/superpowers/plans/2026-11-09-ai-phase-1.md): Fragen zum eigenen Budget,
// beantwortet aus dem Plan, den Einträgen und den belegten Regensburg-Daten der App.
export const ask: Messages['ask'] = {
  intro:
    'Frag zu deinem eigenen Budget: was übrig ist, wohin dein Geld geht oder wie du in Regensburg weniger ausgibst. Die ' +
    'Antworten nutzen deinen Plan, deine letzten Einträge und die belegten Regensburg-Daten der App.',
  question: 'Deine Frage',
  questionHint: 'Höchstens 300 Zeichen. Jede Frage zählt zu den sechs von heute.',
  submit: 'Fragen',
  thinking: 'Denkt nach …',
  asked: 'Deine Frage',
  answer: 'Antwort',
  left: (count: number) => `Heute noch ${count} ${count === 1 ? 'Frage' : 'Fragen'}.`,
  full: 'Das sind sechs Fragen in diesem Gespräch. Fang neu an, um mehr zu fragen.',
  startOver: 'Neu anfangen',
  estimate:
    'Manche Beträge in dieser Antwort stammen nicht aus deinen Daten oder den belegten Regensburg-Daten: Nimm sie als Schätzung.',
  sources: 'Quellen',
  semester: (term: string, university: string) => `${term} an der ${university}`,
  fee: (university: string) => `Semesterbeitrag an der ${university}`,
  problems: {
    dailyLimit: 'Die Fragen für heute sind aufgebraucht. Frag morgen wieder.',
    busy: 'Gerade kommen zu viele Fragen an. Versuch es später noch einmal.',
    refused: 'Auf diese Frage kann die App hier nicht antworten.',
    failed: 'Bei der Antwort ist etwas schiefgegangen. Frag noch einmal.',
    unavailable: 'Gerade gibt es keine Antwort. Versuch es später noch einmal.',
    offline: 'Du bist offline. Für Antworten braucht es eine Verbindung.',
    timeout: 'Die Antwort hat zu lange gedauert. Frag noch einmal.',
  },
  unavailable: 'Fragen sind in dieser Version der App nicht enthalten.',
  loading: 'Wird geladen …',
  signedOut: 'Fragen laufen über dein Konto: Melde dich zuerst auf diesem Handy an.',
  needsCode: 'Dein Konto hat die zweistufige Anmeldung: Gib zuerst den Code aus deiner Authenticator-App ein.',
  toAccount: 'Zu „Dein Konto“',
  switchedOff: 'Die KI-Funktionen sind auf diesem Handy aus. Du kannst sie in den Einstellungen unter „Dein Konto“ wieder einschalten.',
  noPlan: 'Die Antworten kommen aus deinem Plan, richte ihn also zuerst ein.',
  toSetup: 'Plan einrichten',
  link: 'Frag zu deinem Budget',
};
