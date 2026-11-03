import { en, type Messages } from '../en';
import { categories } from './categories';
import { common } from './common';
import { entries } from './entries';
import { home } from './home';
import { language } from './language';
import { setup } from './setup';
import { shell } from './shell';

/**
 * German, being drafted (plan 1, chunks 10–14): each area as it is written, English for the rest. Not offered yet;
 * chunk 15 offers it once every area is German, and drops the English underneath, so typecheck then holds every key.
 * A test checks that every written area differs from English, apart from a short allow-list (messages.test.ts).
 *
 * Glossary, so the areas say the same thing the same way:
 * - du, throughout; calm: "12 € zu viel", never a warning
 * - envelope: Umschlag; everyday budget: Alltagsbudget; plan: Plan; set aside: zurücklegen (Rücklagen)
 * - one-off cost: einmalige Kosten; fixed costs: Fixkosten; income: Einnahmen; expense: Ausgabe
 * - entry: Eintrag; transfer: Umbuchung; account: Konto; opening balance: Anfangsstand; cash: Bargeld
 * - quick add: Schnell erfassen; Add it automatically: Automatisch hinzufügen; recurring: wiederkehrend
 * - guess: Schätzung; estimate (a number no page states): Schätzung; source: Quelle; checked: geprüft am
 * - check-in: Check-in; badge: Abzeichen; semester fee: Semesterbeitrag; exchange rate: Wechselkurs
 * - Settings (in a sentence): in den Einstellungen; Edit plan: Plan bearbeiten; the nav says Optionen (9 characters)
 */
export const de: Messages = { ...en, shell, language, common, categories, home, entries, setup };
