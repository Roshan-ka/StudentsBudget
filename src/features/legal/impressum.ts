import type { Operator } from '@/data/legal';
import type { IsoDate } from '@/lib/dates';
import type { LegalSection } from './content';

/** When the Impressum last changed. */
export const IMPRESSUM_UPDATED: IsoDate = '2026-11-12';

const address = (o: Operator) => [o.name, o.street, `${o.postcode} ${o.city}`, o.country];

/**
 * The Impressum (legal pages, chunk 1): who provides the site (§ 5 DDG) and who answers for its content (§ 18 (2)
 * MStV), from `OPERATOR`; and two notes on what the site holds: students' posts, shown without a check beforehand, and
 * the app's own figures, each with its source and checked date. Drafted from what the app does, to be checked before
 * go-live (the plan's "Before go-live").
 */
export function impressumSections(o: Operator): LegalSection[] {
  return [
    {
      id: 'provider',
      when: 'always',
      de: { heading: 'Angaben gemäß § 5 DDG', blocks: [{ kind: 'lines', lines: address(o) }] },
      en: {
        heading: 'Information under § 5 DDG (German Digital Services Act)',
        blocks: [{ kind: 'lines', lines: address(o) }],
      },
    },
    {
      id: 'contact',
      when: 'always',
      de: { heading: 'Kontakt', blocks: [{ kind: 'lines', lines: [`E-Mail: ${o.email}`] }] },
      en: { heading: 'Contact', blocks: [{ kind: 'lines', lines: [`Email: ${o.email}`] }] },
    },
    {
      id: 'responsible',
      when: 'always',
      de: {
        heading: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
        blocks: [{ kind: 'lines', lines: address(o).slice(0, 3) }],
      },
      en: {
        heading: 'Responsible for the content under § 18 (2) MStV (German Interstate Media Treaty)',
        blocks: [{ kind: 'lines', lines: address(o).slice(0, 3) }],
      },
    },
    {
      id: 'project',
      when: 'always',
      de: {
        heading: 'Über StudentsBudget',
        blocks: [
          {
            kind: 'p',
            text: 'StudentsBudget ist ein privates, nicht kommerzielles Projekt für Studierende in Regensburg. Es zeigt keine Werbung und verkauft nichts.',
          },
        ],
      },
      en: {
        heading: 'About StudentsBudget',
        blocks: [
          {
            kind: 'p',
            text: 'StudentsBudget is a private, non-commercial project for students in Regensburg. It shows no ads and sells nothing.',
          },
        ],
      },
    },
    {
      id: 'figures',
      when: 'always',
      de: {
        heading: 'Zahlen, Tipps und Rabatte der App',
        blocks: [
          {
            kind: 'p',
            text: 'Jede Zahl, jeder Tipp und jeder Rabatt der App nennt seine Quelle und das Datum, an dem er geprüft wurde. Seither kann sich etwas geändert haben: Verbindlich ist, was der Anbieter selbst angibt.',
          },
        ],
      },
      en: {
        heading: 'The app’s figures, tips and discounts',
        blocks: [
          {
            kind: 'p',
            text: 'Every figure, tip and discount in the app names its source and the day it was checked. Things may have changed since: what the provider states is what counts.',
          },
        ],
      },
    },
    {
      id: 'user-content',
      when: 'supabase',
      de: {
        heading: 'Beiträge von Nutzerinnen und Nutzern',
        blocks: [
          {
            kind: 'p',
            text: 'Hacks, Kommentare und Rabatte, die Studierende in der App eintragen, erscheinen sofort und werden vorher nicht geprüft. Für sie sind die Personen verantwortlich, die sie eingetragen haben. Jeder Beitrag lässt sich in der App melden; gemeldete Beiträge werden ausgeblendet und geprüft. Hinweise auf rechtswidrige Inhalte bitte an die E-Mail-Adresse oben.',
          },
        ],
      },
      en: {
        heading: 'Posts by users',
        blocks: [
          {
            kind: 'p',
            text: 'Hacks, comments and discounts that students add in the app show at once and aren’t checked beforehand. The people who added them are responsible for them. Every post can be reported in the app; reported posts are hidden and reviewed. Please send notices of unlawful content to the email address above.',
          },
        ],
      },
    },
  ];
}
