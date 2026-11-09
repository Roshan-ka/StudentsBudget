import type { Messages } from '../en';
import { account } from './account';
import { accounts } from './accounts';
import { auth } from './auth';
import { backup } from './backup';
import { badges } from './badges';
import { categories } from './categories';
import { charts } from './charts';
import { checkIn } from './check-in';
import { common } from './common';
import { entries } from './entries';
import { home } from './home';
import { importExport } from './import-export';
import { language } from './language';
import { profile } from './profile';
import { recurring } from './recurring';
import { reminder } from './reminder';
import { reveal } from './reveal';
import { setup } from './setup';
import { shell } from './shell';
import { sync } from './sync';
import { theme } from './theme';
import { tips } from './tips';

/**
 * French, written area by area (language switch, plan 2: docs/superpowers/plans/2026-11-03-language-switch-2.md,
 * chunks 10–14) and offered since chunk 16, before its native read (Roshan, 04-11-2026). Every area is its own, with no
 * English underneath, so typecheck holds every key. A test checks that every area
 * differs from English, apart from a short allow-list, and that French punctuation has its narrow no-break space
 * (messages.test.ts). Counts go through `byCount` (`plural()`: 0 is singular in French).
 *
 * Glossary, so the areas say the same thing the same way:
 * - tu, throughout; calm: "12 € de trop", never a warning
 * - envelope: enveloppe; everyday budget: budget du quotidien; plan: plan; set aside: mettre de côté (épargne)
 * - one-off cost: frais ponctuels; fixed costs: charges fixes; income: revenus; expense: dépense
 * - entry: saisie; transfer: virement; account: compte; opening balance: solde initial; cash: espèces
 * - quick add: Ajout rapide; Add it automatically: Ajouter automatiquement; recurring: récurrent
 * - guess and estimate (a number no page states): estimation; source: source; checked: vérifié le
 * - check-in: bilan hebdomadaire; badge: badge; semester fee: frais de semestre; exchange rate: taux de change
 * - Settings: Réglages (in a sentence: dans les Réglages); Edit plan: Modifier le plan; phone: téléphone
 * - the sign-in account: compte, "ton compte" (as in English, the same word as a money account); email: e-mail
 * - sign in / out: se connecter / se déconnecter; two-step sign-in: validation en deux étapes; passkey: clé d'accès;
 *   authenticator app: appli d'authentification
 * - sync: synchroniser (the heading: Synchronisation; the button: Synchroniser); link: associer
 * - Regensburg stays Regensburg, as on every sign there.
 * - Typography: a narrow no-break space (`NNBSP`) before : ; ? ! and inside « », and ’ for the apostrophe.
 */
export const fr: Messages = {
  shell,
  language,
  theme,
  common,
  categories,
  home,
  entries,
  setup,
  profile,
  recurring,
  accounts,
  backup,
  importExport,
  sync,
  account,
  auth,
  checkIn,
  charts,
  badges,
  reveal,
  tips,
  reminder,
};
