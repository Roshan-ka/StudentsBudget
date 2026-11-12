import type { Operator } from '@/data/legal';
import type { IsoDate } from '@/lib/dates';
import type { LegalSection } from './content';

/** When the privacy notice last changed. */
export const PRIVACY_UPDATED: IsoDate = '2026-11-12';

/**
 * The privacy notice (legal pages): who is responsible, from `OPERATOR` (chunk 1), then what the app keeps and sends,
 * on what basis, for how long, and the rights (chunks 2 and 3). Each section says what in the code it describes, so a
 * change there finds its text here. Drafted from what the app does, to be checked before go-live.
 */
export function privacySections(o: Operator): LegalSection[] {
  const contact = [o.name, o.street, `${o.postcode} ${o.city}`, o.country];
  return [
    {
      id: 'controller',
      when: 'always',
      de: {
        heading: 'Verantwortlich',
        blocks: [
          { kind: 'p', text: 'Verantwortlich für die Verarbeitung personenbezogener Daten in StudentsBudget (Art. 4 Nr. 7 DSGVO) ist:' },
          { kind: 'lines', lines: [...contact, `E-Mail: ${o.email}`] },
        ],
      },
      en: {
        heading: 'Controller',
        blocks: [
          { kind: 'p', text: 'The controller for the processing of personal data in StudentsBudget (Art. 4 (7) GDPR) is:' },
          { kind: 'lines', lines: [...contact, `Email: ${o.email}`] },
        ],
      },
    },
    // Until chunk 3: what follows, so the page never pretends to be complete.
    {
      id: 'in-progress',
      when: 'always',
      de: {
        heading: 'Diese Erklärung wird gerade vervollständigt',
        blocks: [
          {
            kind: 'p',
            text: 'Hier folgen in Kürze: was nur auf deinem Handy bleibt, was an wen geht (Hosting, Konto, geteilte Beiträge, Wechselkurse, KI, Erinnerung), auf welcher Grundlage und wie lange, und deine Rechte. Bis dahin sagt dir jeder Hinweis in der App vor der ersten Nutzung, was er sendet. Fragen beantworte ich gern unter der E-Mail-Adresse oben.',
          },
        ],
      },
      en: {
        heading: 'This notice is being completed',
        blocks: [
          {
            kind: 'p',
            text: 'Coming here shortly: what stays on your phone, what goes to whom (hosting, the account, shared posts, exchange rates, AI, the reminder), on what basis and for how long, and your rights. Until then, every note in the app tells you before its first use what it sends. I’m glad to answer questions at the email address above.',
          },
        ],
      },
    },
  ];
}
