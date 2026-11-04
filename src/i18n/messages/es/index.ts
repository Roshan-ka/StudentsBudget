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
import { language } from './language';
import { profile } from './profile';
import { recurring } from './recurring';
import { reveal } from './reveal';
import { setup } from './setup';
import { shell } from './shell';
import { sync } from './sync';
import { theme } from './theme';
import { tips } from './tips';

/**
 * Spanish, written area by area (language switch, plan 2: docs/superpowers/plans/2026-11-03-language-switch-2.md,
 * chunks 3–7) and offered since chunk 9, before its native read (Roshan, 04-11-2026). Every area is its own, with no
 * English underneath, so typecheck holds every key. A test checks that every area differs from English, apart from a
 * short allow-list (messages.test.ts). Counts go through `byCount` (`plural()`).
 *
 * Glossary, so the areas say the same thing the same way:
 * - tú, throughout; calm: "12 € de más", never a warning
 * - envelope: sobre; everyday budget: presupuesto del día a día; plan: plan; set aside: apartar (ahorro)
 * - one-off cost: gasto puntual; fixed costs: gastos fijos; income: ingresos; expense: gasto
 * - entry: registro; transfer: transferencia; account: cuenta; opening balance: saldo inicial; cash: efectivo
 * - quick add: Añadir rápido; Add it automatically: Añadir automáticamente; recurring: recurrente
 * - guess and estimate (a number no page states): estimación; source: fuente; checked: comprobado el
 * - check-in: revisión semanal; badge: insignia; semester fee: cuota semestral; exchange rate: tipo de cambio
 * - Settings: Ajustes (in a sentence: en Ajustes); Edit plan: Editar plan; phone: móvil
 * - the sign-in account: cuenta, "tu cuenta" (as in English, the same word as a money account); email: correo
 * - sign in / out: iniciar / cerrar sesión; two-step sign-in: verificación en dos pasos; passkey: llave de acceso;
 *   authenticator app: app de autenticación
 * - sync: sincronizar (the heading: Sincronización; the button: Sincronizar ahora); link: vincular
 * - Regensburg stays Regensburg, as on every sign there.
 */
export const es: Messages = {
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
  sync,
  account,
  auth,
  checkIn,
  charts,
  badges,
  reveal,
  tips,
};
